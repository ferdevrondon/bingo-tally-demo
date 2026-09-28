-- =============================================================================
-- BACKEND_PLAN.md Phase 4c — game rules v2 (business rules A, B, C, E, F).
--
-- * One signed balance per player in a game session (rule B): negative = the
--   player owes, positive = the house owes them. Purchases subtract, refunds,
--   prizes and recharges add. No "pay debt first".
-- * Check-in only means "this player is in this round" (rule A): no money, no
--   payment method, no block on a negative balance.
-- * A gift only lasts its round (rule C): a kept gifted number becomes a normal
--   number and is charged. A gifted winning ticket pays prize - P.
-- * Configurable rounds (rule E): a template has 1 to 5 prizes with their own
--   values; the round copies them when it starts. No more kind/multipliers.
-- * House result per game session (decided 2026-09-28): sales - prizes paid
--   + the round margin (the house "plays" what it didn't sell: -P per unsold
--   losing number, +prize - P per unsold winning number, -P per gifted losing
--   number). Recharges and payouts are cash: they move the player's balance
--   but not the house result.
--
-- Every game session created before this migration is test data and is
-- deleted (approved by the product owner on 2026-09-28).
--
-- Ledger mapping v2. P = line_price of the open round; prize[s] = the round's
-- copied prize for slot s. "Sale" rows move money between player and house.
--
-- | type                 | amount (sign)                          | balance     | house_balance |
-- |----------------------|----------------------------------------|-------------|---------------|
-- | number_purchased     | +P                                     | -P          | +P            |
-- | number_released      | -P (refund), 0 if it was a gift        | +P / 0      | -P / 0        |
-- | number_gifted        | -P (refund)                            | +P          | -P            |
-- | number_ungifted      | +P                                     | -P          | +P            |
-- | number_reassigned    | previous owner -P (0 if gift),         | as released | as released   |
-- |                      | new owner +P                           | as purchase | as purchase   |
-- | carryover_kept       | +P × every kept number (gifts included)| -amount     | +amount       |
-- | carryover_released   | 0                                      | —           | —             |
-- | prize_won            | paid ticket +prize[s]; gifted ticket   | +amount     | -amount       |
-- |                      | +greatest(prize[s] - P, 0); 0 with no player when nobody owns it       |
-- | adjustment           | +x (unplayed round refund)             | +x          | -x            |
-- | margin_adjustment    | ±total margin of the round (no player) | —           | +amount       |
-- | recharge             | +x (with payment_method)               | +x          | — (cash)      |
-- | payout               | -x (with payment_method)               | -x          | — (cash)      |
-- | check_in             | null                                   | —           | —             |
-- | check_in_undone      | null                                   | —           | —             |
-- | player_removed       | 0                                      | —           | —             |
--
-- Hence, per game_session_players row:
--   balance = sum of +amount for recharge, prize_won, adjustment, payout
--           - sum of amount for number_purchased, number_released,
--             number_gifted, number_ungifted, number_reassigned, carryover_kept
-- and game_sessions.house_balance =
--     sum of amount for the six sale types above
--   - sum of amount for prize_won and adjustment
--   + sum of amount for margin_adjustment.
-- Each closed round keeps its margin split into margin_gifts,
-- margin_unsold_losing and margin_unsold_winning (their sum is
-- margin_adjustment) for the round and game session summaries.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Test data out, schema in
-- -----------------------------------------------------------------------------

delete from public.game_sessions;

-- Round templates: a line price and 1 to 5 prizes; no kind.
alter table public.round_templates
  drop constraint round_templates_check,
  drop column kind,
  drop column winner_count,
  add constraint round_templates_prizes_check check (
    cardinality(prizes) between 1 and 5
    and array_position(prizes, null) is null
    and 0 < all (prizes)
  );
comment on column public.round_templates.prizes is
  'Prize paid per winning ticket for each winning number, in order (1 to 5).';

-- Rounds copy their prizes when they start (like line_price, rule 8).
alter table public.game_session_rounds
  drop column kind,
  add column prizes numeric(12, 2)[] not null,
  add column margin_gifts numeric(12, 2),
  add column margin_unsold_losing numeric(12, 2),
  add column margin_unsold_winning numeric(12, 2),
  add constraint game_session_rounds_prizes_check check (
    cardinality(prizes) between 1 and 5
    and array_position(prizes, null) is null
    and 0 < all (prizes)
  );

-- One signed balance per player in the game session.
alter table public.game_session_players
  drop column positive_balance,
  drop column negative_balance,
  add column balance numeric(12, 2) not null default 0;

-- -----------------------------------------------------------------------------
-- 2. Money helpers
-- -----------------------------------------------------------------------------

-- Game money from the player to the house (a sale).
create or replace function private.charge_player(p_session_player_id bigint, p_amount numeric)
returns void
language sql
set search_path = ''
as $$
  update public.game_session_players
  set balance = balance - p_amount
  where id = p_session_player_id;
  update public.game_sessions gs
  set house_balance = gs.house_balance + p_amount
  from public.game_session_players gsp
  where gsp.id = p_session_player_id and gs.id = gsp.game_session_id;
$$;

-- Game money from the house to the player (a refund, a prize).
create or replace function private.credit_player(p_session_player_id bigint, p_amount numeric)
returns void
language sql
set search_path = ''
as $$
  update public.game_session_players
  set balance = balance + p_amount
  where id = p_session_player_id;
  update public.game_sessions gs
  set house_balance = gs.house_balance - p_amount
  from public.game_session_players gsp
  where gsp.id = p_session_player_id and gs.id = gsp.game_session_id;
$$;

-- Cash (recharge +x, payout -x): the player's balance only.
create function private.move_cash(p_session_player_id bigint, p_amount numeric)
returns void
language sql
set search_path = ''
as $$
  update public.game_session_players
  set balance = balance + p_amount
  where id = p_session_player_id;
$$;

-- -----------------------------------------------------------------------------
-- 3. Round helpers
-- -----------------------------------------------------------------------------

create or replace function private.insert_round(
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
    house_id, game_session_id, seq, round_template_id, name, line_price, prizes, winning_numbers
  )
  select p_house_id, p_game_session_id, coalesce(max(r.seq), 0) + 1, p_template.id,
         p_template.name, p_template.line_price, p_template.prizes,
         array_fill(null::smallint, array[cardinality(p_template.prizes)])
  from public.game_session_rounds r
  where r.game_session_id = p_game_session_id
  returning id into v_round_id;

  perform private.log_activity(
    p_request_id, p_house_id, p_game_session_id, 'round_started', p_round_id => v_round_id
  );
  return v_round_id;
end;
$$;

create or replace function private.round_fully_awarded(p_round public.game_session_rounds)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(cardinality(p_round.winning_numbers), 0) = cardinality(p_round.prizes)
     and array_position(p_round.winning_numbers, null) is null;
$$;

drop function private.round_margin(public.game_session_rounds);

-- The house margin of the round being closed, on the ownership at close
-- time. Paid numbers and gifted winning numbers are already covered by the
-- sales and prize_won rows.
create function private.round_margin_parts(
  p_round public.game_session_rounds,
  out gifts numeric,
  out unsold_losing numeric,
  out unsold_winning numeric
)
language sql
stable
set search_path = ''
as $$
  select
    coalesce(sum(-p_round.line_price) filter (where tn.player_id is not null and tn.is_gift and w.slot is null), 0),
    coalesce(sum(-p_round.line_price) filter (where tn.player_id is null and w.slot is null), 0),
    coalesce(sum(p_round.prizes[w.slot + 1] - p_round.line_price) filter (where tn.player_id is null and w.slot is not null), 0)
  from public.ticket_numbers tn
  left join (
    select u.n, (u.ord - 1)::integer as slot
    from unnest(p_round.winning_numbers) with ordinality as u (n, ord)
    where u.n is not null
  ) w on w.n = tn.number
  where tn.game_session_id = p_round.game_session_id;
$$;

-- Closes a played round: margin into house_balance (kept split on the round),
-- round_closed + margin_adjustment rows.
create or replace function private.close_played_round(
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
  v_parts record;
  v_margin numeric;
begin
  select * into v_parts from private.round_margin_parts(p_round);
  v_margin := v_parts.gifts + v_parts.unsold_losing + v_parts.unsold_winning;
  update public.game_session_rounds
  set status = 'closed', closed_at = now(), margin_adjustment = v_margin,
      margin_gifts = v_parts.gifts,
      margin_unsold_losing = v_parts.unsold_losing,
      margin_unsold_winning = v_parts.unsold_winning
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
-- 4. Public functions whose rules change
-- -----------------------------------------------------------------------------

-- Picking the round on /new-game. The line price and prizes are copied from
-- the template (rules 8 and E). While the open round has no activity besides
-- its start, picking another template replaces it; after that it raises
-- round_in_progress.
create or replace function public.start_round(p_game_session_id bigint, p_round_template_id bigint, p_request_id uuid)
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
      line_price = v_template.line_price,
      prizes = v_template.prizes,
      winning_numbers = array_fill(null::smallint, array[cardinality(v_template.prizes)])
  where id = v_open.id;
  perform private.log_activity(
    p_request_id, v_house_id, p_game_session_id, 'round_started', p_round_id => v_open.id
  );
  return v_open.id;
end;
$$;

-- Recharge: cash in. Adds to the player's balance; not part of the house result.
create or replace function public.record_recharge(
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
  perform private.move_cash(v_session_player_id, p_amount);

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

-- Check-in (rule A): the player confirms they are in the open round. No
-- money. A player who still has to keep or release their numbers after a
-- round closed can't check in yet. Already checked in: no-op.
drop function public.record_check_in(bigint, bigint, text, uuid);
create function public.record_check_in(p_game_session_id bigint, p_player_id bigint, p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_house_id bigint := private.lock_game_session(p_game_session_id);
  v_round public.game_session_rounds;
  v_session_player_id bigint;
  v_checked_in boolean;
  v_pending boolean;
begin
  if not private.claim_request(p_request_id) then
    return;
  end if;
  v_round := private.open_round(p_game_session_id);
  v_session_player_id := private.session_player(p_game_session_id, p_player_id);
  select gsp.checked_in, gsp.pending_carryover into v_checked_in, v_pending
  from public.game_session_players gsp
  where gsp.id = v_session_player_id;
  if v_checked_in then
    return;
  end if;
  if v_pending then
    raise exception 'pending_carryover';
  end if;

  update public.game_session_players set checked_in = true where id = v_session_player_id;
  perform private.log_activity(
    p_request_id, v_house_id, p_game_session_id, 'check_in',
    p_round_id => v_round.id, p_player_id => p_player_id
  );
end;
$$;

-- A winning number entered for a slot of the open round. Pays every ticket
-- that owns the number, one round_winners row and one prize_won row per
-- ticket: the slot's prize for a paid ticket, prize - P for a gifted one
-- (rule C). Nobody owns it: the margin covers it at close. Every player who
-- owns numbers must be checked in first (check_in_pending).
create or replace function public.award_prize(p_round_id bigint, p_slot integer, p_number integer, p_request_id uuid)
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
  if p_slot is null or p_slot < 0 or p_slot >= cardinality(v_round.prizes) then
    raise exception 'invalid_slot' using errcode = '22023';
  end if;
  if p_number is null or p_number not between 1 and 15 then
    raise exception 'invalid_number' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.game_session_players gsp
    where gsp.game_session_id = v_game_session_id
      and gsp.removed_at is null
      and not gsp.checked_in
      and exists (
        select 1 from public.ticket_numbers tn
        where tn.game_session_id = v_game_session_id and tn.player_id = gsp.player_id
      )
  ) then
    raise exception 'check_in_pending';
  end if;

  v_winning := v_round.winning_numbers;
  if coalesce(cardinality(v_winning), 0) <> cardinality(v_round.prizes) then
    v_winning := array_fill(null::smallint, array[cardinality(v_round.prizes)]);
  end if;
  if v_winning[p_slot + 1] is not null then
    raise exception 'slot_already_awarded';
  end if;
  if p_number = any (v_winning) then
    raise exception 'number_already_won';
  end if;
  v_winning[p_slot + 1] := p_number;
  update public.game_session_rounds set winning_numbers = v_winning where id = v_round.id;

  v_full_prize := v_round.prizes[p_slot + 1];

  for v_entry in
    select tn.ticket_id, tn.player_id, tn.is_gift
    from public.ticket_numbers tn
    join public.tickets t on t.id = tn.ticket_id
    where tn.game_session_id = v_game_session_id
      and tn.number = p_number
      and tn.player_id is not null
    order by t.index
  loop
    v_prize := case
      when v_entry.is_gift then greatest(v_full_prize - v_round.line_price, 0)
      else v_full_prize
    end;
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
    perform private.log_activity(
      private.request_id_for(p_request_id, v_n), v_house_id, v_game_session_id, 'prize_won',
      v_round.id, v_entry.ticket_id, p_number, v_entry.player_id, v_prize
    );
    v_n := v_n + 1;
  end loop;

  if v_n = 0 then
    perform private.log_activity(
      p_request_id, v_house_id, v_game_session_id, 'prize_won',
      p_round_id => v_round.id, p_number => p_number, p_amount => 0
    );
  end if;
end;
$$;

-- After a round closes, each player keeps or releases their numbers.
-- Released numbers are freed without refund. Every kept number is charged at
-- the new round's P, gifts included: a gift only lasts its round (rule C).
-- p_release: [{ "ticket_id": 1, "number": 7 }].
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
create or replace function public.end_game_session(p_game_session_id bigint, p_request_id uuid)
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
      set status = 'closed', closed_at = now(), margin_adjustment = 0,
          margin_gifts = 0, margin_unsold_losing = 0, margin_unsold_winning = 0
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

-- A payment to the player made outside the app (cash out). Allowed on ended
-- game sessions; never more than a positive balance. Phase 4d redesigns the
-- settlement around the player's account.
create or replace function public.record_payout(
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
  v_balance numeric;
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

  select gsp.id, gsp.balance into v_session_player_id, v_balance
  from public.game_session_players gsp
  where gsp.game_session_id = p_game_session_id and gsp.player_id = p_player_id
  for update;
  if not found then
    raise exception 'player_not_in_session';
  end if;
  if p_amount > v_balance then
    raise exception 'payout_exceeds_balance';
  end if;

  perform private.move_cash(v_session_player_id, -p_amount);
  perform private.log_activity(
    p_request_id, v_house_id, p_game_session_id, 'payout',
    p_player_id => p_player_id, p_amount => -p_amount,
    p_payment_method => p_payment_method, p_note => nullif(trim(p_note), '')
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Old helpers and grants
-- -----------------------------------------------------------------------------

drop function private.winner_count(text);
drop function private.prize_multiplier(text, integer);

revoke all on function public.record_check_in(bigint, bigint, uuid) from public, anon;
grant execute on function public.record_check_in(bigint, bigint, uuid) to authenticated;

revoke all on function
  private.move_cash(bigint, numeric),
  private.round_margin_parts(public.game_session_rounds)
from public, anon, authenticated;
