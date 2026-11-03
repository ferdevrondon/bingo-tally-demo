-- Removing tickets during a game session without losing history.
--
-- Players come and go during a game session, so the admin removes and adds
-- tickets at any time. A ticket row is never deleted: ticket_numbers,
-- round_winners and activity_log cascade on it, so a delete would wipe plays
-- and ledger rows. Instead:
--
-- * tickets.removed_at marks a removed ticket (soft delete). Only an empty
--   ticket (its 15 numbers free) can be removed, so no money moves. Plays are
--   compacted toward the lowest tickets, so empty tickets are the last ones.
-- * add_ticket brings back the removed ticket with the lowest index before
--   creating a new one, so the active tickets stay numbered 1..N and the
--   history of "Cartón N" keeps pointing to the same row.
-- * game_session_rounds.tickets_count snapshots the active tickets when a
--   round closes (trigger), since a ticket's active periods can no longer be
--   derived from created_at. Rounds closed before this migration keep null and
--   the reports fall back to the created_at rule.
-- * first_free_ticket and compact_line skip removed tickets. The other walks
--   over tickets only look at taken numbers, which a removed ticket never has.
--
-- Backward compatible: older clients never remove tickets and ignore the new
-- columns.

alter table public.tickets add column removed_at timestamptz;

create index tickets_active_idx
  on public.tickets (game_session_id, index)
  where removed_at is null;

alter table public.game_session_rounds
  add column tickets_count integer check (tickets_count is null or tickets_count >= 0);

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
    'house_updated'
  ));

-- Snapshot of the active tickets when a round stops being open, whatever
-- function closes it (close_round, end_game_session, …).
create function private.snapshot_round_tickets()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'open' and new.status <> 'open' and new.tickets_count is null then
    new.tickets_count := (
      select count(*)::integer
      from public.tickets t
      where t.game_session_id = new.game_session_id and t.removed_at is null
    );
  end if;
  return new;
end;
$$;

create trigger game_session_rounds_snapshot_tickets
  before update of status on public.game_session_rounds
  for each row execute function private.snapshot_round_tickets();

create or replace function private.first_free_ticket(p_game_session_id bigint, p_number integer)
returns bigint
language sql
stable
set search_path = ''
as $$
  select t.id
  from public.tickets t
  join public.ticket_numbers tn on tn.ticket_id = t.id
  where t.game_session_id = p_game_session_id
    and t.removed_at is null
    and tn.number = p_number
    and tn.player_id is null
  order by t.index
  limit 1;
$$;

create or replace function private.compact_line(
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
        and t.removed_at is null
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

-- Adding a ticket brings back the removed one with the lowest index first.
create or replace function public.add_ticket(p_game_session_id bigint, p_request_id uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_house_id bigint := private.lock_game_session(p_game_session_id);
  v_ticket_id bigint;
begin
  if not private.claim_request(p_request_id) then
    return (select a.ticket_id from public.activity_log a where a.request_id = p_request_id);
  end if;

  select t.id into v_ticket_id
  from public.tickets t
  where t.game_session_id = p_game_session_id and t.removed_at is not null
  order by t.index
  limit 1;

  if v_ticket_id is not null then
    update public.tickets set removed_at = null where id = v_ticket_id;
    -- A removed ticket is empty; this only guards the invariant.
    update public.ticket_numbers
    set player_id = null, is_gift = false
    where ticket_id = v_ticket_id and (player_id is not null or is_gift);
    perform private.log_activity(
      p_request_id, v_house_id, p_game_session_id, 'ticket_restored', p_ticket_id => v_ticket_id
    );
    return v_ticket_id;
  end if;

  insert into public.tickets (house_id, game_session_id, index)
  select v_house_id, p_game_session_id, coalesce(max(t.index), 0) + 1
  from public.tickets t
  where t.game_session_id = p_game_session_id
  returning id into v_ticket_id;

  insert into public.ticket_numbers (house_id, game_session_id, ticket_id, number)
  select v_house_id, p_game_session_id, v_ticket_id, n
  from generate_series(1, 15) as n;

  perform private.log_activity(
    p_request_id, v_house_id, p_game_session_id, 'ticket_added', p_ticket_id => v_ticket_id
  );
  return v_ticket_id;
end;
$$;

-- Removes an empty ticket (soft delete). Raises ticket_not_found (not in the
-- game session or already removed), ticket_not_empty (a number is taken),
-- last_ticket (the only active one) and round_has_winners (the open round has
-- winning numbers: the free tickets already counted for the house).
create function public.remove_ticket(p_game_session_id bigint, p_ticket_id bigint, p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_house_id bigint := private.lock_game_session(p_game_session_id);
  v_round public.game_session_rounds;
begin
  if not private.claim_request(p_request_id) then
    return;
  end if;

  perform 1
  from public.tickets t
  where t.id = p_ticket_id and t.game_session_id = p_game_session_id and t.removed_at is null
  for update;
  if not found then
    raise exception 'ticket_not_found';
  end if;

  if exists (
    select 1 from public.ticket_numbers tn
    where tn.ticket_id = p_ticket_id and tn.player_id is not null
  ) then
    raise exception 'ticket_not_empty';
  end if;

  if (
    select count(*) from public.tickets t
    where t.game_session_id = p_game_session_id and t.removed_at is null
  ) <= 1 then
    raise exception 'last_ticket';
  end if;

  select r.* into v_round
  from public.game_session_rounds r
  where r.game_session_id = p_game_session_id and r.status = 'open';
  if found and private.round_has_awards(v_round) then
    raise exception 'round_has_winners';
  end if;

  update public.tickets set removed_at = now() where id = p_ticket_id;
  update public.ticket_numbers set is_gift = false where ticket_id = p_ticket_id and is_gift;

  perform private.log_activity(
    p_request_id, v_house_id, p_game_session_id, 'ticket_removed',
    v_round.id, p_ticket_id
  );
end;
$$;

revoke all on function private.snapshot_round_tickets() from public, anon, authenticated;
revoke all on function public.remove_ticket(bigint, bigint, uuid) from public, anon;
grant execute on function public.remove_ticket(bigint, bigint, uuid) to authenticated;
