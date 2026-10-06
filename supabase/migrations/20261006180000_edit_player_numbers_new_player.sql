-- Fix: adding a player who is not in the game session yet through
-- edit_player_numbers (the "Agregar jugador" dialog of /active-round) failed
-- with a duplicate activity_log.request_id. Only the request id handed to
-- ensure_session_player changes; the rest of the function is the same as in
-- *_compact_ticket_rows.sql.

create or replace function public.edit_player_numbers(
  p_game_session_id bigint,
  p_player_id bigint,
  p_changes jsonb,
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
  v_change record;
  v_ticket_id bigint;
  v_owner bigint;
  v_is_gift boolean;
  v_n integer := 1;
  v_released integer[] := '{}';
  v_number integer;
  v_c integer := 1000;
begin
  if not private.claim_request(p_request_id) then
    return;
  end if;
  if jsonb_typeof(p_changes) is distinct from 'array' then
    raise exception 'invalid_changes' using errcode = '22023';
  end if;
  v_round := private.open_round(p_game_session_id);
  -- ensure_session_player logs `player_added` with the id it receives and
  -- `balance_opened` with an id derived from it. It used p_request_id itself,
  -- so for a player new to the game session `balance_opened` collided with the
  -- first purchase of the loop (request_id_for(p_request_id, 1)) and the whole
  -- edit failed with activity_log_request_id_key. The ids of the loop are
  -- 1.. and the compaction ones 1000.., so 5000 stays clear of both.
  perform private.ensure_session_player(
    v_house_id, p_game_session_id, p_player_id, private.request_id_for(p_request_id, 5000)
  );

  for v_change in
    select * from jsonb_to_recordset(p_changes)
      as x (ticket_id bigint, number integer, owned boolean, is_gift boolean, expected_owner_id bigint)
  loop
    v_ticket_id := v_change.ticket_id;
    select tn.player_id, tn.is_gift into v_owner, v_is_gift
    from public.ticket_numbers tn
    where tn.ticket_id = v_ticket_id
      and tn.number = v_change.number
      and tn.game_session_id = p_game_session_id;
    if not found then
      raise exception 'number_not_found' using errcode = 'P0002';
    end if;

    if coalesce(v_change.owned, false) then
      if v_owner is null then
        v_ticket_id := private.first_free_ticket(p_game_session_id, v_change.number);
        perform private.apply_purchase(
          v_house_id, v_round, v_ticket_id, v_change.number, p_player_id,
          private.request_id_for(p_request_id, v_n)
        );
        v_n := v_n + 1;
        v_is_gift := false;
      elsif v_owner <> p_player_id then
        if v_change.expected_owner_id is distinct from v_owner then
          raise exception 'number_owner_changed';
        end if;
        perform private.apply_reassign(
          v_house_id, v_round, v_ticket_id, v_change.number,
          v_change.expected_owner_id, p_player_id,
          private.request_id_for(p_request_id, v_n), private.request_id_for(p_request_id, v_n + 1)
        );
        v_n := v_n + 2;
        v_is_gift := false;
      end if;
      if coalesce(v_change.is_gift, false) <> v_is_gift then
        perform private.apply_toggle_gift(
          v_house_id, v_round, v_ticket_id, v_change.number, p_player_id,
          private.request_id_for(p_request_id, v_n)
        );
        v_n := v_n + 1;
      end if;
    elsif v_owner = p_player_id then
      perform private.apply_release(
        v_house_id, v_round, v_ticket_id, v_change.number, p_player_id,
        private.request_id_for(p_request_id, v_n)
      );
      v_n := v_n + 1;
      if not v_change.number = any(v_released) then
        v_released := v_released || v_change.number;
      end if;
    elsif v_owner is not null then
      raise exception 'number_owner_changed';
    end if;
  end loop;

  foreach v_number in array v_released loop
    perform private.compact_line(
      v_house_id, p_game_session_id, v_number, private.request_id_for(p_request_id, v_c)
    );
    v_c := v_c + 1;
  end loop;
end;
$$;
