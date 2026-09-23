# Backend plan: houses, one admin, observers, live game sessions

> Instructions for the agent: implement this **one phase at a time**. At the end of each phase run
> `npm run typecheck && npm run lint`, run the phase's acceptance checks, then stop and summarize
> what changed before starting the next phase. Use the Supabase MCP (`apply_migration`,
> `get_advisors`, `generate_typescript_types`, `execute_sql`, `list_tables`) for all database work.
> Never edit an applied migration; add a new one.

## Context

- Auth is already live (`SUPABASE_AUTH.md`, `lib/supabase/*`, `proxy.ts`).
- All app data is still mock: players and rounds come from `data.json`, and the live game session lives in the `lib/round-draft/` reducer plus localStorage. `resetDraft()` wipes it when a game session ends.
- Supabase project `xrporompvbfjfmkfxkwa` has **0 tables**.

## Business rules (non-negotiable)

1. **The game session record must never be lost.** Every number assignment, balance change, timeline entry, round and winner is written to Postgres as it happens. The database is the source of truth from the first action; localStorage is no longer a store.
2. **Multi-house.** Today there is 1 house, later 3 to 50+. A user logs in and works inside their house. A user from another house sees nothing.
3. **Exactly one admin per house.** The admin is the only person who can operate: assign numbers, recharge balances, award prizes, close rounds, end the game session, and edit players and rounds.
4. **Everyone else is an observer.** Observers see everything in their house live, including a game session in progress, but cannot change anything. The database enforces this, not just the UI.
5. **The admin account can only be active in one session at a time.** If the admin logs in on a second device while the first is in use, the login screen warns them. If they continue, the old session is closed and can no longer write.
6. Reports and live information are reviewed daily.

## Architecture decisions

- **No ORM.** Use the Supabase client (`lib/supabase/server.ts` and `client.ts`) with generated types (`createServerClient<Database>`). An ORM like Prisma or Drizzle connects with a direct Postgres connection that bypasses RLS, which would remove the main security guarantee of this design.
- **No `app/api/` routes.** Reads happen in Server Components. Writes happen in Server Actions or via `supabase.rpc()`. API routes are only needed later if an external client (mobile app, webhook) appears.
- **No service/repository layers.** Keep data access in small files under `lib/data/`.
- **Postgres functions only where money moves**, so the balance and the ledger change together or not at all. Everything else is a plain insert/update guarded by RLS.
- **The TS business logic stays.** `prize-rules.ts` and the reducer keep computing amounts; the SQL functions validate and persist them.
- Realtime: observers refetch the game session when a new `activity_log` row arrives.

## Supabase Free plan constraints

This project stays on the Free plan. The design fits within it, but two limits need handling:

- **No automatic backups.** Because the game session record must never be lost, add `.github/workflows/db-backup.yml`: a nightly scheduled job that runs `supabase db dump` (schema) and `supabase db dump --data-only` using the connection string stored as a GitHub secret (`SUPABASE_DB_URL`), then uploads both files as a workflow artifact with 30-day retention. Document how to restore in `SUPABASE_AUTH.md`. Keep the repo private.
- **Projects pause after 7 days without activity.** Daily use prevents it, but the nightly backup job also queries the database, which covers holidays.
- Other limits (500 MB database, 200 concurrent Realtime connections, 2M Realtime messages/month) are far above what this app needs: ledger rows are tiny, and each open browser tab uses one Realtime connection. Use one channel per page and remove it on unmount so connections don't leak.

## Naming conventions

**All code nomenclature is in English**: tables, columns, functions, parameters, enum/check values, TypeScript types, file names, routes, error codes and activity types. **Only user-facing UI text is in Spanish** (buttons, labels, dialogs, toasts, report headings).

If existing code uses Spanish identifiers (for example a `'especial'` round kind or files named after "jornada"), rename them to the English term as part of the phase that touches them, and update every import and type. Do not rename UI text.

Glossary (business term in Spanish → name in code):

| Spanish (UI) | English (code) |
|---|---|
| Casa | house |
| Jornada | game session (`game_sessions`, `game_session_id`) |
| Cartón | ticket |
| Ronda / plantilla de ronda | round / round template |
| Ronda especial | `special` round kind |
| Jugador | player |
| Recarga | recharge |
| Premio | prize |
| Regalo | gift |
| Liquidación | settlement |
| Pago al jugador | payout |
| Efectivo / Transferencia / Otro | `cash` / `transfer` / `other` |
| Pagado / Pendiente | `paid` / `pending` |
| Observador | observer |

Note: "game session" (a jornada) is unrelated to the admin's **login** session, which lives in `admin_auth_sessions`. Keep the two names distinct.

## 1. Tenancy and roles

```sql
create table public.houses (
  id bigint generated always as identity primary key,
  name text not null,
  identifier text not null unique,
  timezone text not null default 'America/Mexico_City',
  created_at timestamptz not null default now()
);

create table public.house_members (
  house_id bigint not null references public.houses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'observer')),
  created_at timestamptz not null default now(),
  primary key (house_id, user_id)
);

-- Rule 3: at most one admin per house, enforced by the database.
create unique index house_members_one_admin
  on public.house_members (house_id) where role = 'admin';
```

- Current house: the user's membership ordered by `created_at` (deterministic), resolved in `app/(app)/layout.tsx` next to the existing `getUser()`. Expose `{ houseId, role }` to client components through a small context so `useRole()` works.
- For now the house, the admin and the observers are created with a seed SQL insert (the users must already exist in Supabase Auth). A members screen comes in Phase 6.

## 2. Single admin session

**Goal:** only one session of the admin account can write. A second login warns first, then takes over.

Supabase access tokens carry a `session_id` claim. The admin's current session is stored in a table, and `is_house_admin()` only returns true when the caller's `session_id` matches it. An old session keeps a valid token for up to an hour, but the database rejects every write from it.

```sql
create table public.admin_auth_sessions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  session_id uuid not null,
  claimed_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
alter table public.admin_auth_sessions enable row level security;
create policy "admin_auth_sessions: read own" on public.admin_auth_sessions
  for select to authenticated using (user_id = (select auth.uid()));
-- No insert/update/delete policies: written only through the functions below.
```

Functions (all `security definer`, `set search_path = ''`, execute granted to `authenticated` only):

- `admin_session_status()` returns `'not_admin' | 'none' | 'mine' | 'other_active' | 'other_stale'`. `other_active` means a different session was seen in the last 2 minutes.
- `claim_admin_session()`: raises unless the caller is an admin in some house, then upserts `(auth.uid(), current session_id)`.
- `admin_heartbeat()`: updates `last_seen_at = now()` only if the caller's session is the claimed one.

Login flow (adapt the existing login page/action):

1. `signInWithPassword` succeeds.
2. Call `admin_session_status()`.
   - `not_admin` → go to the app (observers may have several sessions).
   - `none`, `mine` or `other_stale` → call `claim_admin_session()`, then `supabase.auth.signOut({ scope: 'others' })`, then go to the app.
   - `other_active` → show a dialog: **"Esta cuenta ya está abierta en otro dispositivo. Si continúas, esa sesión se cerrará."** with buttons **"Continuar aquí"** (claim + sign out others + go to app) and **"Cancelar"** (`signOut({ scope: 'local' })`, stay on login).

Kicking the old session:

- Admin client subscribes via Realtime to `admin_auth_sessions` filtered `user_id=eq.<me>`. When `session_id` changes to something other than its own, it calls `signOut({ scope: 'local' })` and redirects to `/login?reason=replaced`, which shows **"Tu sesión se cerró porque se inició sesión en otro dispositivo."**
- Fallback: in `(app)/layout.tsx`, if the user is admin and `admin_auth_sessions.session_id` differs from the current token's `session_id`, sign out and redirect the same way.
- Fallback: any write that fails with `not_admin` for an admin user triggers the same redirect.
- While the admin tab is open, call `admin_heartbeat()` every 60 seconds.

Read the current `session_id` from the access token claims (`supabase.auth.getClaims()` if the installed supabase-js version has it, otherwise decode the access token).

## 3. Schema

Ids are `bigint generated always as identity` (keeps the existing `number` ids in `DraftPlayer`/`Round` working). Money is `numeric(12,2)`. **Every table has `house_id`** (denormalized on child tables so RLS policies never need joins). All timestamps are `timestamptz default now()`.

| table | purpose | key columns |
|---|---|---|
| `players` | house players + **cached current balance** | house_id, name, username, payment_method, positive_balance, negative_balance, active bool |
| `round_templates` | rounds configured on `/rounds` | house_id, name, kind ('regular','special'), winner_count, prizes numeric[] |
| `game_sessions` | one per day/session | house_id, number, status ('active','ended'), started_at, ended_at, house_balance, created_by |
| `session_players` | who plays in this game session | house_id, game_session_id, player_id, checked_in, pending_carryover, removed_at null |
| `tickets` | tickets (cartones) | house_id, game_session_id, index |
| `ticket_numbers` | the numbers of each ticket and who owns each | house_id, game_session_id, ticket_id, number, player_id null, is_gift; PK(ticket_id, number) |
| `session_rounds` | each round played | house_id, game_session_id, seq, name, kind, winning_numbers int[], status ('open','closed'), started_at, closed_at, margin_adjustment |
| `round_winners` | winners per round, **one row per winning ticket** | house_id, game_session_id, round_id, ticket_id, player_id, number, slot, prize |
| `activity_log` | **append-only timeline + money ledger** | house_id, game_session_id, round_id null, ticket_id null, number null, type, player_id null, description, amount numeric(12,2) null, payment_method text null, note text null, request_id uuid **unique**, created_by, created_at |

Constraints and indexes:

- `unique (house_id) where status = 'active'` on `game_sessions`: only one active game session per house.
- `unique (house_id, number)` on `game_sessions`. The number is assigned inside the `start_game_session` function (`max + 1`), never by the client.
- `unique (game_session_id, player_id)` on `session_players`; `unique (game_session_id, seq)` on `session_rounds`.
- `unique (round_id, ticket_id, number)` on `round_winners`: the same ticket and number can't be paid twice in one round.
- Indexes: `house_id` on every table, `game_session_id` on child tables, `activity_log (game_session_id, created_at desc)`.
- `activity_log.type` uses the existing `ActivityEntryType` values plus `'adjustment'` for corrections.

**Same number on several tickets:**

A position is identified by **(ticket, number)**, never by the number alone. If a player owns number 2 on tickets 1, 2, 3 and 4, that is 4 separate `ticket_numbers` rows, 4 separate `record_purchase` calls and 4 separate ledger rows, each with its own `ticket_id`.

- When number 2 wins a round, `close_round` / `award_prize` writes **one `round_winners` row per open ticket where number 2 is owned**, each with its `ticket_id`. How much each row pays comes from `prize-rules.ts`; the database just records every winning ticket separately.
- Every function that touches a number takes `ticket_id` + `number` as arguments, never `number` alone.
- In the UI and reports, always label positions as **"Cartón 3 · #2"**, so a player with the same number on several tickets sees each one.
- Mistakes are corrected per ticket: un-assigning #2 on ticket 3 does not affect #2 on the other tickets.

**Ledger rules:**

- Balances never change without an `activity_log` row, in the same transaction.
- `activity_log` is immutable: no update or delete, ever. A mistake is fixed with a compensating `adjustment` entry.
- Before writing the money functions, read the reducer and `prize-rules.ts` and **document in a SQL comment exactly how each entry type maps to `positive_balance` / `negative_balance` and the sign of `amount`.** The verification check in Phase 3 depends on this mapping.

## 4. Security

Helpers (both `stable security definer set search_path = ''`):

```sql
create function public.is_house_member(h bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.house_members m
    where m.house_id = h and m.user_id = (select auth.uid())
  );
$$;

create function public.is_house_admin(h bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.house_members m
    join public.admin_auth_sessions s on s.user_id = m.user_id
    where m.house_id = h
      and m.user_id = (select auth.uid())
      and m.role = 'admin'
      and s.session_id = ((select auth.jwt()) ->> 'session_id')::uuid
  );
$$;
```

**Explicit grants (required):** new tables in `public` are no longer exposed to the Data API automatically. In the migration, for every table add `grant select, insert, update on public.<table> to authenticated;` (only `select` for `activity_log`, `round_winners`, `houses`, `house_members`, `admin_auth_sessions`). Grant nothing to `anon`. RLS still decides which rows each user can touch.

RLS on every table:

- `select`: `is_house_member(house_id)`.
- `insert` / `update`: `is_house_admin(house_id)` (both `using` and `with check`).
- `delete`: none. Players are soft-deleted with `active = false`; game session players are removed with `removed_at`.
- `activity_log` and `round_winners`: select only. Rows are written exclusively by the functions below.
- `house_members`, `houses`: select only for members. Changes happen through seed SQL for now.

**Money functions** (`security definer`, `set search_path = ''`, `revoke execute ... from public, anon`, `grant execute ... to authenticated`):

`start_game_session`, `record_recharge`, `record_purchase` (assign number), `toggle_gift`, `award_prize`, `close_round`, `resolve_carryover`, `remove_player`, `end_game_session`, `record_payout`.

Every money function must:

1. Derive `house_id` from the row being touched (player, game session, round), never trust it from arguments. Check that all referenced rows belong to the same house.
2. `if not public.is_house_admin(h) then raise exception 'not_admin' using errcode = '42501'; end if;`
3. Validate inputs (amount > 0 where relevant, game session is `active`, round is `open`).
4. Insert the `activity_log` row with the client's `request_id` using `on conflict (request_id) do nothing`. If nothing was inserted, return without changing anything (this makes double-clicks and retries harmless).
5. Update `players` balances and the other tables.

Assigning a number must be conditional so two writes can't both win:
`update ticket_numbers set player_id = $1 where ticket_id = $2 and number = $3 and player_id is null`, raising `number_taken` if 0 rows changed.

Any reducer action that changes a balance (including gift toggles and removals with refunds) goes through a function. Non-money actions (check-in, add ticket, set active round) are a plain RLS-guarded insert/update plus an `activity_log` insert done in a small function, so every action produces exactly one log row.

## 5. How the live game session works

Keep `RoundDraftProvider` and the reducer. Change where state comes from and goes to.

1. **Load:** `/new-game` and `/active-round` are Server Components. They load the house's active game session and build a `RoundDraftState` with `lib/data/load-game-session.ts`, passed to the provider as `initialState`. This replaces `localRoundDraftRepository.load()`; delete `storage.ts`.
2. **Act (admin only):** `dispatch` stays optimistic for instant UI. A thin wrapper in `context.tsx` generates a `request_id` (`crypto.randomUUID()`) and calls the matching action in `lib/data/game-session-actions.ts`. On error: `sonner` toast with a Spanish message (`number_taken` → "Ese número ya fue asignado", `not_admin` → session-replaced redirect), then refetch and `HYDRATE`.
3. **Watch (everyone):** one Realtime subscription per active game session on `activity_log` filtered `game_session_id=eq.X`. On insert, refetch and dispatch `HYDRATE`. Debounce the refetch by ~250 ms, and skip it while the local admin has actions in flight (refetch once they settle) so optimistic state doesn't flicker.
4. **Observer UI:** `useRole()` hides the action buttons (assign, recharge, award, close round, end game session, edit player/round). Observers see a small "Solo lectura" badge. RLS is the real guard.
5. "Empezar ronda" calls `start_game_session` if none is active. "Terminar jornada" calls `end_game_session` (`status = 'ended'`); nothing is deleted. Remove `createSeedActivity`.

Enable Realtime publication on `activity_log` and `admin_auth_sessions` only.

## 5b. Settlement at the end of the game session

Business rule: payments to players happen **outside the app** (cash or transfer). After paying, the admin records each payment manually, player by player, with the method used.

- **Screen:** a settlement view for the game session at `/sessions/[id]/settlement` (component `settlement-page.tsx`, UI title "Liquidación"), reachable from the end-session flow and from `/sessions`. It lists every player in the game session with their current balance. Each row has a "Registrar pago" action that opens a small form: amount (prefilled with the full positive balance, editable for partial payments), payment method (prefilled from `players.payment_method`), and an optional note (e.g. transfer reference).
- **Function `record_payout(p_player_id, p_game_session_id, p_amount, p_payment_method, p_note, p_request_id)`:** same rules as every money function (admin + current session, derive `house_id`, idempotent `request_id`). It rejects `amount <= 0` and **rejects paying more than the player's positive balance**. It inserts an `activity_log` row of type `payout` with `payment_method` and `note`, and lowers the player's positive balance in the same transaction.
- **Allowed on ended game sessions.** Unlike the other money functions, `record_payout` works when the game session status is `ended`, because settlement happens after the game is over. It still requires the game session to belong to the same house.
- **Payment methods:** `payment_method` is text with `check (payment_method in ('cash','transfer','other'))` on both `players` and `activity_log`. `record_recharge` also accepts an optional payment method, so money coming in is tracked the same way as money going out.
- **Status per player:** computed as `paid` when the positive balance reaches 0 after payouts, `pending` otherwise (UI labels "Pagado" / "Pendiente"). This is computed from balances, not stored.
- **Corrections:** a wrong payout is fixed with an `adjustment` entry, never by editing the payout.
- Observers see the settlement screen and every payout live, read-only.

## 6. Phases

### Phase 1: Foundation
- Migration `supabase/migrations/<ts>_init.sql`: houses, members, admin_auth_sessions, all tables, constraints, indexes, RLS, helper functions, session functions.
- Seed: one house, the admin membership, observer memberships, current `data.json` players and rounds.
- Generate `lib/supabase/database.types.ts`; type both clients.
- Resolve `{ houseId, role }` in `(app)/layout.tsx`; add `useRole()`.

**Acceptance:** `list_tables` shows every table with RLS on. `get_advisors` (security) shows no warnings. Inserting a second admin for the same house fails.

- Nightly backup GitHub Action (see "Supabase Free plan constraints").

### Phase 2: Single admin session
- Session functions wired into the login flow, the dialog, the Realtime kick, the layout fallback, the heartbeat, and the `/login?reason=replaced` message.

**Acceptance:** Admin logged in on browser A. Logging in on browser B shows the dialog. "Cancelar" leaves A working. "Continuar aquí" makes A redirect to login with the message within a few seconds, and any write attempted from A's old token is rejected. An observer can log in on two browsers at once without any dialog.

### Phase 3: Players and rounds CRUD
- `lib/data/players.ts`, `lib/data/rounds.ts` server actions; `/players` and `/rounds` read from the DB.
- Replace `getBasePlayers()` / `getBaseRounds()` with DB data passed as props. Delete both `data.json` files.
- Observer: no edit/add/delete controls.

**Acceptance:** Rounds created on `/rounds` appear in the round picker. As observer, a forced write via the browser console (`supabase.from('players').insert(...)`) is rejected.

### Phase 4: Live game session persisted
- Loader, game session actions and all money functions wired to each reducer action: `ASSIGN_NUMBER`, `TOGGLE_GIFT`, `TOGGLE_CHECK_IN`, `RECHARGE_BALANCE`, `AWARD_PRIZE`, `CLOSE_ROUND`, `RESOLVE_CARRYOVER`, `REMOVE_PLAYER`, end game session.

**Acceptance:** Run a full game session as admin (assign numbers, recharge, award, close 2 rounds, end). Include one player who owns the same number on 4 open tickets: when that number wins, `round_winners` has 4 rows with 4 different `ticket_id`s, and the timeline shows each labeled as "Cartón N · #X". Reload mid-session and nothing is lost. Double-clicking "Recargar" records one recharge. With `execute_sql`, each player's balances match the ledger according to the documented mapping. As observer, `supabase.rpc('record_recharge', ...)` is rejected.

- `record_payout` + the settlement screen (section 5b).

**Settlement acceptance:** after ending the test game session, record a partial payout by `transfer` and a full payout in `cash`. Balances drop accordingly, the timeline shows both with their method, paying more than the balance is rejected, and double-clicking "Registrar pago" records one payment.

### Phase 5: Realtime and observer view
- `activity_log` subscription + debounced `HYDRATE`; `useRole()` gating in every action component; "Solo lectura" badge.

**Acceptance:** Admin in one browser, observer in another: the observer sees each assignment and award appear within ~1 second and has no action buttons. A user from a second test house sees nothing from the first house.

### Phase 6: Reports and members
- `/sessions`: list of game sessions. `/reports?session=id`: rounds, winners, timeline, per-player totals, from SQL. The report includes a **cash summary**: total recharges and total payouts per payment method, and the players still pending payment. "Daily" grouping uses `houses.timezone`, with a game session counted on its start date.
- `RoundHistoryCard` and `player-rounds-dialog` use real rounds; the "Jornada #42" heading uses the real number.
- Optional: a members page where the admin invites observers by email through a server action using the service-role key (server-only, never exposed to the client).

**Acceptance:** A report for an ended game session matches what happened in the Phase 4 test run.

## Later (not now)
House switcher, transferring the admin role to another member, dashboard metrics, offline queue.

## Files
New: `supabase/migrations/*_init.sql`, `lib/supabase/database.types.ts`, `lib/data/{house,session,players,rounds,load-game-session,game-session-actions}.ts`.

Modified: `lib/round-draft/{context.tsx,types.ts,players.ts}`, `lib/rounds.ts`, `lib/supabase/{server,client}.ts`, the login page/action, `app/(app)/{layout,players,rounds,new-game,active-round,sessions,reports}/page.tsx`, `components/player-page.tsx`, `components/session-page.tsx`, close-round/end-session dialogs, `round-history-card.tsx`, `CLAUDE.md` (remove "UI-only prototype", describe this architecture), `SUPABASE_AUTH.md` (tenancy + single admin session).

Delete: `lib/round-draft/storage.ts`, `players/data.json`, `rounds/data.json`.
