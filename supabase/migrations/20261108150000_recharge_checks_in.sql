-- A recharge in the live game also checks the player in (business rule A):
-- when a round is open and the player is not checked in yet, recording their
-- recharge puts them in the round, in the same transaction, with a `check_in`
-- row whose note is 'recharge' (like resolve_carryover's 'auto' one,
-- *_carryover_lock_and_auto_check_in.sql). Nothing changes when they are
-- already checked in, or when they still have to keep or release their
-- numbers (pending_carryover): they decide first, as record_check_in asks.
-- Correcting the recharge later does not undo the check-in.
--
-- Same body as *_movement_bank.sql otherwise; same signature.

create or replace function public.record_recharge(
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
  v_round_id bigint;
  v_checked_in boolean;
  v_pending boolean;
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

  select r.id into v_round_id
  from public.game_session_rounds r
  where r.game_session_id = p_game_session_id and r.status = 'open';

  perform private.log_activity(
    p_request_id, v_house_id, p_game_session_id, 'recharge',
    p_round_id => v_round_id,
    p_player_id => p_player_id, p_amount => p_amount,
    p_payment_method => p_payment_method, p_note => nullif(trim(p_note), ''),
    p_bank => p_bank
  );

  -- The recharge puts the player in the open round.
  if v_round_id is not null then
    select gsp.checked_in, gsp.pending_carryover into v_checked_in, v_pending
    from public.game_session_players gsp
    where gsp.id = v_session_player_id;
    if not v_checked_in and not v_pending then
      update public.game_session_players set checked_in = true where id = v_session_player_id;
      perform private.log_activity(
        private.request_id_for(p_request_id, 2), v_house_id, p_game_session_id, 'check_in',
        p_round_id => v_round_id, p_player_id => p_player_id, p_note => 'recharge'
      );
    end if;
  end if;
end;
$$;

revoke all on function public.record_recharge(bigint, bigint, numeric, text, text, uuid, text)
  from public, anon;
grant execute on function public.record_recharge(bigint, bigint, numeric, text, text, uuid, text)
  to authenticated;
