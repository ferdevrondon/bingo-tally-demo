-- Rule 2: freeing a play compacts the row of its number.
--
-- A play is (player, gift flag) on a number of a ticket. When one is freed,
-- the plays of the same number on higher tickets move one ticket down, so the
-- first tickets stay full. Only the ticket changes: the number never does
-- (each number pays different prizes), and no money moves. Each moved play
-- gets a `number_moved` row in the activity log (destination ticket in
-- ticket_id, origin ticket index in note).
--
-- Not compacted while the open round already has winning numbers entered:
-- moving plays would change who holds a winning number. The hole stays and
-- the next purchases fill it (first_free_ticket).
--
-- Called after: release_number, edit_player_numbers (once per freed number,
-- at the end), remove_player, resolve_carryover. reassign_number moves nothing.
-- No data is migrated: old holes close the first time their number is compacted.

alter table public.activity_log
  drop constraint activity_log_type_check,
  add constraint activity_log_type_check check (type in (
    'game_session_started', 'game_session_ended',
    'player_added', 'player_removed',
    'ticket_added',
    'number_purchased', 'number_released', 'number_reassigned', 'number_moved',
    'number_gifted', 'number_ungifted',
    'recharge', 'check_in', 'check_in_undone',
    'round_started', 'round_closed', 'prize_won', 'margin_adjustment',
    'carryover_kept', 'carryover_released',
    'payout', 'adjustment',
    'balance_opened', 'balance_closed',
    'credit_kept_for_play', 'credit_payout_pending', 'debt_noted',
    'settlement_closed'
  ));

-- Packs the plays of one number towards the lowest tickets, keeping their
-- order. Returns how many plays moved.
create function private.compact_line(
  p_house_id bigint,
  p_game_session_id bigint,
  p_number integer,
  p_request_id uuid
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_round public.game_session_rounds;
  v_row record;
  v_moved integer := 0;
begin
  select r.* into v_round
  from public.game_session_rounds r
  where r.game_session_id = p_game_session_id and r.status = 'open';
  if not found or private.round_has_awards(v_round) then
    return 0;
  end if;

  for v_row in
    with slots as (
      select t.id as ticket_id, t.index,
             row_number() over (order by t.index) as rn,
             tn.player_id, tn.is_gift
      from public.tickets t
      join public.ticket_numbers tn on tn.ticket_id = t.id and tn.number = p_number
      where t.game_session_id = p_game_session_id
    ),
    holders as (
      select s.player_id, s.is_gift, s.index as from_index,
             row_number() over (order by s.index) as hn
      from slots s
      where s.player_id is not null
    )
    select s.ticket_id, s.player_id as cur_player, s.is_gift as cur_gift,
           h.player_id as new_player, coalesce(h.is_gift, false) as new_gift,
           h.from_index
    from slots s
    left join holders h on h.hn = s.rn
    order by s.index
  loop
    if v_row.cur_player is distinct from v_row.new_player or v_row.cur_gift is distinct from v_row.new_gift then
      update public.ticket_numbers
      set player_id = v_row.new_player, is_gift = v_row.new_gift
      where ticket_id = v_row.ticket_id and number = p_number;
      if v_row.new_player is not null then
        v_moved := v_moved + 1;
        perform private.log_activity(
          private.request_id_for(p_request_id, v_moved), p_house_id, p_game_session_id,
          'number_moved', v_round.id, v_row.ticket_id, p_number, v_row.new_player, 0,
          p_note => v_row.from_index::text
        );
      end if;
    end if;
  end loop;
  return v_moved;
end;
$$;

revoke all on function private.compact_line(bigint, bigint, integer, uuid) from public, anon, authenticated;

-- release_number -------------------------------------------------------------

create or replace function public.release_number(p_ticket_id bigint, p_number integer, p_player_id bigint, p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game_session_id bigint := private.ticket_game_session(p_ticket_id);
  v_house_id bigint := private.lock_game_session(v_game_session_id);
begin
  if not private.claim_request(p_request_id) then
    return;
  end if;
  perform private.apply_release(
    v_house_id, private.open_round(v_game_session_id), p_ticket_id, p_number, p_player_id, p_request_id
  );
  perform private.compact_line(
    v_house_id, v_game_session_id, p_number, private.request_id_for(p_request_id, 100)
  );
end;
$$;

-- remove_player --------------------------------------------------------------

create or replace function public.remove_player(p_game_session_id bigint, p_player_id bigint, p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_house_id bigint := private.lock_game_session(p_game_session_id);
  v_session_player_id bigint;
  v_numbers integer[];
  v_number integer;
  v_n integer := 100;
begin
  if not private.claim_request(p_request_id) then
    return;
  end if;
  v_session_player_id := private.session_player(p_game_session_id, p_player_id);

  select coalesce(array_agg(distinct tn.number order by tn.number), '{}') into v_numbers
  from public.ticket_numbers tn
  where tn.game_session_id = p_game_session_id and tn.player_id = p_player_id;

  update public.ticket_numbers
  set player_id = null, is_gift = false
  where game_session_id = p_game_session_id and player_id = p_player_id;
  update public.game_session_players
  set removed_at = now(), checked_in = false, pending_carryover = false
  where id = v_session_player_id;

  perform private.log_activity(
    p_request_id, v_house_id, p_game_session_id, 'player_removed',
    p_player_id => p_player_id, p_amount => 0
  );

  foreach v_number in array v_numbers loop
    perform private.compact_line(
      v_house_id, p_game_session_id, v_number, private.request_id_for(p_request_id, v_n)
    );
    v_n := v_n + 1;
  end loop;
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

  foreach v_number in array v_numbers loop
    perform private.compact_line(
      v_house_id, p_game_session_id, v_number, private.request_id_for(p_request_id, v_c)
    );
    v_c := v_c + 1;
  end loop;
end;
$$;

-- edit_player_numbers --------------------------------------------------------
-- Same as the auto-assign version, plus: the numbers freed by the edit are
-- compacted once, after every change was applied (the positions the dialog
-- sent must not shift in the middle of the edit).

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
