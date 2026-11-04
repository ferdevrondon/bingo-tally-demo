-- Transfer balance from one player to another (client request, 2026-11-03).
--
-- A player can hand part of their balance to another one, inside a game session
-- or outside it. It is NOT cash that enters or leaves the house: it changes two
-- players' balances and nothing else (no house_balance, no Diario / Mensual, no
-- cash by payment method). So it is neither a `recharge` nor a `payout` (that
-- would invent cash in the reports and could be "corrected" like a real cobro):
-- it has its own ledger type.
--
-- * Ledger type `balance_transfer`, TWO rows linked by `transfer_id` (the
--   request_id of the call): the sender's with a negative `amount`, the
--   receiver's with a positive one; `counterparty_player_id` is the other
--   player. Each row has the game session of the player's own side (null when
--   the money is on the account), so the per-player reconciliation still holds:
--     balance = opening_balance + recharge + prize_won + adjustment + payout
--               + balance_transfer - number_purchased - ... (see
--               player_accounts.sql / game_rules_v2.sql)
--   Every sum by cash type (recharge / payout) ignores it, and house_balance is
--   never touched.
-- * record_balance_transfer: admin only, idempotent by request_id. The sender
--   must have a balance in their favor (amount <= balance); the receiver can
--   have any balance (a transfer reduces a debt). The money moves where each
--   player's money lives right now: their row in the active game session (even
--   removed players) or their account. A player with a pending keep-or-release
--   decision (pending_carryover) can't take part, like with their plays.
-- * void_balance_transfer: voids the whole transfer once, with a reason, by two
--   rows of the same type linked by `corrects_id` (the ledger stays
--   append-only). Like a corrected cash move, it can only be voided while the
--   money is still where it was put (`transfer_closed` otherwise: the game
--   session ended; or, on the account, another game session started since or
--   the player is in the active one), and while the receiver still has what
--   they got (`insufficient_balance`).
-- * discard_game_session also counts transfers as money in the game session.
-- Additive: no existing call changes.

alter table public.activity_log
  add column transfer_id uuid,
  add column counterparty_player_id bigint references public.players (id);

create index activity_log_transfer_id_idx
  on public.activity_log (transfer_id) where transfer_id is not null;

alter table public.activity_log
  drop constraint activity_log_type_check,
  add constraint activity_log_type_check check (type in (
    'game_session_started', 'game_session_ended',
    'player_added', 'player_removed',
    'ticket_added', 'ticket_removed', 'ticket_restored',
    'number_purchased', 'number_released', 'number_reassigned', 'number_moved',
    'number_gifted', 'number_ungifted',
    'recharge', 'check_in', 'check_in_undone',
    'round_started', 'round_closed', 'prize_won', 'margin_adjustment',
    'carryover_kept', 'carryover_released',
    'payout', 'adjustment',
    'balance_opened', 'balance_closed',
    'credit_kept_for_play', 'credit_payout_pending', 'debt_noted',
    'settlement_closed',
    'house_updated',
    'balance_transfer'
  )),
  drop constraint activity_log_game_session_check,
  add constraint activity_log_game_session_check check (
    game_session_id is not null
    or type in (
      'recharge', 'payout', 'credit_kept_for_play', 'credit_payout_pending', 'debt_noted',
      'house_updated', 'balance_transfer'
    )
  ),
  drop constraint activity_log_correction_check,
  add constraint activity_log_correction_check check (
    corrects_id is null or (type in ('recharge', 'payout', 'balance_transfer') and note is not null)
  ),
  add constraint activity_log_transfer_check check (
    (type = 'balance_transfer') = (
      transfer_id is not null and counterparty_player_id is not null and player_id is not null
    )
  );

-- -----------------------------------------------------------------------------
-- 1. Helpers
-- -----------------------------------------------------------------------------

-- One ledger row of a transfer (or of its voiding).
create function private.log_transfer_leg(
  p_request_id uuid,
  p_house_id bigint,
  p_game_session_id bigint,
  p_transfer_id uuid,
  p_player_id bigint,
  p_counterparty_player_id bigint,
  p_amount numeric,
  p_note text,
  p_corrects_id bigint default null
)
returns void
language sql
set search_path = ''
as $$
  insert into public.activity_log (
    request_id, house_id, game_session_id, type, round_id, player_id, amount, note,
    transfer_id, counterparty_player_id, corrects_id
  )
  values (
    p_request_id, p_house_id, p_game_session_id, 'balance_transfer',
    (
      select r.id from public.game_session_rounds r
      where r.game_session_id = p_game_session_id and r.status = 'open'
    ),
    p_player_id, p_amount, p_note, p_transfer_id, p_counterparty_player_id, p_corrects_id
  );
$$;

-- A transfer leg can be voided while its money is still where it was put.
create function private.assert_transfer_leg_open(p_leg public.activity_log)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_leg.game_session_id is not null then
    if not exists (
      select 1 from public.game_sessions gs
      where gs.id = p_leg.game_session_id and gs.status = 'active'
    ) then
      raise exception 'transfer_closed' using errcode = '22023';
    end if;
    perform private.assert_no_pending_carryover(p_leg.game_session_id, p_leg.player_id);
  elsif exists (
    select 1 from public.game_sessions gs
    where gs.house_id = p_leg.house_id and gs.started_at > p_leg.created_at
  ) or exists (
    select 1
    from public.game_session_players gsp
    join public.game_sessions gs on gs.id = gsp.game_session_id
    where gs.house_id = p_leg.house_id and gs.status = 'active' and gsp.player_id = p_leg.player_id
  ) then
    raise exception 'transfer_closed' using errcode = '22023';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Transfer
-- -----------------------------------------------------------------------------

create function public.record_balance_transfer(
  p_from_player_id bigint,
  p_to_player_id bigint,
  p_amount numeric,
  p_note text,
  p_request_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_house_id bigint := private.player_house(p_from_player_id);
  v_from public.game_session_players;
  v_to public.game_session_players;
  v_from_balance numeric;
  v_note text := left(nullif(btrim(p_note), ''), 200);
begin
  perform private.require_admin(v_house_id);
  if p_from_player_id = p_to_player_id then
    raise exception 'transfer_same_player' using errcode = '22023';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  if private.player_house(p_to_player_id) <> v_house_id or (
    select count(*) from public.players p
    where p.id in (p_from_player_id, p_to_player_id) and p.active
  ) <> 2 then
    raise exception 'player_not_found' using errcode = 'P0002';
  end if;
  if not private.claim_request(p_request_id) then
    return;
  end if;

  -- Lock in a fixed order (by player id) whatever the direction. Every path
  -- starts with the active game session row, so two transfers can't deadlock.
  if p_from_player_id < p_to_player_id then
    v_from := private.active_session_player(v_house_id, p_from_player_id);
    v_to := private.active_session_player(v_house_id, p_to_player_id);
    if v_from.id is null then perform private.lock_account(v_house_id, p_from_player_id); end if;
    if v_to.id is null then perform private.lock_account(v_house_id, p_to_player_id); end if;
  else
    v_to := private.active_session_player(v_house_id, p_to_player_id);
    v_from := private.active_session_player(v_house_id, p_from_player_id);
    if v_to.id is null then perform private.lock_account(v_house_id, p_to_player_id); end if;
    if v_from.id is null then perform private.lock_account(v_house_id, p_from_player_id); end if;
  end if;

  if v_from.id is not null then
    perform private.assert_no_pending_carryover(v_from.game_session_id, p_from_player_id);
  end if;
  if v_to.id is not null then
    perform private.assert_no_pending_carryover(v_to.game_session_id, p_to_player_id);
  end if;

  v_from_balance := case
    when v_from.id is not null then v_from.balance
    else (select a.balance from public.player_accounts a where a.player_id = p_from_player_id)
  end;
  if v_from_balance < p_amount then
    raise exception 'insufficient_balance' using errcode = '22023';
  end if;

  if v_from.id is not null then
    perform private.move_cash(v_from.id, -p_amount);
  else
    perform private.move_account_cash(v_house_id, p_from_player_id, -p_amount);
  end if;
  if v_to.id is not null then
    perform private.move_cash(v_to.id, p_amount);
  else
    perform private.move_account_cash(v_house_id, p_to_player_id, p_amount);
  end if;

  perform private.log_transfer_leg(
    p_request_id, v_house_id, v_from.game_session_id, p_request_id,
    p_from_player_id, p_to_player_id, -p_amount, v_note
  );
  perform private.log_transfer_leg(
    private.request_id_for(p_request_id, 1), v_house_id, v_to.game_session_id, p_request_id,
    p_to_player_id, p_from_player_id, p_amount, v_note
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Void a transfer
-- -----------------------------------------------------------------------------

-- p_transfer_id: the `transfer_id` of its rows. p_reason is required and
-- becomes the note of the voiding rows.
create function public.void_balance_transfer(
  p_transfer_id uuid,
  p_reason text,
  p_request_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_out public.activity_log;
  v_in public.activity_log;
  v_reason text := nullif(btrim(p_reason), '');
  v_in_balance numeric;
begin
  -- Locks both rows: two voidings of the same transfer are serialized.
  select a.* into v_out from public.activity_log a
  where a.transfer_id = p_transfer_id and a.corrects_id is null and a.amount < 0
  for update;
  select a.* into v_in from public.activity_log a
  where a.transfer_id = p_transfer_id and a.corrects_id is null and a.amount > 0
  for update;
  if v_out.id is null or v_in.id is null then
    raise exception 'transfer_not_found' using errcode = 'P0002';
  end if;
  perform private.require_admin(v_out.house_id);
  if v_reason is null or char_length(v_reason) > 200 then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  if not private.claim_request(p_request_id) then
    return;
  end if;
  if exists (
    select 1 from public.activity_log a where a.corrects_id in (v_out.id, v_in.id)
  ) then
    raise exception 'transfer_already_voided' using errcode = '22023';
  end if;

  -- The active game session row first, like every other money path.
  perform 1 from public.game_sessions gs
  where gs.house_id = v_out.house_id and gs.status = 'active'
  for update;

  perform private.assert_transfer_leg_open(v_out);
  perform private.assert_transfer_leg_open(v_in);

  -- Lock what is going to move, in a fixed order.
  if v_out.game_session_id is null and v_in.game_session_id is null then
    perform private.lock_account(v_out.house_id, least(v_out.player_id, v_in.player_id));
    perform private.lock_account(v_out.house_id, greatest(v_out.player_id, v_in.player_id));
  elsif v_in.game_session_id is null then
    perform private.lock_account(v_out.house_id, v_in.player_id);
  elsif v_out.game_session_id is null then
    perform private.lock_account(v_out.house_id, v_out.player_id);
  end if;

  -- The receiver gives back what they got: they must still have it.
  v_in_balance := case
    when v_in.game_session_id is not null then (
      select gsp.balance from public.game_session_players gsp
      where gsp.game_session_id = v_in.game_session_id and gsp.player_id = v_in.player_id
      for update
    )
    else (select a.balance from public.player_accounts a where a.player_id = v_in.player_id)
  end;
  if v_in_balance < v_in.amount then
    raise exception 'insufficient_balance' using errcode = '22023';
  end if;

  if v_in.game_session_id is not null then
    perform private.move_cash((
      select gsp.id from public.game_session_players gsp
      where gsp.game_session_id = v_in.game_session_id and gsp.player_id = v_in.player_id
    ), -v_in.amount);
  else
    perform private.move_account_cash(v_in.house_id, v_in.player_id, -v_in.amount);
  end if;
  if v_out.game_session_id is not null then
    perform private.move_cash((
      select gsp.id from public.game_session_players gsp
      where gsp.game_session_id = v_out.game_session_id and gsp.player_id = v_out.player_id
      for update
    ), -v_out.amount);
  else
    perform private.move_account_cash(v_out.house_id, v_out.player_id, -v_out.amount);
  end if;

  perform private.log_transfer_leg(
    p_request_id, v_out.house_id, v_out.game_session_id, p_transfer_id,
    v_out.player_id, v_out.counterparty_player_id, -v_out.amount, v_reason, v_out.id
  );
  perform private.log_transfer_leg(
    private.request_id_for(p_request_id, 1), v_in.house_id, v_in.game_session_id, p_transfer_id,
    v_in.player_id, v_in.counterparty_player_id, -v_in.amount, v_reason, v_in.id
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. A game session with transfers has money in it (same body as before, plus
--    the new type)
-- -----------------------------------------------------------------------------

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
    where a.game_session_id = p_game_session_id
      and a.type in ('recharge', 'payout', 'balance_transfer')
  ) then
    raise exception 'game_session_has_payments';
  end if;
  delete from public.game_sessions where id = p_game_session_id and house_id = v_house_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Grants
-- -----------------------------------------------------------------------------

revoke all on function
  private.log_transfer_leg(uuid, bigint, bigint, uuid, bigint, bigint, numeric, text, bigint),
  private.assert_transfer_leg_open(public.activity_log)
from public, anon, authenticated;

revoke all on function
  public.record_balance_transfer(bigint, bigint, numeric, text, uuid),
  public.void_balance_transfer(uuid, text, uuid)
from public, anon;
grant execute on function
  public.record_balance_transfer(bigint, bigint, numeric, text, uuid),
  public.void_balance_transfer(uuid, text, uuid)
to authenticated;
