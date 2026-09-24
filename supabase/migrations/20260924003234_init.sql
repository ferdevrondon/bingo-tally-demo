-- =============================================================================
-- BACKEND_PLAN.md Phase 1 — foundation: tenancy, roles, single admin session,
-- game-session schema, RLS. No money functions yet (Phase 4).
--
-- Security model
--   * Every table carries house_id. Child rows reference their parent with a
--     composite (parent_id, house_id) foreign key, so a row can never point at
--     a parent from another house.
--   * RLS: members of a house can read it; only the house admin whose *current*
--     login session is the claimed one can write (private.is_house_admin).
--   * Direct writes are granted only on players and round_templates. Every
--     game-session table is select-only for API roles: Phase 4 writes them
--     through functions so a balance never changes without its ledger row.
--   * RLS helpers are SECURITY DEFINER but live in the unexposed `private`
--     schema, so they are not callable through the Data API (lints 0028/0029).
-- =============================================================================

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- -----------------------------------------------------------------------------
-- 1. Tenancy and roles
-- -----------------------------------------------------------------------------

create table public.houses (
  id bigint generated always as identity primary key,
  name text not null,
  identifier text not null unique,
  timezone text not null default 'America/Mexico_City',
  created_at timestamptz not null default now()
);

create table public.house_members (
  house_id bigint not null references public.houses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('admin', 'observer')),
  created_at timestamptz not null default now(),
  primary key (house_id, user_id)
);
create index house_members_user_id_idx on public.house_members (user_id);

-- Business rule 3: at most one admin per house, enforced by the database.
create unique index house_members_one_admin
  on public.house_members (house_id) where role = 'admin';

-- -----------------------------------------------------------------------------
-- 2. Single admin session
-- -----------------------------------------------------------------------------

create table public.admin_auth_sessions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  session_id uuid not null,
  claimed_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 3. House catalog: players and round templates (direct CRUD by the admin)
-- -----------------------------------------------------------------------------

create table public.players (
  id bigint generated always as identity primary key,
  house_id bigint not null references public.houses (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  username text,
  payment_method text
    check (payment_method in ('cash', 'transfer', 'paypal', 'credit_card', 'debit_card', 'other')),
  is_vip boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, house_id)
);
create index players_house_id_idx on public.players (house_id);

create table public.round_templates (
  id bigint generated always as identity primary key,
  house_id bigint not null references public.houses (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  kind text not null check (kind in ('regular', 'special')),
  winner_count smallint not null,
  -- Business rule 8: the line price lives on the round template.
  line_price numeric(12, 2) not null check (line_price > 0),
  -- Informational only: paid prizes derive from kind and line_price.
  prizes numeric(12, 2)[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check ((kind = 'regular' and winner_count = 1) or (kind = 'special' and winner_count = 2))
);
create index round_templates_house_id_idx on public.round_templates (house_id);

-- -----------------------------------------------------------------------------
-- 4. Live game sessions (written only by Phase 4 functions)
-- -----------------------------------------------------------------------------

create table public.game_sessions (
  id bigint generated always as identity primary key,
  house_id bigint not null references public.houses (id) on delete cascade,
  number integer not null check (number > 0),
  status text not null default 'active' check (status in ('active', 'ended')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  house_balance numeric(12, 2) not null default 0,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (house_id, number),
  unique (id, house_id),
  check ((status = 'ended') = (ended_at is not null))
);
-- Only one active game session per house.
create unique index game_sessions_one_active
  on public.game_sessions (house_id) where status = 'active';

create table public.game_session_players (
  id bigint generated always as identity primary key,
  house_id bigint not null,
  game_session_id bigint not null,
  player_id bigint not null,
  -- Business rule 7: balances are per game session.
  positive_balance numeric(12, 2) not null default 0 check (positive_balance >= 0),
  negative_balance numeric(12, 2) not null default 0 check (negative_balance >= 0),
  checked_in boolean not null default false,
  pending_carryover boolean not null default false,
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (game_session_id, player_id),
  foreign key (game_session_id, house_id)
    references public.game_sessions (id, house_id) on delete cascade,
  foreign key (player_id, house_id) references public.players (id, house_id)
);
create index game_session_players_house_id_idx on public.game_session_players (house_id);
create index game_session_players_player_id_idx on public.game_session_players (player_id, house_id);

create table public.tickets (
  id bigint generated always as identity primary key,
  house_id bigint not null,
  game_session_id bigint not null,
  index integer not null check (index > 0),
  created_at timestamptz not null default now(),
  unique (game_session_id, index),
  unique (id, house_id),
  foreign key (game_session_id, house_id)
    references public.game_sessions (id, house_id) on delete cascade
);
create index tickets_house_id_idx on public.tickets (house_id);

create table public.ticket_numbers (
  house_id bigint not null,
  game_session_id bigint not null,
  ticket_id bigint not null,
  number smallint not null check (number between 1 and 15),
  player_id bigint,
  is_gift boolean not null default false,
  primary key (ticket_id, number),
  check (player_id is not null or not is_gift),
  foreign key (ticket_id, house_id) references public.tickets (id, house_id) on delete cascade,
  foreign key (game_session_id, house_id)
    references public.game_sessions (id, house_id) on delete cascade,
  foreign key (player_id, house_id) references public.players (id, house_id)
);
create index ticket_numbers_house_id_idx on public.ticket_numbers (house_id);
create index ticket_numbers_game_session_id_idx on public.ticket_numbers (game_session_id, house_id);
create index ticket_numbers_player_id_idx on public.ticket_numbers (player_id, house_id);

create table public.game_session_rounds (
  id bigint generated always as identity primary key,
  house_id bigint not null,
  game_session_id bigint not null,
  seq integer not null check (seq > 0),
  round_template_id bigint references public.round_templates (id) on delete set null,
  name text not null,
  kind text not null check (kind in ('regular', 'special')),
  -- Snapshot of the template's line price when the round starts.
  line_price numeric(12, 2) not null check (line_price > 0),
  winning_numbers smallint[] not null default '{}',
  status text not null default 'open' check (status in ('open', 'closed')),
  started_at timestamptz not null default now(),
  closed_at timestamptz,
  margin_adjustment numeric(12, 2),
  unique (game_session_id, seq),
  unique (id, house_id),
  check ((status = 'closed') = (closed_at is not null)),
  foreign key (game_session_id, house_id)
    references public.game_sessions (id, house_id) on delete cascade
);
-- At most one open round per game session.
create unique index game_session_rounds_one_open
  on public.game_session_rounds (game_session_id) where status = 'open';
create index game_session_rounds_house_id_idx on public.game_session_rounds (house_id);
create index game_session_rounds_round_template_id_idx
  on public.game_session_rounds (round_template_id);

create table public.round_winners (
  id bigint generated always as identity primary key,
  house_id bigint not null,
  game_session_id bigint not null,
  round_id bigint not null,
  ticket_id bigint not null,
  player_id bigint not null,
  number smallint not null check (number between 1 and 15),
  slot smallint not null check (slot >= 0),
  prize numeric(12, 2) not null check (prize >= 0),
  created_at timestamptz not null default now(),
  -- The same ticket and number can't be paid twice in one round.
  unique (round_id, ticket_id, number),
  foreign key (round_id, house_id)
    references public.game_session_rounds (id, house_id) on delete cascade,
  foreign key (ticket_id, house_id) references public.tickets (id, house_id) on delete cascade,
  foreign key (game_session_id, house_id)
    references public.game_sessions (id, house_id) on delete cascade,
  foreign key (player_id, house_id) references public.players (id, house_id)
);
create index round_winners_house_id_idx on public.round_winners (house_id);
create index round_winners_game_session_id_idx on public.round_winners (game_session_id, house_id);
create index round_winners_ticket_id_idx on public.round_winners (ticket_id, house_id);
create index round_winners_player_id_idx on public.round_winners (player_id, house_id);

-- Append-only timeline + money ledger. The ledger mapping (which type moves
-- which balance, and the sign of amount) is documented in BACKEND_PLAN.md §3
-- and is implemented by the Phase 4 functions.
create table public.activity_log (
  id bigint generated always as identity primary key,
  house_id bigint not null,
  game_session_id bigint not null,
  round_id bigint,
  ticket_id bigint,
  number smallint check (number between 1 and 15),
  type text not null check (type in (
    'game_session_started', 'game_session_ended',
    'player_added', 'player_removed',
    'ticket_added',
    'number_purchased', 'number_released', 'number_reassigned',
    'number_gifted', 'number_ungifted',
    'recharge', 'check_in', 'check_in_undone',
    'round_started', 'round_closed', 'prize_won', 'margin_adjustment',
    'carryover_kept', 'carryover_released',
    'payout', 'adjustment'
  )),
  player_id bigint,
  amount numeric(12, 2),
  payment_method text
    check (payment_method in ('cash', 'transfer', 'paypal', 'credit_card', 'debit_card', 'other')),
  note text,
  -- Client-generated idempotency key: double-clicks and retries write once.
  request_id uuid not null unique,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (game_session_id, house_id)
    references public.game_sessions (id, house_id) on delete cascade,
  foreign key (round_id, house_id)
    references public.game_session_rounds (id, house_id) on delete cascade,
  foreign key (ticket_id, house_id) references public.tickets (id, house_id) on delete cascade,
  foreign key (player_id, house_id) references public.players (id, house_id)
);
create index activity_log_house_id_idx on public.activity_log (house_id);
create index activity_log_game_session_created_idx
  on public.activity_log (game_session_id, created_at desc);
create index activity_log_round_id_idx on public.activity_log (round_id, house_id);
create index activity_log_ticket_id_idx on public.activity_log (ticket_id, house_id);
create index activity_log_player_id_idx on public.activity_log (player_id, house_id);

-- The ledger is immutable: corrections are new `adjustment` rows. Deletes are
-- still possible only through the game-session cascade used by
-- discard_game_session (Phase 4), the one documented exception.
create function private.reject_activity_log_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'activity_log is append-only' using errcode = '42501';
end;
$$;

create trigger activity_log_no_update
  before update on public.activity_log
  for each row execute function private.reject_activity_log_update();

-- -----------------------------------------------------------------------------
-- 5. RLS helpers (private schema: not exposed through the Data API)
-- -----------------------------------------------------------------------------

create function private.current_session_id()
returns uuid
language sql
stable
set search_path = ''
as $$
  select nullif((select auth.jwt()) ->> 'session_id', '')::uuid;
$$;

create function private.is_house_member(h bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.house_members m
    where m.house_id = h and m.user_id = (select auth.uid())
  );
$$;

create function private.is_admin_anywhere()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.house_members m
    where m.user_id = (select auth.uid()) and m.role = 'admin'
  );
$$;

-- True only for the house admin whose current login session is the claimed
-- one (business rule 5): an old session keeps a valid JWT for up to an hour,
-- but every write from it is rejected.
create function private.is_house_admin(h bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.house_members m
    join public.admin_auth_sessions s on s.user_id = m.user_id
    where m.house_id = h
      and m.user_id = (select auth.uid())
      and m.role = 'admin'
      and s.session_id = private.current_session_id()
  );
$$;

revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;

-- -----------------------------------------------------------------------------
-- 6. Single admin session functions (SECURITY INVOKER: they run as the caller
--    and are limited by the admin_auth_sessions policies below, which only let
--    an admin write their own row with their current session id).
-- -----------------------------------------------------------------------------

create function public.admin_session_status()
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_row public.admin_auth_sessions%rowtype;
begin
  if not private.is_admin_anywhere() then
    return 'not_admin';
  end if;

  select * into v_row from public.admin_auth_sessions where user_id = (select auth.uid());
  if not found then
    return 'none';
  end if;
  if v_row.session_id = private.current_session_id() then
    return 'mine';
  end if;
  if v_row.last_seen_at > now() - interval '2 minutes' then
    return 'other_active';
  end if;
  return 'other_stale';
end;
$$;

create function public.claim_admin_session()
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_session uuid := private.current_session_id();
begin
  if not private.is_admin_anywhere() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if v_session is null then
    raise exception 'missing_session_id' using errcode = '22023';
  end if;

  insert into public.admin_auth_sessions (user_id, session_id, claimed_at, last_seen_at)
  values ((select auth.uid()), v_session, now(), now())
  on conflict (user_id) do update
    set session_id = excluded.session_id,
        claimed_at = excluded.claimed_at,
        last_seen_at = excluded.last_seen_at;
end;
$$;

create function public.admin_heartbeat()
returns void
language sql
set search_path = ''
as $$
  update public.admin_auth_sessions
  set last_seen_at = now()
  where user_id = (select auth.uid())
    and session_id = private.current_session_id();
$$;

revoke all on function public.admin_session_status() from public, anon;
revoke all on function public.claim_admin_session() from public, anon;
revoke all on function public.admin_heartbeat() from public, anon;
grant execute on function public.admin_session_status() to authenticated;
grant execute on function public.claim_admin_session() to authenticated;
grant execute on function public.admin_heartbeat() to authenticated;

-- -----------------------------------------------------------------------------
-- 7. Grants: nothing for anon; select for authenticated; direct writes only
--    where the plan allows them. RLS then decides which rows.
-- -----------------------------------------------------------------------------

revoke all on
  public.houses, public.house_members, public.admin_auth_sessions,
  public.players, public.round_templates,
  public.game_sessions, public.game_session_players, public.tickets, public.ticket_numbers,
  public.game_session_rounds, public.round_winners, public.activity_log
from anon, authenticated;

grant select on
  public.houses, public.house_members, public.admin_auth_sessions,
  public.players, public.round_templates,
  public.game_sessions, public.game_session_players, public.tickets, public.ticket_numbers,
  public.game_session_rounds, public.round_winners, public.activity_log
to authenticated;

grant insert, update on public.players, public.round_templates to authenticated;
-- Only for claim_admin_session / admin_heartbeat (invoker functions); the
-- policies restrict it to the caller's own row and current session.
grant insert, update on public.admin_auth_sessions to authenticated;

-- -----------------------------------------------------------------------------
-- 8. Row Level Security
-- -----------------------------------------------------------------------------

alter table public.houses enable row level security;
alter table public.house_members enable row level security;
alter table public.admin_auth_sessions enable row level security;
alter table public.players enable row level security;
alter table public.round_templates enable row level security;
alter table public.game_sessions enable row level security;
alter table public.game_session_players enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_numbers enable row level security;
alter table public.game_session_rounds enable row level security;
alter table public.round_winners enable row level security;
alter table public.activity_log enable row level security;

create policy "houses: members read" on public.houses
  for select to authenticated using ((select private.is_house_member(id)));

create policy "house_members: members read" on public.house_members
  for select to authenticated using ((select private.is_house_member(house_id)));

create policy "admin_auth_sessions: read own" on public.admin_auth_sessions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "admin_auth_sessions: admin claims own current session" on public.admin_auth_sessions
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select private.is_admin_anywhere())
    and session_id = (select private.current_session_id())
  );
create policy "admin_auth_sessions: admin updates own current session" on public.admin_auth_sessions
  for update to authenticated
  using (user_id = (select auth.uid()) and (select private.is_admin_anywhere()))
  with check (
    user_id = (select auth.uid())
    and session_id = (select private.current_session_id())
  );

create policy "players: members read" on public.players
  for select to authenticated using ((select private.is_house_member(house_id)));
create policy "players: admin inserts" on public.players
  for insert to authenticated with check ((select private.is_house_admin(house_id)));
create policy "players: admin updates" on public.players
  for update to authenticated
  using ((select private.is_house_admin(house_id)))
  with check ((select private.is_house_admin(house_id)));

create policy "round_templates: members read" on public.round_templates
  for select to authenticated using ((select private.is_house_member(house_id)));
create policy "round_templates: admin inserts" on public.round_templates
  for insert to authenticated with check ((select private.is_house_admin(house_id)));
create policy "round_templates: admin updates" on public.round_templates
  for update to authenticated
  using ((select private.is_house_admin(house_id)))
  with check ((select private.is_house_admin(house_id)));

create policy "game_sessions: members read" on public.game_sessions
  for select to authenticated using ((select private.is_house_member(house_id)));
create policy "game_session_players: members read" on public.game_session_players
  for select to authenticated using ((select private.is_house_member(house_id)));
create policy "tickets: members read" on public.tickets
  for select to authenticated using ((select private.is_house_member(house_id)));
create policy "ticket_numbers: members read" on public.ticket_numbers
  for select to authenticated using ((select private.is_house_member(house_id)));
create policy "game_session_rounds: members read" on public.game_session_rounds
  for select to authenticated using ((select private.is_house_member(house_id)));
create policy "round_winners: members read" on public.round_winners
  for select to authenticated using ((select private.is_house_member(house_id)));
create policy "activity_log: members read" on public.activity_log
  for select to authenticated using ((select private.is_house_member(house_id)));
