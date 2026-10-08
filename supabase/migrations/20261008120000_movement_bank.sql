-- The bank of each cash move (product owner, 2026-10-07).
--
-- "Recibir pago" and "Registrar pago" (/players, the settlement) and the
-- recharge in the live game now ask for the bank ("Entidad bancaria
-- (ingreso)") next to the payment method ("Método de pago (salida)"), both
-- prefilled from the player and stored on the ledger row of that move.
--
-- * activity_log.bank: nullable, same values as players.bank. Older rows and
--   rows that aren't cash moves have none.
-- * The ledger is append-only, so the bank goes in when the row is written:
--   private.log_activity and private.record_cash take p_bank.
-- * The five public cash functions take p_bank (default null) as their last
--   argument: record_account_recharge, record_account_payout,
--   settlement_receive, settlement_payout and record_recharge. Their bodies
--   are unchanged apart from passing it on.

alter table public.activity_log
  add column bank text
  check (bank in (
    'chase', 'bank_of_america', 'td_bank', 'wells_fargo', 'chime',
    'capital_one', 'first_one_bank', 'ufcu_bank', 'regional_bank', 'southwest_bank',
    'southstate_bank', 'frost_bank', 'mid_bank', 'pnc_business', 'pnc_personal',
    'other'
  ));

-- -----------------------------------------------------------------------------
-- 1. Ledger writer
-- -----------------------------------------------------------------------------

drop function private.log_activity(
  uuid, bigint, bigint, text, bigint, bigint, integer, bigint, numeric, text, text
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
  p_bank text default null
)
returns void
language sql
set search_path = ''
as $$
  insert into public.activity_log (
    request_id, house_id, game_session_id, type, round_id, ticket_id, number,
    player_id, amount, payment_method, note, bank
  )
  values (
    p_request_id, p_house_id, p_game_session_id, p_type, p_round_id, p_ticket_id, p_number,
    p_player_id, p_amount, p_payment_method, p_note, p_bank
  );
$$;

-- -----------------------------------------------------------------------------
-- 2. Cash moves
-- -----------------------------------------------------------------------------

drop function private.record_cash(bigint, bigint, numeric, text, text, text, uuid);

create function private.record_cash(
  p_house_id bigint,
  p_player_id bigint,
  p_amount numeric,
  p_type text,
  p_payment_method text,
  p_note text,
  p_request_id uuid,
  p_bank text
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
    p_bank => p_bank
  );
  return v_balance;
end;
$$;

drop function public.record_account_recharge(bigint, numeric, text, text, uuid);
drop function public.record_account_payout(bigint, numeric, text, text, uuid);
drop function public.settlement_receive(bigint, bigint, numeric, text, text, uuid);
drop function public.settlement_payout(bigint, bigint, numeric, text, text, uuid);
drop function public.record_recharge(bigint, bigint, numeric, text, text, uuid);

create function public.record_account_recharge(
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
    v_house_id, p_player_id, p_amount, 'recharge', p_payment_method, p_note, p_request_id, p_bank
  );
end;
$$;

create function public.record_account_payout(
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
    v_house_id, p_player_id, -p_amount, 'payout', p_payment_method, p_note, p_request_id, p_bank
  );
end;
$$;

-- Collect from a player in the settlement: `paid_in` once the balance is >= 0.
create function public.settlement_receive(
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
    p_request_id, p_bank
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
    p_request_id, p_bank
  );
  update public.settlement_players
  set paid = paid + p_amount,
      resolution = case when v_balance <= 0 then 'paid_out' else resolution end,
      note = case when v_balance <= 0 then null else note end,
      resolved_at = case when v_balance <= 0 then now() else resolved_at end
  where game_session_id = p_game_session_id and player_id = p_player_id;
end;
$$;

-- Recharge: cash in. Adds to the player's balance; not part of the house result.
create function public.record_recharge(
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
  v_house_id bigint := private.lock_game_session(p_game_session_id);
  v_session_player_id bigint;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  if p_payment_method is null then
    raise exception 'payment_method_required' using errcode = '22023';
  end if;
  if not private.claim_request(p_request_id) then
    return;
  end if;

  v_session_player_id := private.ensure_session_player(
    v_house_id, p_game_session_id, p_player_id, private.request_id_for(p_request_id, 1)
  );
  perform private.move_cash(v_session_player_id, p_amount);

  perform private.log_activity(
    p_request_id, v_house_id, p_game_session_id, 'recharge',
    p_round_id => (
      select r.id from public.game_session_rounds r
      where r.game_session_id = p_game_session_id and r.status = 'open'
    ),
    p_player_id => p_player_id, p_amount => p_amount,
    p_payment_method => p_payment_method, p_note => nullif(trim(p_note), ''),
    p_bank => p_bank
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Grants (same as before, on the new signatures)
-- -----------------------------------------------------------------------------

revoke all on function
  public.record_account_recharge(bigint, numeric, text, text, uuid, text),
  public.record_account_payout(bigint, numeric, text, text, uuid, text),
  public.settlement_receive(bigint, bigint, numeric, text, text, uuid, text),
  public.settlement_payout(bigint, bigint, numeric, text, text, uuid, text),
  public.record_recharge(bigint, bigint, numeric, text, text, uuid, text)
from public, anon;
grant execute on function
  public.record_account_recharge(bigint, numeric, text, text, uuid, text),
  public.record_account_payout(bigint, numeric, text, text, uuid, text),
  public.settlement_receive(bigint, bigint, numeric, text, text, uuid, text),
  public.settlement_payout(bigint, bigint, numeric, text, text, uuid, text),
  public.record_recharge(bigint, bigint, numeric, text, text, uuid, text)
to authenticated;

revoke all on function
  private.log_activity(uuid, bigint, bigint, text, bigint, bigint, integer, bigint, numeric, text, text, text),
  private.record_cash(bigint, bigint, numeric, text, text, text, uuid, text)
from public, anon, authenticated;
