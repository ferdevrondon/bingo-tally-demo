-- House result on a cash basis: house_balance = sum of sales - sum of prizes paid.
--
-- The close-time margin used to add three pieces on top of that, none of which
-- is money that moved:
--   * -P per unsold number that did not win (that P never entered the sales),
--   * prize - P per unsold number that won (nobody paid that prize; the house
--     keeps what was collected),
--   * -P per gifted number that did not win (number_gifted already refunds P).
-- A gifted winning ticket still pays prize - P (award_prize is unchanged), which
-- is where the house recovers the value of the gift.
--
-- Rounds already closed keep their margin_* columns and the house_balance they
-- already added; only rounds closed from now on get a zero margin.

create or replace function private.round_margin_parts(
  p_round public.game_session_rounds,
  out gifts numeric,
  out unsold_losing numeric,
  out unsold_winning numeric
)
language sql
immutable
set search_path = ''
as $$
  select 0::numeric, 0::numeric, 0::numeric;
$$;
