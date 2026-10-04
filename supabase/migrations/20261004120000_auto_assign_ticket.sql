-- Automatic ticket assignment (priority by ticket).
--
-- The host chooses the number (line) and the player; the database chooses the
-- ticket: the one with the lowest `index` where that number is still free.
-- Each number has its own row of tickets, independent of the others. No data
-- is migrated: purchases already made stay where they are.
--
-- * private.first_free_ticket: the one place that walks the tickets of a game
--   session by index (a future "compact the row of N" must reuse it).
-- * record_purchase(p_game_session_id, p_number, p_player_id, p_request_id)
--   replaces record_purchase(p_ticket_id, ...) and returns the ticket it chose.
-- * edit_player_numbers ("Editar jugada"): buying a free number no longer
--   trusts the ticket the dialog sent; it goes to the first free ticket too.
--   Taking a number from another player and releasing stay positional.

create function private.first_free_ticket(p_game_session_id bigint, p_number integer)
returns bigint
language sql
stable
set search_path = ''
as $$
  select t.id
  from public.tickets t
  join public.ticket_numbers tn on tn.ticket_id = t.id
  where t.game_session_id = p_game_session_id
    and tn.number = p_number
    and tn.player_id is null
  order by t.index
  limit 1;
$$;

drop function public.record_purchase(bigint, integer, bigint, uuid);

-- Claim the lowest free ticket for a number. Raises invalid_number outside
-- 1-15 and no_free_ticket when every ticket has that number taken.
-- TODO(decision): with no free ticket the purchase is blocked; the product
-- owner still has to choose between opening a new ticket automatically,
-- blocking, or only warning.
create function public.record_purchase(
  p_game_session_id bigint,
  p_number integer,
  p_player_id bigint,
  p_request_id uuid
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_house_id bigint := private.lock_game_session(p_game_session_id);
  v_round public.game_session_rounds;
  v_ticket_id bigint;
begin
  if p_number is null or p_number < 1 or p_number > 15 then
    raise exception 'invalid_number' using errcode = '22023';
  end if;
  if not private.claim_request(p_request_id) then
    -- A retry: answer with the ticket the first call chose.
    select a.ticket_id into v_ticket_id
    from public.activity_log a
    where a.request_id = p_request_id and a.type = 'number_purchased';
    return v_ticket_id;
  end if;
  v_round := private.open_round(p_game_session_id);
  v_ticket_id := private.first_free_ticket(p_game_session_id, p_number);
  if v_ticket_id is null then
    raise exception 'no_free_ticket';
  end if;
  perform private.ensure_session_player(
    v_house_id, p_game_session_id, p_player_id, private.request_id_for(p_request_id, 1)
  );
  perform private.apply_purchase(v_house_id, v_round, v_ticket_id, p_number, p_player_id, p_request_id);
  return v_ticket_id;
end;
$$;

revoke all on function public.record_purchase(bigint, integer, bigint, uuid) from public, anon;
grant execute on function public.record_purchase(bigint, integer, bigint, uuid) to authenticated;

revoke all on function private.first_free_ticket(bigint, integer) from public, anon, authenticated;

-- "Editar jugada": same as before, except that a free number is bought on the
-- first free ticket, not on the position the dialog sent.
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
begin
  if not private.claim_request(p_request_id) then
    return;
  end if;
  if jsonb_typeof(p_changes) is distinct from 'array' then
    raise exception 'invalid_changes' using errcode = '22023';
  end if;
  v_round := private.open_round(p_game_session_id);
  perform private.ensure_session_player(
    v_house_id, p_game_session_id, p_player_id, private.request_id_for(p_request_id, 0)
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
    elsif v_owner is not null then
      raise exception 'number_owner_changed';
    end if;
  end loop;
end;
$$;
