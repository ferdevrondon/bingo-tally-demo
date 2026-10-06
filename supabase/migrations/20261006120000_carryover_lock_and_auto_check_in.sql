-- A player who still has to keep or release their numbers (pending_carryover,
-- set when a round closes) can't change their play, and gets an automatic
-- check-in when they decide.
--
-- 1. Lock: while pending_carryover is set, buying, releasing, reassigning (from
--    or to the player) and gifting/un-gifting raise 'pending_carryover'. Only
--    resolve_carryover can touch the play. Without it, a number bought before
--    deciding was charged twice (purchase + the kept charge of resolve_carryover)
--    and a number released before deciding refunded a charge that had not
--    been made in the new round. The lock lives in the four private.apply_*
--    helpers, so record_purchase, release_number, reassign_number, toggle_gift
--    and edit_player_numbers are all covered.
-- 2. Auto check-in: keeping or partly releasing is already a confirmation that
--    the player stays in the round, so resolve_carryover checks them in (a
--    `check_in` row with note 'auto') when they still hold at least one
--    number. Releasing everything leaves them without check-in: when they buy
--    numbers again, the regular check-in applies.

create function private.assert_no_pending_carryover(p_game_session_id bigint, p_player_id bigint)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.game_session_players gsp
    where gsp.game_session_id = p_game_session_id
      and gsp.player_id = p_player_id
      and gsp.removed_at is null
      and gsp.pending_carryover
  ) then
    raise exception 'pending_carryover';
  end if;
end;
$$;

revoke all on function private.assert_no_pending_carryover(bigint, bigint) from public, anon, authenticated;


-- apply_purchase
create or replace function private.apply_purchase(
  p_house_id bigint,
  p_round public.game_session_rounds,
  p_ticket_id bigint,
  p_number integer,
  p_player_id bigint,
  p_request_id uuid
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_owner bigint;
  v_session_player_id bigint;
begin
  perform private.assert_no_pending_carryover(p_round.game_session_id, p_player_id);
  select tn.player_id into v_owner
  from public.ticket_numbers tn
  where tn.ticket_id = p_ticket_id
    and tn.number = p_number
    and tn.game_session_id = p_round.game_session_id
  for update;
  if not found then
    raise exception 'number_not_found' using errcode = 'P0002';
  end if;
  if v_owner is not null then
    raise exception 'number_taken';
  end if;

  v_session_player_id := private.session_player(p_round.game_session_id, p_player_id);
  update public.ticket_numbers
  set player_id = p_player_id, is_gift = false
  where ticket_id = p_ticket_id and number = p_number;
  perform private.charge_player(v_session_player_id, p_round.line_price);
  perform private.log_activity(
    p_request_id, p_house_id, p_round.game_session_id, 'number_purchased',
    p_round.id, p_ticket_id, p_number, p_player_id, p_round.line_price
  );
end;
$$;

-- apply_release
create or replace function private.apply_release(
  p_house_id bigint,
  p_round public.game_session_rounds,
  p_ticket_id bigint,
  p_number integer,
  p_player_id bigint,
  p_request_id uuid
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_owner bigint;
  v_is_gift boolean;
  v_session_player_id bigint;
begin
  perform private.assert_no_pending_carryover(p_round.game_session_id, p_player_id);
  select tn.player_id, tn.is_gift into v_owner, v_is_gift
  from public.ticket_numbers tn
  where tn.ticket_id = p_ticket_id
    and tn.number = p_number
    and tn.game_session_id = p_round.game_session_id
  for update;
  if not found then
    raise exception 'number_not_found' using errcode = 'P0002';
  end if;
  if v_owner is distinct from p_player_id then
    raise exception 'number_not_owned';
  end if;

  v_session_player_id := private.session_player(p_round.game_session_id, p_player_id);
  update public.ticket_numbers
  set player_id = null, is_gift = false
  where ticket_id = p_ticket_id and number = p_number;
  -- A gifted number was never paid for: nothing to refund.
  if not v_is_gift then
    perform private.credit_player(v_session_player_id, p_round.line_price);
  end if;
  perform private.log_activity(
    p_request_id, p_house_id, p_round.game_session_id, 'number_released',
    p_round.id, p_ticket_id, p_number, p_player_id,
    case when v_is_gift then 0 else -p_round.line_price end
  );
end;
$$;

-- apply_reassign
create or replace function private.apply_reassign(
  p_house_id bigint,
  p_round public.game_session_rounds,
  p_ticket_id bigint,
  p_number integer,
  p_expected_owner_id bigint,
  p_new_owner_id bigint,
  p_request_id_previous uuid,
  p_request_id_new uuid
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_owner bigint;
  v_is_gift boolean;
  v_previous_session_player_id bigint;
  v_new_session_player_id bigint;
begin
  perform private.assert_no_pending_carryover(p_round.game_session_id, p_expected_owner_id);
  perform private.assert_no_pending_carryover(p_round.game_session_id, p_new_owner_id);
  if p_expected_owner_id is null or p_new_owner_id is null
     or p_expected_owner_id = p_new_owner_id then
    raise exception 'invalid_reassign' using errcode = '22023';
  end if;

  select tn.player_id, tn.is_gift into v_owner, v_is_gift
  from public.ticket_numbers tn
  where tn.ticket_id = p_ticket_id
    and tn.number = p_number
    and tn.game_session_id = p_round.game_session_id
  for update;
  if not found then
    raise exception 'number_not_found' using errcode = 'P0002';
  end if;
  if v_owner is distinct from p_expected_owner_id then
    raise exception 'number_owner_changed';
  end if;

  v_previous_session_player_id := private.session_player(p_round.game_session_id, p_expected_owner_id);
  v_new_session_player_id := private.session_player(p_round.game_session_id, p_new_owner_id);

  update public.ticket_numbers
  set player_id = p_new_owner_id, is_gift = false
  where ticket_id = p_ticket_id and number = p_number;

  if not v_is_gift then
    perform private.credit_player(v_previous_session_player_id, p_round.line_price);
  end if;
  perform private.log_activity(
    p_request_id_previous, p_house_id, p_round.game_session_id, 'number_reassigned',
    p_round.id, p_ticket_id, p_number, p_expected_owner_id,
    case when v_is_gift then 0 else -p_round.line_price end
  );

  perform private.charge_player(v_new_session_player_id, p_round.line_price);
  perform private.log_activity(
    p_request_id_new, p_house_id, p_round.game_session_id, 'number_reassigned',
    p_round.id, p_ticket_id, p_number, p_new_owner_id, p_round.line_price
  );
end;
$$;

-- apply_toggle_gift
create or replace function private.apply_toggle_gift(
  p_house_id bigint,
  p_round public.game_session_rounds,
  p_ticket_id bigint,
  p_number integer,
  p_player_id bigint,
  p_request_id uuid
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_owner bigint;
  v_is_gift boolean;
  v_session_player_id bigint;
begin
  perform private.assert_no_pending_carryover(p_round.game_session_id, p_player_id);
  select tn.player_id, tn.is_gift into v_owner, v_is_gift
  from public.ticket_numbers tn
  where tn.ticket_id = p_ticket_id
    and tn.number = p_number
    and tn.game_session_id = p_round.game_session_id
  for update;
  if not found then
    raise exception 'number_not_found' using errcode = 'P0002';
  end if;
  if v_owner is distinct from p_player_id then
    raise exception 'number_not_owned';
  end if;

  v_session_player_id := private.session_player(p_round.game_session_id, p_player_id);
  update public.ticket_numbers
  set is_gift = not v_is_gift
  where ticket_id = p_ticket_id and number = p_number;

  if not v_is_gift then
    perform private.credit_player(v_session_player_id, p_round.line_price);
    perform private.log_activity(
      p_request_id, p_house_id, p_round.game_session_id, 'number_gifted',
      p_round.id, p_ticket_id, p_number, p_player_id, -p_round.line_price
    );
  else
    perform private.charge_player(v_session_player_id, p_round.line_price);
    perform private.log_activity(
      p_request_id, p_house_id, p_round.game_session_id, 'number_ungifted',
      p_round.id, p_ticket_id, p_number, p_player_id, p_round.line_price
    );
  end if;
  return not v_is_gift;
end;
$$;

-- resolve_carryover ----------------------------------------------------------

create or replace function public.resolve_carryover(
  p_game_session_id bigint,
  p_player_id bigint,
  p_release jsonb,
  p_request_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_house_id bigint := private.lock_game_session(p_game_session_id);
  v_round public.game_session_rounds;
  v_session_player_id bigint;
  v_pending boolean;
  v_item record;
  v_kept integer;
  v_charge numeric;
  v_n integer := 1;
  v_numbers integer[] := '{}';
  v_number integer;
  v_c integer := 1000;
begin
  if not private.claim_request(p_request_id) then
    return;
  end if;
  v_round := private.open_round(p_game_session_id);
  v_session_player_id := private.session_player(p_game_session_id, p_player_id);
  select gsp.pending_carryover into v_pending
  from public.game_session_players gsp
  where gsp.id = v_session_player_id;
  if not v_pending then
    raise exception 'no_pending_carryover';
  end if;

  for v_item in
    select * from jsonb_to_recordset(coalesce(p_release, '[]'::jsonb))
      as x (ticket_id bigint, number integer)
  loop
    update public.ticket_numbers
    set player_id = null, is_gift = false
    where ticket_id = v_item.ticket_id
      and number = v_item.number
      and game_session_id = p_game_session_id
      and player_id = p_player_id;
    if not found then
      raise exception 'number_not_owned';
    end if;
    perform private.log_activity(
      private.request_id_for(p_request_id, v_n), v_house_id, p_game_session_id, 'carryover_released',
      v_round.id, v_item.ticket_id, v_item.number, p_player_id, 0
    );
    v_n := v_n + 1;
    if not v_item.number = any(v_numbers) then
      v_numbers := v_numbers || v_item.number;
    end if;
  end loop;

  update public.ticket_numbers
  set is_gift = false
  where game_session_id = p_game_session_id and player_id = p_player_id and is_gift;

  select count(*) into v_kept
  from public.ticket_numbers tn
  where tn.game_session_id = p_game_session_id and tn.player_id = p_player_id;
  v_charge := v_kept * v_round.line_price;

  update public.game_session_players set pending_carryover = false where id = v_session_player_id;
  perform private.charge_player(v_session_player_id, v_charge);

  perform private.log_activity(
    p_request_id, v_house_id, p_game_session_id, 'carryover_kept',
    p_round_id => v_round.id, p_player_id => p_player_id, p_amount => v_charge
  );

  -- Keeping (all or part) confirms the player stays in the round: check-in.
  if v_kept > 0 then
    update public.game_session_players set checked_in = true where id = v_session_player_id;
    perform private.log_activity(
      private.request_id_for(p_request_id, 900), v_house_id, p_game_session_id, 'check_in',
      p_round_id => v_round.id, p_player_id => p_player_id, p_note => 'auto'
    );
  end if;

  foreach v_number in array v_numbers loop
    perform private.compact_line(
      v_house_id, p_game_session_id, v_number, private.request_id_for(p_request_id, v_c)
    );
    v_c := v_c + 1;
  end loop;
end;
$$;
