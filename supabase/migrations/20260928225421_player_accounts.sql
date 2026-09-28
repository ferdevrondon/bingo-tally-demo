-- =============================================================================
-- BACKEND_PLAN.md Phase 4d1 — the player's account between game sessions
-- (business rules v2 D and G, plus the settlement).
--
-- * Each player has one signed account balance (public.player_accounts),
--   written only by these functions. It carries over from one game session to
--   the next (rule D).
-- * While a game session is active, the balance of a player in it lives on
--   game_session_players.balance: joining copies the account balance into
--   opening_balance and balance (a `balance_opened` row records it); ending
--   the game session copies each final balance back to the account (a
--   `balance_closed` row). A player removed mid-session carries theirs too.
-- * Recharges (money in) and payouts (money out) can happen at any time
--   (decided 2026-09-28): record_account_recharge / record_account_payout go
--   to the active game session when the player is in it, otherwise to the
--   account (activity_log.game_session_id null). Payouts have no limit: the
--   balance may go negative.
-- * A positive balance carries a status set at each settlement:
--   `play` (left in the house to keep playing) or `pending_payout` (should be
--   paid but couldn't be, with a note). It only applies while the balance is
--   positive and is cleared when it isn't.
-- * The test game session of Phase 4c is deleted (approved 2026-09-28): every
--   account starts at 0.
--
-- Ledger rows added here (P, sale types and the rest as in game_rules_v2):
-- | type                   | amount                          | balance | house_balance |
-- |------------------------|---------------------------------|---------|---------------|
-- | balance_opened         | account balance when joining    | —       | —             |
-- | balance_closed         | final balance moved to account  | —       | —             |
-- | recharge (no session)  | +x                              | +x      | —             |
-- | payout (no session)    | -x                              | -x      | —             |
-- | credit_kept_for_play   | null (status change, with note) | —       | —             |
-- | credit_payout_pending  | null (status change, with note) | —       | —             |
--
-- Reconciliation:
--   per game_session_players row: balance = opening_balance + the game_rules_v2
--     formula over the rows of that game session;
--   per account (player not in the active game session): balance = the same
--     formula over every row of the player, in or out of game sessions
--     (balance_opened / balance_closed are informational and excluded).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Test data out, schema in
-- -----------------------------------------------------------------------------

delete from public.game_sessions;

create table public.player_accounts (
  house_id bigint not null,
  player_id bigint not null,
  balance numeric(12, 2) not null default 0,
  credit_status text check (credit_status in ('play', 'pending_payout')),
  credit_note text,
  updated_at timestamptz not null default now(),
  primary key (player_id),
  foreign key (player_id, house_id) references public.players (id, house_id) on delete cascade
);
create index player_accounts_house_id_idx on public.player_accounts (house_id);
comment on table public.player_accounts is
  'Signed balance of each player between game sessions (negative = owes the house). Written only by the game functions.';

insert into public.player_accounts (house_id, player_id)
select p.house_id, p.id from public.players p;

alter table public.player_accounts enable row level security;
revoke all on public.player_accounts from anon, authenticated;
grant select on public.player_accounts to authenticated;
create policy "player_accounts: members read" on public.player_accounts
  for select to authenticated using ((select private.is_house_member(house_id)));

alter table public.game_session_players
  add column opening_balance numeric(12, 2) not null default 0;

-- Recharges and payouts outside a game session have no game session.
alter table public.activity_log
  alter column game_session_id drop not null,
  drop constraint activity_log_type_check,
  add constraint activity_log_type_check check (type in (
    'game_session_started', 'game_session_ended',
    'player_added', 'player_removed',
    'ticket_added',
    'number_purchased', 'number_released', 'number_reassigned',
    'number_gifted', 'number_ungifted',
    'recharge', 'check_in', 'check_in_undone',
    'round_started', 'round_closed', 'prize_won', 'margin_adjustment',
    'carryover_kept', 'carryover_released',
    'payout', 'adjustment',
    'balance_opened', 'balance_closed',
    'credit_kept_for_play', 'credit_payout_pending'
  )),
  add constraint activity_log_game_session_check check (
    game_session_id is not null
    or type in ('recharge', 'payout', 'credit_kept_for_play', 'credit_payout_pending')
  );

-- -----------------------------------------------------------------------------
-- 2. Helpers
-- -----------------------------------------------------------------------------

-- The player's account, created at 0 if missing (players added after this
-- migration), locked for the caller's transaction.
create function private.lock_account(p_house_id bigint, p_player_id bigint)
returns public.player_accounts
language plpgsql
set search_path = ''
as $$
declare
  v_account public.player_accounts;
begin
  insert into public.player_accounts (house_id, player_id)
  values (p_house_id, p_player_id)
  on conflict (player_id) do nothing;
  select a.* into v_account
  from public.player_accounts a
  where a.player_id = p_player_id and a.house_id = p_house_id
  for update;
  return v_account;
end;
$$;

-- The house of a catalog player; raises player_not_found.
create function private.player_house(p_player_id bigint)
returns bigint
language plpgsql
stable
set search_path = ''
as $$
declare
  v_house_id bigint;
begin
  select p.house_id into v_house_id from public.players p where p.id = p_player_id;
  if not found then
    raise exception 'player_not_found' using errcode = 'P0002';
  end if;
  return v_house_id;
end;
$$;

-- Where the player's money lives right now: their row in the house's active
-- game session (removed players included, until it ends), or null for the
-- account. Locks the game session row when there is one.
create function private.active_session_player(p_house_id bigint, p_player_id bigint)
returns public.game_session_players
language plpgsql
set search_path = ''
as $$
declare
  v_row public.game_session_players;
begin
  perform 1 from public.game_sessions gs
  where gs.house_id = p_house_id and gs.status = 'active'
  for update;
  select gsp.* into v_row
  from public.game_session_players gsp
  join public.game_sessions gs on gs.id = gsp.game_session_id
  where gs.house_id = p_house_id and gs.status = 'active' and gsp.player_id = p_player_id
  for update of gsp;
  return v_row;
end;
$$;

-- Joining a game session now opens with the account balance (rule D).
create or replace function private.ensure_session_player(
  p_house_id bigint,
  p_game_session_id bigint,
  p_player_id bigint,
  p_request_id uuid
)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  v_id bigint;
  v_removed_at timestamptz;
  v_account public.player_accounts;
begin
  select gsp.id, gsp.removed_at into v_id, v_removed_at
  from public.game_session_players gsp
  where gsp.game_session_id = p_game_session_id and gsp.player_id = p_player_id
  for update;
  if v_id is not null and v_removed_at is null then
    return v_id;
  end if;

  if not exists (
    select 1 from public.players p
    where p.id = p_player_id and p.house_id = p_house_id and p.active
  ) then
    raise exception 'player_not_found' using errcode = 'P0002';
  end if;

  if v_id is not null then
    -- Coming back: their balance never left the game session.
    update public.game_session_players
    set removed_at = null, checked_in = false, pending_carryover = false
    where id = v_id;
  else
    v_account := private.lock_account(p_house_id, p_player_id);
    insert into public.game_session_players (
      house_id, game_session_id, player_id, opening_balance, balance
    )
    values (p_house_id, p_game_session_id, p_player_id, v_account.balance, v_account.balance)
    returning id into v_id;
    perform private.log_activity(
      private.request_id_for(p_request_id, 1), p_house_id, p_game_session_id, 'balance_opened',
      p_player_id => p_player_id, p_amount => v_account.balance
    );
  end if;

  perform private.log_activity(
    p_request_id, p_house_id, p_game_session_id, 'player_added', p_player_id => p_player_id
  );
  return v_id;
end;
$$;

-- Cash on the account (no active game session for the player). A balance
-- that is no longer positive drops its credit status.
create function private.move_account_cash(p_house_id bigint, p_player_id bigint, p_amount numeric)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform private.lock_account(p_house_id, p_player_id);
  update public.player_accounts
  set balance = balance + p_amount,
      credit_status = case when balance + p_amount > 0 then credit_status end,
      credit_note = case when balance + p_amount > 0 then credit_note end,
      updated_at = now()
  where player_id = p_player_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Public functions
-- -----------------------------------------------------------------------------

-- Money in from the player (a recharge or a debt paid), at any time.
create function public.record_account_recharge(
  p_player_id bigint,
  p_amount numeric,
  p_payment_method text,
  p_note text,
  p_request_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_house_id bigint := private.player_house(p_player_id);
  v_session_player public.game_session_players;
begin
  perform private.require_admin(v_house_id);
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  if p_payment_method is null then
    raise exception 'payment_method_required' using errcode = '22023';
  end if;
  v_session_player := private.active_session_player(v_house_id, p_player_id);
  if not private.claim_request(p_request_id) then
    return;
  end if;

  if v_session_player.id is not null then
    perform private.move_cash(v_session_player.id, p_amount);
  else
    perform private.move_account_cash(v_house_id, p_player_id, p_amount);
  end if;
  perform private.log_activity(
    p_request_id, v_house_id, v_session_player.game_session_id, 'recharge',
    p_round_id => (
      select r.id from public.game_session_rounds r
      where r.game_session_id = v_session_player.game_session_id and r.status = 'open'
    ),
    p_player_id => p_player_id, p_amount => p_amount,
    p_payment_method => p_payment_method, p_note => nullif(trim(p_note), '')
  );
end;
$$;

-- Money out to the player, at any time and with no limit (decided
-- 2026-09-28): paying more than a positive balance leaves it negative.
create function public.record_account_payout(
  p_player_id bigint,
  p_amount numeric,
  p_payment_method text,
  p_note text,
  p_request_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_house_id bigint := private.player_house(p_player_id);
  v_session_player public.game_session_players;
begin
  perform private.require_admin(v_house_id);
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  if p_payment_method is null then
    raise exception 'payment_method_required' using errcode = '22023';
  end if;
  v_session_player := private.active_session_player(v_house_id, p_player_id);
  if not private.claim_request(p_request_id) then
    return;
  end if;

  if v_session_player.id is not null then
    perform private.move_cash(v_session_player.id, -p_amount);
  else
    perform private.move_account_cash(v_house_id, p_player_id, -p_amount);
  end if;
  perform private.log_activity(
    p_request_id, v_house_id, v_session_player.game_session_id, 'payout',
    p_round_id => (
      select r.id from public.game_session_rounds r
      where r.game_session_id = v_session_player.game_session_id and r.status = 'open'
    ),
    p_player_id => p_player_id, p_amount => -p_amount,
    p_payment_method => p_payment_method, p_note => nullif(trim(p_note), '')
  );
end;
$$;

-- The status of a positive balance, set at each settlement: `play` (left to
-- keep playing) or `pending_payout` (should be paid but couldn't be; the note
-- says why). Raises no_credit_balance when the current balance isn't positive.
create function public.set_credit_status(
  p_player_id bigint,
  p_status text,
  p_note text,
  p_request_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_house_id bigint := private.player_house(p_player_id);
  v_session_player public.game_session_players;
  v_account public.player_accounts;
  v_balance numeric;
begin
  perform private.require_admin(v_house_id);
  if p_status is null or p_status not in ('play', 'pending_payout') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  v_session_player := private.active_session_player(v_house_id, p_player_id);
  v_account := private.lock_account(v_house_id, p_player_id);
  if not private.claim_request(p_request_id) then
    return;
  end if;
  v_balance := coalesce(v_session_player.balance, v_account.balance);
  if v_balance <= 0 then
    raise exception 'no_credit_balance';
  end if;

  update public.player_accounts
  set credit_status = p_status, credit_note = nullif(trim(p_note), ''), updated_at = now()
  where player_id = p_player_id;
  perform private.log_activity(
    p_request_id, v_house_id, v_session_player.game_session_id,
    case p_status when 'play' then 'credit_kept_for_play' else 'credit_payout_pending' end,
    p_player_id => p_player_id, p_note => nullif(trim(p_note), '')
  );
end;
$$;

-- "Terminar jornada": as in game_rules_v2, then every player's final balance
-- (removed players included) moves to their account (rule D).
create or replace function public.end_game_session(p_game_session_id bigint, p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_house_id bigint := private.lock_game_session(p_game_session_id);
  v_round public.game_session_rounds;
  v_refund record;
  v_player record;
  v_n integer := 3;
begin
  if not private.claim_request(p_request_id) then
    return;
  end if;

  select r.* into v_round
  from public.game_session_rounds r
  where r.game_session_id = p_game_session_id and r.status = 'open'
  for update;
  if found then
    if private.round_fully_awarded(v_round) then
      perform private.close_played_round(
        v_house_id, v_round, private.request_id_for(p_request_id, 1), private.request_id_for(p_request_id, 2)
      );
    elsif private.round_has_awards(v_round) then
      raise exception 'round_in_progress';
    else
      for v_refund in
        select a.player_id, sum(a.amount) as amount
        from public.activity_log a
        where a.round_id = v_round.id
          and a.player_id is not null
          and a.type in (
            'number_purchased', 'number_released', 'number_reassigned',
            'number_gifted', 'number_ungifted', 'carryover_kept'
          )
        group by a.player_id
        having sum(a.amount) > 0
      loop
        perform private.credit_player(
          (select gsp.id from public.game_session_players gsp
           where gsp.game_session_id = p_game_session_id and gsp.player_id = v_refund.player_id),
          v_refund.amount
        );
        perform private.log_activity(
          private.request_id_for(p_request_id, v_n), v_house_id, p_game_session_id, 'adjustment',
          p_round_id => v_round.id, p_player_id => v_refund.player_id, p_amount => v_refund.amount,
          p_note => 'unplayed_round_refund'
        );
        v_n := v_n + 1;
      end loop;

      update public.game_session_rounds
      set status = 'closed', closed_at = now(), margin_adjustment = 0,
          margin_gifts = 0, margin_unsold_losing = 0, margin_unsold_winning = 0
      where id = v_round.id;
      perform private.log_activity(
        private.request_id_for(p_request_id, 1), v_house_id, p_game_session_id, 'round_closed',
        p_round_id => v_round.id
      );
    end if;
  end if;

  v_n := 100000;
  for v_player in
    select gsp.player_id, gsp.balance
    from public.game_session_players gsp
    where gsp.game_session_id = p_game_session_id
    order by gsp.id
  loop
    perform private.lock_account(v_house_id, v_player.player_id);
    update public.player_accounts
    set balance = v_player.balance,
        credit_status = case when v_player.balance > 0 then credit_status end,
        credit_note = case when v_player.balance > 0 then credit_note end,
        updated_at = now()
    where player_id = v_player.player_id;
    perform private.log_activity(
      private.request_id_for(p_request_id, v_n), v_house_id, p_game_session_id, 'balance_closed',
      p_player_id => v_player.player_id, p_amount => v_player.balance
    );
    v_n := v_n + 1;
  end loop;

  update public.game_sessions
  set status = 'ended', ended_at = now()
  where id = p_game_session_id;
  perform private.log_activity(p_request_id, v_house_id, p_game_session_id, 'game_session_ended');
end;
$$;

-- "Salir y borrar": also refused once money was recorded in the game session
-- (a recharge or payout), so registered money is never deleted. Opening
-- balances are safe: accounts only change when a game session ends.
create or replace function public.discard_game_session(p_game_session_id bigint, p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_house_id bigint;
begin
  if not exists (select 1 from public.game_sessions gs where gs.id = p_game_session_id) then
    return;
  end if;
  v_house_id := private.lock_game_session(p_game_session_id);
  if not private.claim_request(p_request_id) then
    return;
  end if;
  if exists (select 1 from public.game_session_rounds r where r.game_session_id = p_game_session_id) then
    raise exception 'game_session_has_rounds';
  end if;
  if exists (
    select 1 from public.activity_log a
    where a.game_session_id = p_game_session_id and a.type in ('recharge', 'payout')
  ) then
    raise exception 'game_session_has_payments';
  end if;
  delete from public.game_sessions where id = p_game_session_id and house_id = v_house_id;
end;
$$;

-- Replaced by record_account_payout (settlement against the account).
drop function public.record_payout(bigint, bigint, numeric, text, text, uuid);

-- -----------------------------------------------------------------------------
-- 4. Grants
-- -----------------------------------------------------------------------------

revoke all on function
  public.record_account_recharge(bigint, numeric, text, text, uuid),
  public.record_account_payout(bigint, numeric, text, text, uuid),
  public.set_credit_status(bigint, text, text, uuid)
from public, anon;
grant execute on function
  public.record_account_recharge(bigint, numeric, text, text, uuid),
  public.record_account_payout(bigint, numeric, text, text, uuid),
  public.set_credit_status(bigint, text, text, uuid)
to authenticated;

revoke all on function
  private.lock_account(bigint, bigint),
  private.player_house(bigint),
  private.active_session_player(bigint, bigint),
  private.move_account_cash(bigint, bigint, numeric)
from public, anon, authenticated;
