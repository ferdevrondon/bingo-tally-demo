-- Automatic game sessions: a round pattern (BACKEND_PLAN.md "Automatic game
-- sessions: a round pattern").
--
-- * round_templates.kind comes back (regular | special) for labels, colors and
--   the pattern shortcuts only. It never drives the advance.
-- * game_sessions.round_mode: 'manual' (as before) or 'auto'.
-- * game_session_round_pattern: the ordered blocks (template × count) of an
--   'auto' game session. The next round is computed by the app from the number
--   of rounds of the game session (lib/round-draft/round-pattern.ts) and still
--   sent as close_round(…, p_next_round_template_id, …): close_round,
--   start_round, award_prize and end_game_session do not change.
-- * start_game_session takes the mode and the pattern (defaults keep the old
--   callers working) and, in 'auto', opens the first block's round.
-- * discard_game_session: an 'auto' game session can still be discarded while
--   its only round is the untouched open one. The manual rule is unchanged.
--
-- Additive and backward compatible with branches that don't know about it.

-- -----------------------------------------------------------------------------
-- 1. Round template kind
-- -----------------------------------------------------------------------------

alter table public.round_templates
  add column kind text not null default 'regular'
    constraint round_templates_kind_check check (kind in ('regular', 'special'));

update public.round_templates
set kind = 'special'
where name ilike 'especial%';

-- -----------------------------------------------------------------------------
-- 2. Game session mode and pattern
-- -----------------------------------------------------------------------------

alter table public.game_sessions
  add column round_mode text not null default 'manual'
    constraint game_sessions_round_mode_check check (round_mode in ('manual', 'auto'));

create table public.game_session_round_pattern (
  game_session_id bigint not null,
  position smallint not null check (position >= 0 and position < 20),
  house_id bigint not null,
  round_template_id bigint not null references public.round_templates (id),
  repeat_count smallint not null check (repeat_count between 1 and 20),
  primary key (game_session_id, position),
  foreign key (game_session_id, house_id)
    references public.game_sessions (id, house_id) on delete cascade
);
create index game_session_round_pattern_house_id_idx
  on public.game_session_round_pattern (house_id);
create index game_session_round_pattern_round_template_id_idx
  on public.game_session_round_pattern (round_template_id);

alter table public.game_session_round_pattern enable row level security;
create policy "game_session_round_pattern: members read" on public.game_session_round_pattern
  for select to authenticated using ((select private.is_house_member(house_id)));

-- Written only by start_game_session (security definer).
revoke all on public.game_session_round_pattern from anon, authenticated;
grant select on public.game_session_round_pattern to authenticated;

-- -----------------------------------------------------------------------------
-- 3. start_game_session with a mode and a pattern
-- -----------------------------------------------------------------------------

drop function public.start_game_session(bigint, uuid);

-- "Iniciar jornada": the house's active game session, created if there is
-- none. The number is max + 1 per house, assigned here. In 'auto' the pattern
-- is a JSON array of {"round_template_id": n, "repeat_count": n} in play
-- order; it is stored and the first block's round is opened.
create function public.start_game_session(
  p_house_id bigint,
  p_request_id uuid,
  p_round_mode text default 'manual',
  p_pattern jsonb default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
  v_mode text := coalesce(p_round_mode, 'manual');
  v_block jsonb;
  v_position integer := 0;
  v_template_id bigint;
  v_count integer;
  v_first public.round_templates;
begin
  perform private.require_admin(p_house_id);
  perform 1 from public.houses h where h.id = p_house_id for update;

  select gs.id into v_id
  from public.game_sessions gs
  where gs.house_id = p_house_id and gs.status = 'active';
  if found then
    return v_id;
  end if;

  if v_mode not in ('manual', 'auto') then
    raise exception 'invalid_round_pattern' using errcode = '22023';
  end if;
  if v_mode = 'auto' and (
    p_pattern is null
    or jsonb_typeof(p_pattern) <> 'array'
    or jsonb_array_length(p_pattern) not between 1 and 20
  ) then
    raise exception 'invalid_round_pattern' using errcode = '22023';
  end if;

  if not private.claim_request(p_request_id) then
    select a.game_session_id into v_id from public.activity_log a where a.request_id = p_request_id;
    return v_id;
  end if;

  insert into public.game_sessions (house_id, number, round_mode)
  select p_house_id, coalesce(max(gs.number), 0) + 1, v_mode
  from public.game_sessions gs
  where gs.house_id = p_house_id
  returning id into v_id;

  perform private.log_activity(p_request_id, p_house_id, v_id, 'game_session_started');

  if v_mode = 'auto' then
    for v_block in select value from jsonb_array_elements(p_pattern)
    loop
      begin
        v_template_id := (v_block ->> 'round_template_id')::bigint;
        v_count := (v_block ->> 'repeat_count')::integer;
      exception when others then
        raise exception 'invalid_round_pattern' using errcode = '22023';
      end;
      if v_template_id is null or v_count is null or v_count not between 1 and 20 then
        raise exception 'invalid_round_pattern' using errcode = '22023';
      end if;
      -- Active and of this house, else round_template_not_found.
      perform private.round_template(p_house_id, v_template_id);

      insert into public.game_session_round_pattern (
        game_session_id, position, house_id, round_template_id, repeat_count
      ) values (v_id, v_position, p_house_id, v_template_id, v_count);
      v_position := v_position + 1;
    end loop;

    select rt.* into v_first
    from public.game_session_round_pattern p
    join public.round_templates rt on rt.id = p.round_template_id
    where p.game_session_id = v_id and p.position = 0;
    perform private.insert_round(p_house_id, v_id, v_first, private.request_id_for(p_request_id, 1));
  end if;

  return v_id;
end;
$$;

revoke all on function public.start_game_session(bigint, uuid, text, jsonb) from public, anon;
grant execute on function public.start_game_session(bigint, uuid, text, jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- 4. discard_game_session: an 'auto' game session with only its untouched
--    first round (same body as 20261103120000_balance_transfers.sql otherwise)
-- -----------------------------------------------------------------------------

create or replace function public.discard_game_session(p_game_session_id bigint, p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_house_id bigint;
  v_mode text;
begin
  if not exists (select 1 from public.game_sessions gs where gs.id = p_game_session_id) then
    return;
  end if;
  v_house_id := private.lock_game_session(p_game_session_id);
  if not private.claim_request(p_request_id) then
    return;
  end if;
  select gs.round_mode into v_mode from public.game_sessions gs where gs.id = p_game_session_id;
  -- Manual: any round blocks it. Auto: the round opened at the start doesn't,
  -- while it can still be swapped (the start_round guard, canChangeRound()).
  if exists (
    select 1 from public.game_session_rounds r
    where r.game_session_id = p_game_session_id
      and (
        v_mode <> 'auto'
        or r.status <> 'open'
        or private.round_has_awards(r)
        or exists (
          select 1 from public.activity_log a
          where a.round_id = r.id
            and a.type not in ('round_started', 'check_in', 'check_in_undone')
        )
      )
  ) then
    raise exception 'game_session_has_rounds';
  end if;
  if exists (
    select 1 from public.activity_log a
    where a.game_session_id = p_game_session_id
      and a.type in ('recharge', 'payout', 'balance_transfer')
  ) then
    raise exception 'game_session_has_payments';
  end if;
  delete from public.game_sessions where id = p_game_session_id and house_id = v_house_id;
end;
$$;
