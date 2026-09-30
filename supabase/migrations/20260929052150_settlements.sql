-- =============================================================================
-- BACKEND_PLAN.md Phase 4d2 — settlement of an ended game session.
--
-- Decided with the product owner on 2026-09-28:
-- * Every ended game session gets a settlement: one row per player with the
--   balance they ended with. The admin works it as a task list: collect from
--   who owes, pay who is owed, or mark the balance. A player is resolved when
--   a collection leaves them at >= 0 (`paid_in`), a payout at <= 0
--   (`paid_out`), or the balance is marked `play` (left to keep playing),
--   `pending_payout` (should be paid but couldn't be; note required) or
--   `owes` (optional note, e.g. "pays on Friday"). Ending at 0 is `settled`.
-- * "Cerrar liquidación" is always allowed (the UI confirms when players are
--   still unresolved). A closed settlement is read-only: it keeps each
--   player's balance at close time (`final_balance`) so it can be viewed as it
--   was. Later moves go through the account functions (/players).
-- * The account status (`player_accounts.balance_status`, renamed from
--   credit_status) now also has `owes`, so a debt keeps its note. A status
--   only holds while the balance has its sign (play / pending_payout: > 0;
--   owes: < 0) and is cleared otherwise.
--
-- Money still moves through the ledger exactly as in player_accounts: a
-- settlement collection is a `recharge` and a payout a `payout`, on the
-- account (game_session_id null) or on the active game session when the
-- player is playing another one. settlement_players.received / paid add up
-- what was moved from the settlement.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Account status: renamed, plus `owes`
-- -----------------------------------------------------------------------------

alter table public.player_accounts rename column credit_status to balance_status;
alter table public.player_accounts rename column credit_note to balance_note;
alter table public.player_accounts
  drop constraint player_accounts_credit_status_check,
  add constraint player_accounts_balance_status_check
    check (balance_status in ('play', 'pending_payout', 'owes'));

alter table public.activity_log
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
    'credit_kept_for_play', 'credit_payout_pending', 'debt_noted',
    'settlement_closed'
  )),
  drop constraint activity_log_game_session_check,
  add constraint activity_log_game_session_check check (
    game_session_id is not null
    or type in ('recharge', 'payout', 'credit_kept_for_play', 'credit_payout_pending', 'debt_noted')
  );

-- -----------------------------------------------------------------------------
-- 2. Settlement tables (members read, only functions write)
-- -----------------------------------------------------------------------------

create table public.settlements (
  game_session_id bigint primary key,
  house_id bigint not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  closed_by uuid references auth.users (id) on delete set null,
  check ((status = 'closed') = (closed_at is not null)),
  foreign key (game_session_id, house_id)
    references public.game_sessions (id, house_id) on delete cascade
);
create index settlements_house_id_idx on public.settlements (house_id);

create table public.settlement_players (
  game_session_id bigint not null references public.settlements (game_session_id) on delete cascade,
  player_id bigint not null,
  house_id bigint not null,
  closing_balance numeric(12, 2) not null,
  received numeric(12, 2) not null default 0,
  paid numeric(12, 2) not null default 0,
  resolution text check (resolution in (
    'paid_in', 'paid_out', 'play', 'pending_payout', 'owes', 'settled'
  )),
  note text,
  resolved_at timestamptz,
  final_balance numeric(12, 2),
  primary key (game_session_id, player_id),
  foreign key (player_id, house_id) references public.players (id, house_id)
);
create index settlement_players_house_id_idx on public.settlement_players (house_id);
create index settlement_players_player_id_idx on public.settlement_players (player_id, house_id);

alter table public.settlements enable row level security;
alter table public.settlement_players enable row level security;
revoke all on public.settlements, public.settlement_players from anon, authenticated;
grant select on public.settlements, public.settlement_players to authenticated;
create policy "settlements: members read" on public.settlements
  for select to authenticated using ((select private.is_house_member(house_id)));
create policy "settlement_players: members read" on public.settlement_players
  for select to authenticated using ((select private.is_house_member(house_id)));

-- -----------------------------------------------------------------------------
-- 3. Helpers
-- -----------------------------------------------------------------------------

-- A status only holds while the balance has its sign.
create function private.status_for_balance(p_status text, p_balance numeric)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_status in ('play', 'pending_payout') and p_balance > 0 then p_status
    when p_status = 'owes' and p_balance < 0 then p_status
  end;
$$;

create or replace function private.move_account_cash(p_house_id bigint, p_player_id bigint, p_amount numeric)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform private.lock_account(p_house_id, p_player_id);
  update public.player_accounts
  set balance = balance + p_amount,
      balance_status = private.status_for_balance(balance_status, balance + p_amount),
      balance_note = case
        when private.status_for_balance(balance_status, balance + p_amount) is null then null
        else balance_note
      end,
      updated_at = now()
  where player_id = p_player_id;
end;
$$;

-- Cash in (+) or out (-) for a player, on the active game session when they
-- are in it, otherwise on their account; writes its ledger row. The caller
-- checked the admin and claimed the request. Returns the new balance.
create function private.record_cash(
  p_house_id bigint,
  p_player_id bigint,
  p_amount numeric,
  p_type text,
  p_payment_method text,
  p_note text,
  p_request_id uuid
)
returns numeric
language plpgsql
set search_path = ''
as $$
declare
  v_session_player public.game_session_players := private.active_session_player(p_house_id, p_player_id);
  v_balance numeric;
begin
  if v_session_player.id is not null then
    perform private.move_cash(v_session_player.id, p_amount);
    select gsp.balance into v_balance from public.game_session_players gsp where gsp.id = v_session_player.id;
  else
    perform private.move_account_cash(p_house_id, p_player_id, p_amount);
    select a.balance into v_balance from public.player_accounts a where a.player_id = p_player_id;
  end if;
  perform private.log_activity(
    p_request_id, p_house_id, v_session_player.game_session_id, p_type,
    p_round_id => (
      select r.id from public.game_session_rounds r
      where r.game_session_id = v_session_player.game_session_id and r.status = 'open'
    ),
    p_player_id => p_player_id, p_amount => p_amount,
    p_payment_method => p_payment_method, p_note => nullif(trim(p_note), '')
  );
  return v_balance;
end;
$$;

-- Marks the account status (`play`, `pending_payout`, `owes`) after checking
-- the current balance has the right sign; writes its ledger row.
create function private.apply_balance_status(
  p_house_id bigint,
  p_player_id bigint,
  p_status text,
  p_note text,
  p_request_id uuid
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_session_player public.game_session_players := private.active_session_player(p_house_id, p_player_id);
  v_account public.player_accounts := private.lock_account(p_house_id, p_player_id);
  v_balance numeric := coalesce(v_session_player.balance, v_account.balance);
  v_note text := nullif(trim(p_note), '');
begin
  if p_status in ('play', 'pending_payout') and v_balance <= 0 then
    raise exception 'no_credit_balance';
  end if;
  if p_status = 'owes' and v_balance >= 0 then
    raise exception 'no_debt_balance';
  end if;
  if p_status = 'pending_payout' and v_note is null then
    raise exception 'note_required' using errcode = '22023';
  end if;

  update public.player_accounts
  set balance_status = p_status, balance_note = v_note, updated_at = now()
  where player_id = p_player_id;
  perform private.log_activity(
    p_request_id, p_house_id, v_session_player.game_session_id,
    case p_status
      when 'play' then 'credit_kept_for_play'
      when 'pending_payout' then 'credit_payout_pending'
      else 'debt_noted'
    end,
    p_player_id => p_player_id, p_note => v_note
  );
end;
$$;

-- The settlement of a game session, locked; checks the admin and that it is
-- still open.
create function private.lock_open_settlement(p_game_session_id bigint)
returns public.settlements
language plpgsql
set search_path = ''
as $$
declare
  v_settlement public.settlements;
begin
  select s.* into v_settlement
  from public.settlements s
  where s.game_session_id = p_game_session_id
  for update;
  if not found then
    raise exception 'settlement_not_found' using errcode = 'P0002';
  end if;
  perform private.require_admin(v_settlement.house_id);
  if v_settlement.status <> 'open' then
    raise exception 'settlement_closed';
  end if;
  return v_settlement;
end;
$$;

create function private.lock_settlement_player(p_game_session_id bigint, p_player_id bigint)
returns public.settlement_players
language plpgsql
set search_path = ''
as $$
declare
  v_row public.settlement_players;
begin
  select sp.* into v_row
  from public.settlement_players sp
  where sp.game_session_id = p_game_session_id and sp.player_id = p_player_id
  for update;
  if not found then
    raise exception 'player_not_in_settlement' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Account functions on the renamed status
-- -----------------------------------------------------------------------------

create or replace function public.record_account_recharge(
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
begin
  perform private.require_admin(v_house_id);
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  if p_payment_method is null then
    raise exception 'payment_method_required' using errcode = '22023';
  end if;
  if not private.claim_request(p_request_id) then
    return;
  end if;
  perform private.record_cash(
    v_house_id, p_player_id, p_amount, 'recharge', p_payment_method, p_note, p_request_id
  );
end;
$$;

create or replace function public.record_account_payout(
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
begin
  perform private.require_admin(v_house_id);
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  if p_payment_method is null then
    raise exception 'payment_method_required' using errcode = '22023';
  end if;
  if not private.claim_request(p_request_id) then
    return;
  end if;
  perform private.record_cash(
    v_house_id, p_player_id, -p_amount, 'payout', p_payment_method, p_note, p_request_id
  );
end;
$$;

drop function public.set_credit_status(bigint, text, text, uuid);

-- The balance status from /players (outside any settlement).
create function public.set_balance_status(
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
begin
  perform private.require_admin(v_house_id);
  if p_status is null or p_status not in ('play', 'pending_payout', 'owes') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  if not private.claim_request(p_request_id) then
    return;
  end if;
  perform private.apply_balance_status(v_house_id, p_player_id, p_status, p_note, p_request_id);
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Settlement functions
-- -----------------------------------------------------------------------------

-- Collect from a player in the settlement: `paid_in` once the balance is >= 0.
create function public.settlement_receive(
  p_game_session_id bigint,
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
  v_settlement public.settlements := private.lock_open_settlement(p_game_session_id);
  v_balance numeric;
begin
  perform private.lock_settlement_player(p_game_session_id, p_player_id);
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  if p_payment_method is null then
    raise exception 'payment_method_required' using errcode = '22023';
  end if;
  if not private.claim_request(p_request_id) then
    return;
  end if;
  v_balance := private.record_cash(
    v_settlement.house_id, p_player_id, p_amount, 'recharge', p_payment_method, p_note, p_request_id
  );
  update public.settlement_players
  set received = received + p_amount,
      resolution = case when v_balance >= 0 then 'paid_in' else resolution end,
      note = case when v_balance >= 0 then null else note end,
      resolved_at = case when v_balance >= 0 then now() else resolved_at end
  where game_session_id = p_game_session_id and player_id = p_player_id;
end;
$$;

-- Pay a player in the settlement (no limit): `paid_out` once the balance is <= 0.
create function public.settlement_payout(
  p_game_session_id bigint,
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
  v_settlement public.settlements := private.lock_open_settlement(p_game_session_id);
  v_balance numeric;
begin
  perform private.lock_settlement_player(p_game_session_id, p_player_id);
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  if p_payment_method is null then
    raise exception 'payment_method_required' using errcode = '22023';
  end if;
  if not private.claim_request(p_request_id) then
    return;
  end if;
  v_balance := private.record_cash(
    v_settlement.house_id, p_player_id, -p_amount, 'payout', p_payment_method, p_note, p_request_id
  );
  update public.settlement_players
  set paid = paid + p_amount,
      resolution = case when v_balance <= 0 then 'paid_out' else resolution end,
      note = case when v_balance <= 0 then null else note end,
      resolved_at = case when v_balance <= 0 then now() else resolved_at end
  where game_session_id = p_game_session_id and player_id = p_player_id;
end;
$$;

-- Mark a player's balance in the settlement: `play`, `pending_payout` (note
-- required) or `owes`. Also sets the account status.
create function public.settlement_mark(
  p_game_session_id bigint,
  p_player_id bigint,
  p_resolution text,
  p_note text,
  p_request_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settlement public.settlements := private.lock_open_settlement(p_game_session_id);
begin
  perform private.lock_settlement_player(p_game_session_id, p_player_id);
  if p_resolution is null or p_resolution not in ('play', 'pending_payout', 'owes') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  if not private.claim_request(p_request_id) then
    return;
  end if;
  perform private.apply_balance_status(
    v_settlement.house_id, p_player_id, p_resolution, p_note, p_request_id
  );
  update public.settlement_players
  set resolution = p_resolution, note = nullif(trim(p_note), ''), resolved_at = now()
  where game_session_id = p_game_session_id and player_id = p_player_id;
end;
$$;

-- "Cerrar liquidación": keeps each player's balance at this moment and makes
-- the settlement read-only. Unresolved players stay unresolved in the record.
create function public.close_settlement(p_game_session_id bigint, p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settlement public.settlements := private.lock_open_settlement(p_game_session_id);
begin
  if not private.claim_request(p_request_id) then
    return;
  end if;
  update public.settlement_players sp
  set final_balance = coalesce(
    (
      select gsp.balance
      from public.game_session_players gsp
      join public.game_sessions gs on gs.id = gsp.game_session_id
      where gs.house_id = sp.house_id and gs.status = 'active' and gsp.player_id = sp.player_id
    ),
    (select a.balance from public.player_accounts a where a.player_id = sp.player_id),
    0
  )
  where sp.game_session_id = p_game_session_id;
  update public.settlements
  set status = 'closed', closed_at = now(), closed_by = auth.uid()
  where game_session_id = p_game_session_id;
  perform private.log_activity(
    p_request_id, v_settlement.house_id, p_game_session_id, 'settlement_closed'
  );
end;
$$;

-- "Terminar jornada": as in player_accounts, plus the settlement is opened
-- with one row per player (resolved as `settled` when they ended at 0).
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

  insert into public.settlements (game_session_id, house_id) values (p_game_session_id, v_house_id);

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
        balance_status = private.status_for_balance(balance_status, v_player.balance),
        balance_note = case
          when private.status_for_balance(balance_status, v_player.balance) is null then null
          else balance_note
        end,
        updated_at = now()
    where player_id = v_player.player_id;
    insert into public.settlement_players (
      game_session_id, player_id, house_id, closing_balance, resolution, resolved_at
    )
    values (
      p_game_session_id, v_player.player_id, v_house_id, v_player.balance,
      case when v_player.balance = 0 then 'settled' end,
      case when v_player.balance = 0 then now() end
    );
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

-- -----------------------------------------------------------------------------
-- 6. Grants
-- -----------------------------------------------------------------------------

revoke all on function
  public.set_balance_status(bigint, text, text, uuid),
  public.settlement_receive(bigint, bigint, numeric, text, text, uuid),
  public.settlement_payout(bigint, bigint, numeric, text, text, uuid),
  public.settlement_mark(bigint, bigint, text, text, uuid),
  public.close_settlement(bigint, uuid)
from public, anon;
grant execute on function
  public.set_balance_status(bigint, text, text, uuid),
  public.settlement_receive(bigint, bigint, numeric, text, text, uuid),
  public.settlement_payout(bigint, bigint, numeric, text, text, uuid),
  public.settlement_mark(bigint, bigint, text, text, uuid),
  public.close_settlement(bigint, uuid)
to authenticated;

revoke all on function
  private.status_for_balance(text, numeric),
  private.record_cash(bigint, bigint, numeric, text, text, text, uuid),
  private.apply_balance_status(bigint, bigint, text, text, uuid),
  private.lock_open_settlement(bigint),
  private.lock_settlement_player(bigint, bigint)
from public, anon, authenticated;
