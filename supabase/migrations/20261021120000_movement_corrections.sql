-- Correct a cash move recorded by mistake (product owner, 2026-10-21).
--
-- An admin recharged $1000 instead of $100. Taking the difference back with a
-- payout would record a payment that never happened (Diario and Mensual would
-- show $1000 in and $900 out). The ledger stays append-only: a move is never
-- edited or deleted, it is corrected by another row linked to it.
--
-- * activity_log.corrects_id: the move a row corrects. A correction has the
--   same type as that move (`recharge` / `payout`), its payment method, bank
--   and game session, and `amount` = correct signed amount - original amount.
--   So every sum by type (game session report, Diario, Mensual, the player's
--   totals) nets to the correct amount without knowing about corrections.
--   `note` is the reason (required). One correction per move; a correction
--   can't be corrected. A correct amount of 0 voids the move.
-- * activity_log.settlement_id: the settlement (its game session) a move was
--   recorded from (settlement_receive / settlement_payout), set from now on.
--   Correcting such a move also corrects settlement_players.received / paid.
-- * correct_movement: admin only, by request_id. The money moves where the
--   original move put it, so a move can only be corrected while that money is
--   still there ('movement_closed' otherwise):
--     - in a game session: while that game session is active;
--     - on the account: while no game session of the house started after it
--       and the player isn't playing the active one;
--     - from a settlement: while that settlement is open.
-- Additive: no existing call changes (log_activity and record_cash take a
-- new last argument with a default).

alter table public.activity_log
  add column corrects_id bigint references public.activity_log (id),
  add column settlement_id bigint references public.settlements (game_session_id) on delete set null,
  add constraint activity_log_correction_check check (
    corrects_id is null or (type in ('recharge', 'payout') and note is not null)
  );

create unique index activity_log_corrects_id_key
  on public.activity_log (corrects_id) where corrects_id is not null;

-- -----------------------------------------------------------------------------
-- 1. Ledger writer and cash helper: the settlement of a move
-- -----------------------------------------------------------------------------

drop function private.log_activity(
  uuid, bigint, bigint, text, bigint, bigint, integer, bigint, numeric, text, text, text
);

create function private.log_activity(
  p_request_id uuid,
  p_house_id bigint,
  p_game_session_id bigint,
  p_type text,
  p_round_id bigint default null,
  p_ticket_id bigint default null,
  p_number integer default null,
  p_player_id bigint default null,
  p_amount numeric default null,
  p_payment_method text default null,
  p_note text default null,
  p_bank text default null,
  p_settlement_id bigint default null,
  p_corrects_id bigint default null
)
returns void
language sql
set search_path = ''
as $$
  insert into public.activity_log (
    request_id, house_id, game_session_id, type, round_id, ticket_id, number,
    player_id, amount, payment_method, note, bank, settlement_id, corrects_id
  )
  values (
    p_request_id, p_house_id, p_game_session_id, p_type, p_round_id, p_ticket_id, p_number,
    p_player_id, p_amount, p_payment_method, p_note, p_bank, p_settlement_id, p_corrects_id
  );
$$;

drop function private.record_cash(bigint, bigint, numeric, text, text, text, uuid, text);

create function private.record_cash(
  p_house_id bigint,
  p_player_id bigint,
  p_amount numeric,
  p_type text,
  p_payment_method text,
  p_note text,
  p_request_id uuid,
  p_bank text,
  p_settlement_id bigint default null
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
    p_payment_method => p_payment_method, p_note => nullif(trim(p_note), ''),
    p_bank => p_bank, p_settlement_id => p_settlement_id
  );
  return v_balance;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Settlement moves remember their settlement (bodies otherwise unchanged)
-- -----------------------------------------------------------------------------

create or replace function public.settlement_receive(
  p_game_session_id bigint,
  p_player_id bigint,
  p_amount numeric,
  p_payment_method text,
  p_note text,
  p_request_id uuid,
  p_bank text default null
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
    v_settlement.house_id, p_player_id, p_amount, 'recharge', p_payment_method, p_note,
    p_request_id, p_bank, p_game_session_id
  );
  update public.settlement_players
  set received = received + p_amount,
      resolution = case when v_balance >= 0 then 'paid_in' else resolution end,
      note = case when v_balance >= 0 then null else note end,
      resolved_at = case when v_balance >= 0 then now() else resolved_at end
  where game_session_id = p_game_session_id and player_id = p_player_id;
end;
$$;

create or replace function public.settlement_payout(
  p_game_session_id bigint,
  p_player_id bigint,
  p_amount numeric,
  p_payment_method text,
  p_note text,
  p_request_id uuid,
  p_bank text default null
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
    v_settlement.house_id, p_player_id, -p_amount, 'payout', p_payment_method, p_note,
    p_request_id, p_bank, p_game_session_id
  );
  update public.settlement_players
  set paid = paid + p_amount,
      resolution = case when v_balance <= 0 then 'paid_out' else resolution end,
      note = case when v_balance <= 0 then null else note end,
      resolved_at = case when v_balance <= 0 then now() else resolved_at end
  where game_session_id = p_game_session_id and player_id = p_player_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Correct a move
-- -----------------------------------------------------------------------------

-- p_amount: the correct amount of the move (>= 0, 0 voids it). p_reason is
-- required and becomes the correction's note.
create function public.correct_movement(
  p_movement_id bigint,
  p_amount numeric,
  p_reason text,
  p_request_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_move public.activity_log;
  v_reason text := nullif(btrim(p_reason), '');
  v_diff numeric;
  v_session_player_id bigint;
  v_balance numeric;
  v_settlement_status text;
begin
  -- Locks the move: two corrections of it are serialized.
  select a.* into v_move from public.activity_log a where a.id = p_movement_id for update;
  if not found then
    raise exception 'movement_not_found' using errcode = 'P0002';
  end if;
  perform private.require_admin(v_move.house_id);
  if v_move.type not in ('recharge', 'payout') or v_move.corrects_id is not null
     or v_move.player_id is null then
    raise exception 'movement_not_correctable' using errcode = '22023';
  end if;
  if p_amount is null or p_amount < 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  if v_reason is null or char_length(v_reason) > 200 then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  if not private.claim_request(p_request_id) then
    return;
  end if;
  if exists (select 1 from public.activity_log a where a.corrects_id = v_move.id) then
    raise exception 'movement_already_corrected' using errcode = '22023';
  end if;

  v_diff := case when v_move.type = 'recharge' then p_amount else -p_amount end - v_move.amount;
  if v_diff = 0 then
    raise exception 'amount_unchanged' using errcode = '22023';
  end if;

  if v_move.settlement_id is not null then
    select s.status into v_settlement_status
    from public.settlements s where s.game_session_id = v_move.settlement_id
    for update;
    if v_settlement_status is distinct from 'open' then
      raise exception 'movement_closed' using errcode = '22023';
    end if;
  end if;

  if v_move.game_session_id is not null then
    -- The money is in that game session while it is active.
    perform 1 from public.game_sessions gs
    where gs.id = v_move.game_session_id and gs.status = 'active'
    for update;
    if not found then
      raise exception 'movement_closed' using errcode = '22023';
    end if;
    select gsp.id into v_session_player_id
    from public.game_session_players gsp
    where gsp.game_session_id = v_move.game_session_id and gsp.player_id = v_move.player_id
    for update;
    perform private.move_cash(v_session_player_id, v_diff);
    select gsp.balance into v_balance from public.game_session_players gsp where gsp.id = v_session_player_id;
  else
    -- The money is on the account until a game session takes it.
    if exists (
      select 1 from public.game_sessions gs
      where gs.house_id = v_move.house_id and gs.started_at > v_move.created_at
    ) or (private.active_session_player(v_move.house_id, v_move.player_id)).id is not null then
      raise exception 'movement_closed' using errcode = '22023';
    end if;
    perform private.move_account_cash(v_move.house_id, v_move.player_id, v_diff);
    select a.balance into v_balance from public.player_accounts a where a.player_id = v_move.player_id;
  end if;

  perform private.log_activity(
    p_request_id, v_move.house_id, v_move.game_session_id, v_move.type,
    p_round_id => (
      select r.id from public.game_session_rounds r
      where r.game_session_id = v_move.game_session_id and r.status = 'open'
    ),
    p_player_id => v_move.player_id, p_amount => v_diff,
    p_payment_method => v_move.payment_method, p_note => v_reason, p_bank => v_move.bank,
    p_settlement_id => v_move.settlement_id, p_corrects_id => v_move.id
  );

  -- A settlement move: its total and the player's resolution follow the
  -- correct amount, with the same rules as settlement_receive / _payout.
  if v_move.settlement_id is not null then
    if v_move.type = 'recharge' then
      update public.settlement_players
      set received = received + v_diff,
          resolution = case
            when v_balance >= 0 and resolution is null then 'paid_in'
            when v_balance < 0 and resolution = 'paid_in' then null
            else resolution
          end,
          resolved_at = case
            when v_balance >= 0 and resolution is null then now()
            when v_balance < 0 and resolution = 'paid_in' then null
            else resolved_at
          end
      where game_session_id = v_move.settlement_id and player_id = v_move.player_id;
    else
      update public.settlement_players
      set paid = paid - v_diff,
          resolution = case
            when v_balance <= 0 and resolution is null then 'paid_out'
            when v_balance > 0 and resolution = 'paid_out' then null
            else resolution
          end,
          resolved_at = case
            when v_balance <= 0 and resolution is null then now()
            when v_balance > 0 and resolution = 'paid_out' then null
            else resolved_at
          end
      where game_session_id = v_move.settlement_id and player_id = v_move.player_id;
    end if;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Grants
-- -----------------------------------------------------------------------------

revoke all on function
  private.log_activity(
    uuid, bigint, bigint, text, bigint, bigint, integer, bigint, numeric, text, text, text, bigint, bigint
  ),
  private.record_cash(bigint, bigint, numeric, text, text, text, uuid, text, bigint)
from public, anon, authenticated;

revoke all on function public.correct_movement(bigint, numeric, text, uuid) from public, anon;
grant execute on function public.correct_movement(bigint, numeric, text, uuid) to authenticated;
