-- =============================================================================
-- BACKEND_PLAN.md Phase 4a — game session functions.
--
-- These functions are the only writers of the game-session tables
-- (game_sessions, game_session_players, tickets, ticket_numbers,
-- game_session_rounds, round_winners, activity_log): API roles only have
-- `select` on them. Each public function is SECURITY DEFINER (it must bypass
-- RLS to write select-only tables), so Supabase lint 0029 flags each one on
-- purpose. Every function:
--   1. derives house_id from the row it touches (never from arguments; the
--      one exception is start_game_session, which has no row yet and checks
--      the caller is the admin of the given house),
--   2. locks the game session row and raises `not_admin` (42501) unless the
--      caller is the house admin from their claimed login session,
--   3. records the client's request_id in private.processed_requests; a
--      repeated request_id (double click, retry) returns without changes,
--   4. computes every amount itself from the open round's line_price, and
--      writes the state change and its activity_log rows in one transaction.
--
-- Errors are raised with the code as the message (e.g. `number_taken`), so
-- the UI can map them to Spanish text.
--
-- Ledger mapping (BACKEND_PLAN.md §3). P = line_price of the open round
-- (game_session_rounds.line_price, copied from the template when the round
-- starts). "Pay debt first": debt_paid = least(negative_balance, x);
-- negative_balance -= debt_paid; positive_balance += x - debt_paid.
--
-- | type                 | amount (sign)                  | negative_balance          | positive_balance         | house_balance |
-- |----------------------|--------------------------------|---------------------------|--------------------------|---------------|
-- | recharge             | +x                             | pay debt first            | gets the remainder       | +x            |
-- | number_purchased     | +P (charged)                   | +P, checked_in = false    | —                        | —             |
-- | number_released      | -P (refund), 0 if it was a gift| pay debt first            | gets the remainder       | —             |
-- | number_gifted        | -P (refund)                    | pay debt first            | gets the remainder       | —             |
-- | number_ungifted      | +P                             | +P, checked_in = false    | —                        | —             |
-- | number_reassigned    | previous owner: -P (0 if gift) | as number_released        | as number_released       | —             |
-- |                      | new owner: +P                  | as number_purchased       | —                        | —             |
-- | check_in             | +debt (with payment_method)    | set to 0                  | —                        | +debt         |
-- | check_in_undone      | null                           | —                         | —                        | —             |
-- | prize_won            | +prize per ticket (paid ticket | pay debt first            | gets the remainder       | -prize        |
-- |                      | mult × P, gifted 0.9 × mult × P); 0 with no player when nobody owns the number                          |
-- | margin_adjustment    | ±delta (close of a played round, no player)                | —                        | +delta        |
-- | carryover_kept       | +P × kept non-gift numbers     | +amount                   | —                        | —             |
-- | carryover_released   | 0 (no refund)                  | —                         | —                        | —             |
-- | player_removed       | 0                              | unchanged                 | unchanged                | —             |
-- | payout               | -x                             | —                         | -x (x <= positive)       | —             |
-- | adjustment           | +x (credit to the player)      | pay debt first            | gets the remainder       | —             |
--
-- mult: regular round slot 0 = 10; special round slot 0 = 10, slot 1 = 5.
-- margin_adjustment (same rules as computeRoundMarginAdjustment): per ticket
-- number, unsold losing -P, unsold winning +(mult × P - P), gifted losing -P.
-- `adjustment` is written today only when a game session ends with an open
-- round that was never played: each player's net charge in that round is
-- credited back.
--
-- Hence, per game_session_players row:
--   positive_balance - negative_balance = sum over its activity_log rows of
--     +amount for recharge, check_in, prize_won, payout, adjustment
--     -amount for number_purchased, number_released, number_gifted,
--                 number_ungifted, number_reassigned, carryover_kept
-- and game_sessions.house_balance = sum of amount for recharge + check_in +
-- margin_adjustment - prize_won.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Idempotency: processed request ids (private: not exposed by the API)
-- -----------------------------------------------------------------------------

create table private.processed_requests (
  request_id uuid primary key,
  created_at timestamptz not null default now()
);
revoke all on private.processed_requests from public, anon, authenticated;

-- True the first time a request id is seen in a committed transaction. A
-- concurrent duplicate waits on the primary key, then gets false.
create function private.claim_request(p_request_id uuid)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_rows integer;
begin
  if p_request_id is null then
    raise exception 'missing_request_id' using errcode = '22023';
  end if;
  insert into private.processed_requests (request_id) values (p_request_id)
  on conflict (request_id) do nothing;
  get diagnostics v_rows = row_count;
  return v_rows = 1;
end;
$$;

-- activity_log.request_id is unique per row. A call that writes several rows
-- uses the client's id for row 0 and ids derived from it for the others.
create function private.request_id_for(p_request_id uuid, p_n integer)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when p_n = 0 then p_request_id
    else md5(p_request_id::text || ':' || p_n::text)::uuid
  end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Shared helpers (invoker; called from the SECURITY DEFINER functions)
-- -----------------------------------------------------------------------------

create function private.require_admin(p_house_id bigint)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_house_id is null or not private.is_house_admin(p_house_id) then
    raise exception 'not_admin' using errcode = '42501';
  end if;
end;
$$;

-- Locks the game session (serializes every action on it), checks the caller
-- is its house admin and, unless p_allow_ended, that it is active.
create function private.lock_game_session(p_game_session_id bigint, p_allow_ended boolean default false)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  v_house_id bigint;
  v_status text;
begin
  select gs.house_id, gs.status into v_house_id, v_status
  from public.game_sessions gs
  where gs.id = p_game_session_id
  for update;
  if not found then
    raise exception 'game_session_not_found' using errcode = 'P0002';
  end if;
  perform private.require_admin(v_house_id);
  if v_status <> 'active' and not p_allow_ended then
    raise exception 'game_session_not_active';
  end if;
  return v_house_id;
end;
$$;

create function private.ticket_game_session(p_ticket_id bigint)
returns bigint
language plpgsql
stable
set search_path = ''
as $$
declare
  v_game_session_id bigint;
begin
  select t.game_session_id into v_game_session_id from public.tickets t where t.id = p_ticket_id;
  if not found then
    raise exception 'ticket_not_found' using errcode = 'P0002';
  end if;
  return v_game_session_id;
end;
$$;

create function private.round_game_session(p_round_id bigint)
returns bigint
language plpgsql
stable
set search_path = ''
as $$
declare
  v_game_session_id bigint;
begin
  select r.game_session_id into v_game_session_id
  from public.game_session_rounds r
  where r.id = p_round_id;
  if not found then
    raise exception 'round_not_found' using errcode = 'P0002';
  end if;
  return v_game_session_id;
end;
$$;

-- The open round (business rule 9: no number without an open round).
create function private.open_round(p_game_session_id bigint)
returns public.game_session_rounds
language plpgsql
set search_path = ''
as $$
declare
  v_round public.game_session_rounds;
begin
  select r.* into v_round
  from public.game_session_rounds r
  where r.game_session_id = p_game_session_id and r.status = 'open'
  for update;
  if not found then
    raise exception 'no_open_round';
  end if;
  return v_round;
end;
$$;

create function private.round_template(p_house_id bigint, p_round_template_id bigint)
returns public.round_templates
language plpgsql
stable
set search_path = ''
as $$
declare
  v_template public.round_templates;
begin
  select rt.* into v_template
  from public.round_templates rt
  where rt.id = p_round_template_id and rt.house_id = p_house_id and rt.active;
  if not found then
    raise exception 'round_template_not_found' using errcode = 'P0002';
  end if;
  return v_template;
end;
$$;

-- Mirrors lib/round-draft/prize-rules.ts.
create function private.winner_count(p_kind text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_kind when 'special' then 2 else 1 end;
$$;

create function private.prize_multiplier(p_kind text, p_slot integer)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case
    when p_slot = 0 then 10
    when p_kind = 'special' and p_slot = 1 then 5
  end::numeric;
$$;

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
  p_note text default null
)
returns void
language sql
set search_path = ''
as $$
  insert into public.activity_log (
    request_id, house_id, game_session_id, type, round_id, ticket_id, number,
    player_id, amount, payment_method, note
  )
  values (
    p_request_id, p_house_id, p_game_session_id, p_type, p_round_id, p_ticket_id, p_number,
    p_player_id, p_amount, p_payment_method, p_note
  );
$$;

-- The player's row in this game session (not removed).
create function private.session_player(p_game_session_id bigint, p_player_id bigint)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  v_id bigint;
begin
  select gsp.id into v_id
  from public.game_session_players gsp
  where gsp.game_session_id = p_game_session_id
    and gsp.player_id = p_player_id
    and gsp.removed_at is null
  for update;
  if not found then
    raise exception 'player_not_in_session';
  end if;
  return v_id;
end;
$$;

-- Adds a catalog player to the game session (or brings back a removed one)
-- and logs `player_added`. No-op when the player is already in it.
create function private.ensure_session_player(
  p_house_id bigint,
  p_game_session_id bigint,
  p_player_id bigint,
  p_request_id uuid
)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  v_id bigint;
  v_removed_at timestamptz;
begin
  select gsp.id, gsp.removed_at into v_id, v_removed_at
  from public.game_session_players gsp
  where gsp.game_session_id = p_game_session_id and gsp.player_id = p_player_id
  for update;
  if v_id is not null and v_removed_at is null then
    return v_id;
  end if;

  if not exists (
    select 1 from public.players p
    where p.id = p_player_id and p.house_id = p_house_id and p.active
  ) then
    raise exception 'player_not_found' using errcode = 'P0002';
  end if;

  if v_id is not null then
    update public.game_session_players
    set removed_at = null, checked_in = false, pending_carryover = false
    where id = v_id;
  else
    insert into public.game_session_players (house_id, game_session_id, player_id)
    values (p_house_id, p_game_session_id, p_player_id)
    returning id into v_id;
  end if;

  perform private.log_activity(
    p_request_id, p_house_id, p_game_session_id, 'player_added', p_player_id => p_player_id
  );
  return v_id;
end;
$$;

-- "Pay debt first": the amount clears debt, the rest becomes credit.
create function private.credit_player(p_session_player_id bigint, p_amount numeric)
returns void
language sql
set search_path = ''
as $$
  update public.game_session_players
  set negative_balance = negative_balance - least(negative_balance, p_amount),
      positive_balance = positive_balance + (p_amount - least(negative_balance, p_amount))
  where id = p_session_player_id;
$$;

-- Business rule 10: purchases always create debt. A new charge undoes a
-- previous check-in.
create function private.charge_player(p_session_player_id bigint, p_amount numeric)
returns void
language sql
set search_path = ''
as $$
  update public.game_session_players
  set negative_balance = negative_balance + p_amount, checked_in = false
  where id = p_session_player_id;
$$;

-- -----------------------------------------------------------------------------
-- 3. Number operations shared by the single-number functions and
--    edit_player_numbers. A position is always (ticket, number).
-- -----------------------------------------------------------------------------

create function private.apply_purchase(
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

create function private.apply_release(
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

-- Moves a number from its expected owner to another player. The guard on the
-- expected owner keeps a stale screen from taking a number that changed.
create function private.apply_reassign(
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

-- Flips the gift flag of a number the player owns. A gifted number costs the
-- player nothing (refund P); un-gifting charges P again.
create function private.apply_toggle_gift(
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

-- -----------------------------------------------------------------------------
-- 4. Round helpers
-- -----------------------------------------------------------------------------

create function private.insert_round(
  p_house_id bigint,
  p_game_session_id bigint,
  p_template public.round_templates,
  p_request_id uuid
)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  v_round_id bigint;
begin
  insert into public.game_session_rounds (
    house_id, game_session_id, seq, round_template_id, name, kind, line_price, winning_numbers
  )
  select p_house_id, p_game_session_id, coalesce(max(r.seq), 0) + 1, p_template.id,
         p_template.name, p_template.kind, p_template.line_price,
         array_fill(null::smallint, array[private.winner_count(p_template.kind)])
  from public.game_session_rounds r
  where r.game_session_id = p_game_session_id
  returning id into v_round_id;

  perform private.log_activity(
    p_request_id, p_house_id, p_game_session_id, 'round_started', p_round_id => v_round_id
  );
  return v_round_id;
end;
$$;

create function private.round_fully_awarded(p_round public.game_session_rounds)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_length(p_round.winning_numbers, 1), 0) = private.winner_count(p_round.kind)
     and array_position(p_round.winning_numbers, null) is null;
$$;

create function private.round_has_awards(p_round public.game_session_rounds)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(cardinality(array_remove(p_round.winning_numbers, null)), 0) > 0;
$$;

-- House margin for the round being closed, on the ownership at close time
-- (same rules as computeRoundMarginAdjustment in prize-rules.ts). Paid
-- numbers and gifted winning numbers are already covered by check-in and
-- prize_won.
create function private.round_margin(p_round public.game_session_rounds)
returns numeric
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(
    case
      when tn.player_id is null and w.slot is not null
        then private.prize_multiplier(p_round.kind, w.slot) * p_round.line_price - p_round.line_price
      when tn.player_id is null then -p_round.line_price
      when tn.is_gift and w.slot is null then -p_round.line_price
      else 0
    end
  ), 0)
  from public.ticket_numbers tn
  left join (
    select u.n, (u.ord - 1)::integer as slot
    from unnest(p_round.winning_numbers) with ordinality as u (n, ord)
    where u.n is not null
  ) w on w.n = tn.number
  where tn.game_session_id = p_round.game_session_id;
$$;

-- Closes a played round: margin into house_balance, round_closed +
-- margin_adjustment rows.
create function private.close_played_round(
  p_house_id bigint,
  p_round public.game_session_rounds,
  p_request_id_closed uuid,
  p_request_id_margin uuid
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_margin numeric := private.round_margin(p_round);
begin
  update public.game_session_rounds
  set status = 'closed', closed_at = now(), margin_adjustment = v_margin
  where id = p_round.id;
  update public.game_sessions
  set house_balance = house_balance + v_margin
  where id = p_round.game_session_id;

  perform private.log_activity(
    p_request_id_closed, p_house_id, p_round.game_session_id, 'round_closed', p_round_id => p_round.id
  );
  perform private.log_activity(
    p_request_id_margin, p_house_id, p_round.game_session_id, 'margin_adjustment',
    p_round_id => p_round.id, p_amount => v_margin
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Public functions (Data API: supabase.rpc). SECURITY DEFINER.
-- -----------------------------------------------------------------------------

-- "Iniciar jornada": the house's active game session, created if there is
-- none. The number is max + 1 per house, assigned here.
create function public.start_game_session(p_house_id bigint, p_request_id uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  perform private.require_admin(p_house_id);
  perform 1 from public.houses h where h.id = p_house_id for update;

  select gs.id into v_id
  from public.game_sessions gs
  where gs.house_id = p_house_id and gs.status = 'active';
  if found then
    return v_id;
  end if;
  if not private.claim_request(p_request_id) then
    select a.game_session_id into v_id from public.activity_log a where a.request_id = p_request_id;
    return v_id;
  end if;

  insert into public.game_sessions (house_id, number)
  select p_house_id, coalesce(max(gs.number), 0) + 1
  from public.game_sessions gs
  where gs.house_id = p_house_id
  returning id into v_id;

  perform private.log_activity(p_request_id, p_house_id, v_id, 'game_session_started');
  return v_id;
end;
$$;

create function public.add_session_player(p_game_session_id bigint, p_player_id bigint, p_request_id uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_house_id bigint := private.lock_game_session(p_game_session_id);
begin
  if private.claim_request(p_request_id) then
    return private.ensure_session_player(v_house_id, p_game_session_id, p_player_id, p_request_id);
  end if;
  return (
    select gsp.id from public.game_session_players gsp
    where gsp.game_session_id = p_game_session_id and gsp.player_id = p_player_id
  );
end;
$$;

-- Frees the player's numbers without refund; the balance stays on
-- game_session_players for the settlement.
create function public.remove_player(p_game_session_id bigint, p_player_id bigint, p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_house_id bigint := private.lock_game_session(p_game_session_id);
  v_session_player_id bigint;
begin
  if not private.claim_request(p_request_id) then
    return;
  end if;
  v_session_player_id := private.session_player(p_game_session_id, p_player_id);

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
end;
$$;

-- A new ticket with its 15 numbers (1-15), all unassigned.
create function public.add_ticket(p_game_session_id bigint, p_request_id uuid)
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

-- Picking the round on /new-game. The line price is copied from the template
-- (business rule 8). While the open round has no activity besides its start
-- (nothing sold, kept or awarded in it), picking another template replaces it;
-- after that it raises round_in_progress.
create function public.start_round(p_game_session_id bigint, p_round_template_id bigint, p_request_id uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_house_id bigint := private.lock_game_session(p_game_session_id);
  v_template public.round_templates;
  v_open public.game_session_rounds;
begin
  if not private.claim_request(p_request_id) then
    return (select a.round_id from public.activity_log a where a.request_id = p_request_id);
  end if;
  v_template := private.round_template(v_house_id, p_round_template_id);

  select r.* into v_open
  from public.game_session_rounds r
  where r.game_session_id = p_game_session_id and r.status = 'open'
  for update;
  if not found then
    return private.insert_round(v_house_id, p_game_session_id, v_template, p_request_id);
  end if;

  if private.round_has_awards(v_open) or exists (
    select 1 from public.activity_log a
    where a.round_id = v_open.id and a.type <> 'round_started'
  ) then
    raise exception 'round_in_progress';
  end if;

  update public.game_session_rounds
  set round_template_id = v_template.id,
      name = v_template.name,
      kind = v_template.kind,
      line_price = v_template.line_price,
      winning_numbers = array_fill(null::smallint, array[private.winner_count(v_template.kind)])
  where id = v_open.id;
  perform private.log_activity(
    p_request_id, v_house_id, p_game_session_id, 'round_started', p_round_id => v_open.id
  );
  return v_open.id;
end;
$$;

-- Claim a free number (ASSIGN_NUMBER). Conditional: raises number_taken if
-- someone else got it first. Adds the player to the game session if needed.
create function public.record_purchase(p_ticket_id bigint, p_number integer, p_player_id bigint, p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game_session_id bigint := private.ticket_game_session(p_ticket_id);
  v_house_id bigint := private.lock_game_session(v_game_session_id);
  v_round public.game_session_rounds;
begin
  if not private.claim_request(p_request_id) then
    return;
  end if;
  v_round := private.open_round(v_game_session_id);
  perform private.ensure_session_player(
    v_house_id, v_game_session_id, p_player_id, private.request_id_for(p_request_id, 1)
  );
  perform private.apply_purchase(v_house_id, v_round, p_ticket_id, p_number, p_player_id, p_request_id);
end;
$$;

-- Un-assign the player's own number: refund P unless it was a gift.
create function public.release_number(p_ticket_id bigint, p_number integer, p_player_id bigint, p_request_id uuid)
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
end;
$$;

-- SET_NUMBER_OWNER: refund the previous owner (unless gift), charge the new one.
create function public.reassign_number(
  p_ticket_id bigint,
  p_number integer,
  p_expected_owner_id bigint,
  p_new_owner_id bigint,
  p_request_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game_session_id bigint := private.ticket_game_session(p_ticket_id);
  v_house_id bigint := private.lock_game_session(v_game_session_id);
  v_round public.game_session_rounds;
begin
  if not private.claim_request(p_request_id) then
    return;
  end if;
  v_round := private.open_round(v_game_session_id);
  perform private.ensure_session_player(
    v_house_id, v_game_session_id, p_new_owner_id, private.request_id_for(p_request_id, 2)
  );
  perform private.apply_reassign(
    v_house_id, v_round, p_ticket_id, p_number, p_expected_owner_id, p_new_owner_id,
    p_request_id, private.request_id_for(p_request_id, 1)
  );
end;
$$;

create function public.toggle_gift(p_ticket_id bigint, p_number integer, p_player_id bigint, p_request_id uuid)
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
  perform private.apply_toggle_gift(
    v_house_id, private.open_round(v_game_session_id), p_ticket_id, p_number, p_player_id, p_request_id
  );
end;
$$;

-- The "Editar jugada" dialog, applied in one transaction. p_changes is a JSON
-- array of the positions the admin touched for this player:
--   { "ticket_id": 1, "number": 7, "owned": true, "is_gift": false,
--     "expected_owner_id": null }
-- owned = true: buy it if free, take it from expected_owner_id if another
-- player owns it (number_owner_changed if that changed), then set is_gift.
-- owned = false: release it if this player owns it.
create function public.edit_player_numbers(
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
    select tn.player_id, tn.is_gift into v_owner, v_is_gift
    from public.ticket_numbers tn
    where tn.ticket_id = v_change.ticket_id
      and tn.number = v_change.number
      and tn.game_session_id = p_game_session_id;
    if not found then
      raise exception 'number_not_found' using errcode = 'P0002';
    end if;

    if coalesce(v_change.owned, false) then
      if v_owner is null then
        perform private.apply_purchase(
          v_house_id, v_round, v_change.ticket_id, v_change.number, p_player_id,
          private.request_id_for(p_request_id, v_n)
        );
        v_n := v_n + 1;
        v_is_gift := false;
      elsif v_owner <> p_player_id then
        if v_change.expected_owner_id is distinct from v_owner then
          raise exception 'number_owner_changed';
        end if;
        perform private.apply_reassign(
          v_house_id, v_round, v_change.ticket_id, v_change.number,
          v_change.expected_owner_id, p_player_id,
          private.request_id_for(p_request_id, v_n), private.request_id_for(p_request_id, v_n + 1)
        );
        v_n := v_n + 2;
        v_is_gift := false;
      end if;
      if coalesce(v_change.is_gift, false) <> v_is_gift then
        perform private.apply_toggle_gift(
          v_house_id, v_round, v_change.ticket_id, v_change.number, p_player_id,
          private.request_id_for(p_request_id, v_n)
        );
        v_n := v_n + 1;
      end if;
    elsif v_owner = p_player_id then
      perform private.apply_release(
        v_house_id, v_round, v_change.ticket_id, v_change.number, p_player_id,
        private.request_id_for(p_request_id, v_n)
      );
      v_n := v_n + 1;
    elsif v_owner is not null then
      raise exception 'number_owner_changed';
    end if;
  end loop;
end;
$$;

create function public.record_recharge(
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
  perform private.credit_player(v_session_player_id, p_amount);
  update public.game_sessions set house_balance = house_balance + p_amount where id = p_game_session_id;

  perform private.log_activity(
    p_request_id, v_house_id, p_game_session_id, 'recharge',
    p_round_id => (
      select r.id from public.game_session_rounds r
      where r.game_session_id = p_game_session_id and r.status = 'open'
    ),
    p_player_id => p_player_id, p_amount => p_amount,
    p_payment_method => p_payment_method, p_note => nullif(trim(p_note), '')
  );
end;
$$;

-- Check-in: the player pays their whole debt (money in, with its payment
-- method) and is marked checked in. Already checked in: no-op.
create function public.record_check_in(
  p_game_session_id bigint,
  p_player_id bigint,
  p_payment_method text,
  p_request_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_house_id bigint := private.lock_game_session(p_game_session_id);
  v_session_player_id bigint;
  v_debt numeric;
  v_checked_in boolean;
begin
  if not private.claim_request(p_request_id) then
    return;
  end if;
  v_session_player_id := private.session_player(p_game_session_id, p_player_id);
  select gsp.negative_balance, gsp.checked_in into v_debt, v_checked_in
  from public.game_session_players gsp
  where gsp.id = v_session_player_id;
  if v_checked_in then
    return;
  end if;
  if v_debt > 0 and p_payment_method is null then
    raise exception 'payment_method_required' using errcode = '22023';
  end if;

  update public.game_session_players
  set negative_balance = 0, checked_in = true
  where id = v_session_player_id;
  update public.game_sessions set house_balance = house_balance + v_debt where id = p_game_session_id;

  perform private.log_activity(
    p_request_id, v_house_id, p_game_session_id, 'check_in',
    p_round_id => (
      select r.id from public.game_session_rounds r
      where r.game_session_id = p_game_session_id and r.status = 'open'
    ),
    p_player_id => p_player_id, p_amount => v_debt,
    p_payment_method => case when v_debt > 0 then p_payment_method end
  );
end;
$$;

-- Unchecking check-in does not restore the debt (same as the reducer).
create function public.undo_check_in(p_game_session_id bigint, p_player_id bigint, p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_house_id bigint := private.lock_game_session(p_game_session_id);
  v_session_player_id bigint;
begin
  if not private.claim_request(p_request_id) then
    return;
  end if;
  v_session_player_id := private.session_player(p_game_session_id, p_player_id);
  update public.game_session_players
  set checked_in = false
  where id = v_session_player_id and checked_in;
  if not found then
    return;
  end if;
  perform private.log_activity(
    p_request_id, v_house_id, p_game_session_id, 'check_in_undone', p_player_id => p_player_id
  );
end;
$$;

-- A winning number entered for a slot of the open round. Pays every ticket
-- that owns the number, one round_winners row and one prize_won row per
-- ticket: full mult × P for a paid ticket, 90% for a gifted one (the house
-- keeps 10%). house_balance moves by what the players get.
create function public.award_prize(p_round_id bigint, p_slot integer, p_number integer, p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game_session_id bigint := private.round_game_session(p_round_id);
  v_house_id bigint := private.lock_game_session(v_game_session_id);
  v_round public.game_session_rounds;
  v_full_prize numeric;
  v_prize numeric;
  v_winning smallint[];
  v_entry record;
  v_n integer := 0;
begin
  if not private.claim_request(p_request_id) then
    return;
  end if;
  v_round := private.open_round(v_game_session_id);
  if v_round.id <> p_round_id then
    raise exception 'round_not_open';
  end if;
  if p_slot is null or p_slot < 0 or p_slot >= private.winner_count(v_round.kind) then
    raise exception 'invalid_slot' using errcode = '22023';
  end if;
  if p_number is null or p_number not between 1 and 15 then
    raise exception 'invalid_number' using errcode = '22023';
  end if;

  v_winning := v_round.winning_numbers;
  if coalesce(array_length(v_winning, 1), 0) <> private.winner_count(v_round.kind) then
    v_winning := array_fill(null::smallint, array[private.winner_count(v_round.kind)]);
  end if;
  if v_winning[p_slot + 1] is not null then
    raise exception 'slot_already_awarded';
  end if;
  if p_number = any (v_winning) then
    raise exception 'number_already_won';
  end if;
  v_winning[p_slot + 1] := p_number;
  update public.game_session_rounds set winning_numbers = v_winning where id = v_round.id;

  v_full_prize := private.prize_multiplier(v_round.kind, p_slot) * v_round.line_price;

  for v_entry in
    select tn.ticket_id, tn.player_id, tn.is_gift
    from public.ticket_numbers tn
    join public.tickets t on t.id = tn.ticket_id
    where tn.game_session_id = v_game_session_id
      and tn.number = p_number
      and tn.player_id is not null
    order by t.index
  loop
    v_prize := case when v_entry.is_gift then round(v_full_prize * 0.9, 2) else v_full_prize end;
    insert into public.round_winners (
      house_id, game_session_id, round_id, ticket_id, player_id, number, slot, prize
    )
    values (
      v_house_id, v_game_session_id, v_round.id, v_entry.ticket_id, v_entry.player_id,
      p_number, p_slot, v_prize
    );
    perform private.credit_player(
      private.session_player(v_game_session_id, v_entry.player_id), v_prize
    );
    update public.game_sessions set house_balance = house_balance - v_prize where id = v_game_session_id;
    perform private.log_activity(
      private.request_id_for(p_request_id, v_n), v_house_id, v_game_session_id, 'prize_won',
      v_round.id, v_entry.ticket_id, p_number, v_entry.player_id, v_prize
    );
    v_n := v_n + 1;
  end loop;

  -- Nobody owns the number: record the draw anyway (the margin covers it at close).
  if v_n = 0 then
    perform private.log_activity(
      p_request_id, v_house_id, v_game_session_id, 'prize_won',
      p_round_id => v_round.id, p_number => p_number, p_amount => 0
    );
  end if;
end;
$$;

-- "Cerrar ronda y comenzar la siguiente": needs every winning number of the
-- open round. Writes the margin, starts the next round with the chosen
-- template (any active template, the same one included), marks the players
-- who own numbers as pending their carryover decision and clears check-ins.
-- Returns the new round's id.
create function public.close_round(p_round_id bigint, p_next_round_template_id bigint, p_request_id uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game_session_id bigint := private.round_game_session(p_round_id);
  v_house_id bigint := private.lock_game_session(v_game_session_id);
  v_round public.game_session_rounds;
  v_template public.round_templates;
  v_next_round_id bigint;
begin
  if not private.claim_request(p_request_id) then
    return (
      select a.round_id from public.activity_log a
      where a.request_id = private.request_id_for(p_request_id, 2)
    );
  end if;
  v_round := private.open_round(v_game_session_id);
  if v_round.id <> p_round_id then
    raise exception 'round_not_open';
  end if;
  if not private.round_fully_awarded(v_round) then
    raise exception 'round_in_progress';
  end if;
  v_template := private.round_template(v_house_id, p_next_round_template_id);

  perform private.close_played_round(
    v_house_id, v_round, p_request_id, private.request_id_for(p_request_id, 1)
  );
  v_next_round_id := private.insert_round(
    v_house_id, v_game_session_id, v_template, private.request_id_for(p_request_id, 2)
  );

  update public.game_session_players gsp
  set pending_carryover = true, checked_in = false
  where gsp.game_session_id = v_game_session_id
    and gsp.removed_at is null
    and exists (
      select 1 from public.ticket_numbers tn
      where tn.game_session_id = v_game_session_id and tn.player_id = gsp.player_id
    );
  return v_next_round_id;
end;
$$;

-- After a round closes, each player keeps or releases their numbers.
-- Released numbers are freed without refund; each kept non-gift number is
-- charged at the new round's P. p_release: [{ "ticket_id": 1, "number": 7 }].
create function public.resolve_carryover(
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
  end loop;

  select count(*) into v_kept
  from public.ticket_numbers tn
  where tn.game_session_id = p_game_session_id
    and tn.player_id = p_player_id
    and not tn.is_gift;
  v_charge := v_kept * v_round.line_price;

  update public.game_session_players
  set pending_carryover = false,
      negative_balance = negative_balance + v_charge,
      checked_in = case when v_charge > 0 then false else checked_in end
  where id = v_session_player_id;

  perform private.log_activity(
    p_request_id, v_house_id, p_game_session_id, 'carryover_kept',
    p_round_id => v_round.id, p_player_id => p_player_id, p_amount => v_charge
  );
end;
$$;

-- "Terminar jornada". The open round:
--   * every winning number entered: closed like close_round (with margin),
--     no next round;
--   * no winning number yet (never played): closed without margin, and each
--     player's net charge in it (numbers bought or kept for it) is credited
--     back with an `adjustment` row;
--   * partly awarded: round_in_progress.
-- Nothing is deleted.
create function public.end_game_session(p_game_session_id bigint, p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_house_id bigint := private.lock_game_session(p_game_session_id);
  v_round public.game_session_rounds;
  v_refund record;
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
      set status = 'closed', closed_at = now(), margin_adjustment = 0
      where id = v_round.id;
      perform private.log_activity(
        private.request_id_for(p_request_id, 1), v_house_id, p_game_session_id, 'round_closed',
        p_round_id => v_round.id
      );
    end if;
  end if;

  update public.game_sessions
  set status = 'ended', ended_at = now()
  where id = p_game_session_id;
  perform private.log_activity(p_request_id, v_house_id, p_game_session_id, 'game_session_ended');
end;
$$;

-- "Salir y borrar": the only delete. Allowed only while the game session has
-- no rounds; it removes the game session and all its rows, activity_log
-- included (the one documented exception to the immutable ledger — safe
-- because balances are per game session). Already gone: no-op.
create function public.discard_game_session(p_game_session_id bigint, p_request_id uuid)
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
  delete from public.game_sessions where id = p_game_session_id and house_id = v_house_id;
end;
$$;

-- Settlement (BACKEND_PLAN.md §5b): the admin records a payment made outside
-- the app. Allowed on ended game sessions; never more than the positive balance.
create function public.record_payout(
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
  v_house_id bigint := private.lock_game_session(p_game_session_id, p_allow_ended => true);
  v_session_player_id bigint;
  v_positive numeric;
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

  select gsp.id, gsp.positive_balance into v_session_player_id, v_positive
  from public.game_session_players gsp
  where gsp.game_session_id = p_game_session_id and gsp.player_id = p_player_id
  for update;
  if not found then
    raise exception 'player_not_in_session';
  end if;
  if p_amount > v_positive then
    raise exception 'payout_exceeds_balance';
  end if;

  update public.game_session_players
  set positive_balance = positive_balance - p_amount
  where id = v_session_player_id;
  perform private.log_activity(
    p_request_id, v_house_id, p_game_session_id, 'payout',
    p_player_id => p_player_id, p_amount => -p_amount,
    p_payment_method => p_payment_method, p_note => nullif(trim(p_note), '')
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. Grants. Public functions: authenticated only (they check the admin
--    themselves). Private helpers: nobody but the owner (the SECURITY
--    DEFINER functions run as the owner).
-- -----------------------------------------------------------------------------

revoke all on function
  public.start_game_session(bigint, uuid),
  public.add_session_player(bigint, bigint, uuid),
  public.remove_player(bigint, bigint, uuid),
  public.add_ticket(bigint, uuid),
  public.start_round(bigint, bigint, uuid),
  public.record_purchase(bigint, integer, bigint, uuid),
  public.release_number(bigint, integer, bigint, uuid),
  public.reassign_number(bigint, integer, bigint, bigint, uuid),
  public.toggle_gift(bigint, integer, bigint, uuid),
  public.edit_player_numbers(bigint, bigint, jsonb, uuid),
  public.record_recharge(bigint, bigint, numeric, text, text, uuid),
  public.record_check_in(bigint, bigint, text, uuid),
  public.undo_check_in(bigint, bigint, uuid),
  public.award_prize(bigint, integer, integer, uuid),
  public.close_round(bigint, bigint, uuid),
  public.resolve_carryover(bigint, bigint, jsonb, uuid),
  public.end_game_session(bigint, uuid),
  public.discard_game_session(bigint, uuid),
  public.record_payout(bigint, bigint, numeric, text, text, uuid)
from public, anon;

grant execute on function
  public.start_game_session(bigint, uuid),
  public.add_session_player(bigint, bigint, uuid),
  public.remove_player(bigint, bigint, uuid),
  public.add_ticket(bigint, uuid),
  public.start_round(bigint, bigint, uuid),
  public.record_purchase(bigint, integer, bigint, uuid),
  public.release_number(bigint, integer, bigint, uuid),
  public.reassign_number(bigint, integer, bigint, bigint, uuid),
  public.toggle_gift(bigint, integer, bigint, uuid),
  public.edit_player_numbers(bigint, bigint, jsonb, uuid),
  public.record_recharge(bigint, bigint, numeric, text, text, uuid),
  public.record_check_in(bigint, bigint, text, uuid),
  public.undo_check_in(bigint, bigint, uuid),
  public.award_prize(bigint, integer, integer, uuid),
  public.close_round(bigint, bigint, uuid),
  public.resolve_carryover(bigint, bigint, jsonb, uuid),
  public.end_game_session(bigint, uuid),
  public.discard_game_session(bigint, uuid),
  public.record_payout(bigint, bigint, numeric, text, text, uuid)
to authenticated;

revoke all on function
  private.claim_request(uuid),
  private.request_id_for(uuid, integer),
  private.require_admin(bigint),
  private.lock_game_session(bigint, boolean),
  private.ticket_game_session(bigint),
  private.round_game_session(bigint),
  private.open_round(bigint),
  private.round_template(bigint, bigint),
  private.winner_count(text),
  private.prize_multiplier(text, integer),
  private.log_activity(uuid, bigint, bigint, text, bigint, bigint, integer, bigint, numeric, text, text),
  private.session_player(bigint, bigint),
  private.ensure_session_player(bigint, bigint, bigint, uuid),
  private.credit_player(bigint, numeric),
  private.charge_player(bigint, numeric),
  private.apply_purchase(bigint, public.game_session_rounds, bigint, integer, bigint, uuid),
  private.apply_release(bigint, public.game_session_rounds, bigint, integer, bigint, uuid),
  private.apply_reassign(bigint, public.game_session_rounds, bigint, integer, bigint, bigint, uuid, uuid),
  private.apply_toggle_gift(bigint, public.game_session_rounds, bigint, integer, bigint, uuid),
  private.insert_round(bigint, bigint, public.round_templates, uuid),
  private.round_fully_awarded(public.game_session_rounds),
  private.round_has_awards(public.game_session_rounds),
  private.round_margin(public.game_session_rounds),
  private.close_played_round(bigint, public.game_session_rounds, uuid, uuid)
from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 7. Realtime (BACKEND_PLAN.md §5): observers refetch the game session when a
--    new activity_log row arrives. RLS limits each client to its house.
-- -----------------------------------------------------------------------------

alter publication supabase_realtime add table public.activity_log;
