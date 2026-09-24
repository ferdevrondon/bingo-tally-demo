# Backend plan: houses, one admin, observers, live game sessions

> Instructions for the agent: implement this **one phase at a time**. At the end of each phase run
> `npm run typecheck && npm run lint`, run the phase's acceptance checks, then stop and summarize
> what changed before starting the next phase. Use the Supabase MCP (`apply_migration`,
> `get_advisors`, `generate_typescript_types`, `execute_sql`, `list_tables`) for all database work.
> Never edit an applied migration; add a new one. When a phase adds or changes screens, update
> `docs/screens-registry.md` through the `ui-project-agent` (`/ui-audit`) before closing the phase.

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
7. **Balances are per game session.** Every game session starts each player at 0. Positive/negative balances live on `game_session_players`, not on `players`, and are settled at the end of the game session (section 5b).
8. **The line price ("Precio de linea") is configured per round template** (`round_templates.line_price`) and copied onto the round when it starts (`game_session_rounds.line_price`), so editing a template never alters a round in progress. Every charge, refund and prize uses the price of the **open round**.
9. **No number without an open round.** A number can only be assigned while the game session has an open round; `/new-game` requires picking the round first.
10. **Purchases always create debt.** Buying a number adds the price to `negative_balance`; it never consumes `positive_balance`. Debt is paid at check-in (or by a recharge).

## Architecture decisions

- **No ORM.** Use the Supabase client (`lib/supabase/server.ts` and `client.ts`) with generated types (`createServerClient<Database>`). An ORM like Prisma or Drizzle connects with a direct Postgres connection that bypasses RLS, which would remove the main security guarantee of this design.
- **No `app/api/` routes.** Reads happen in Server Components. Writes happen in Server Actions or via `supabase.rpc()`. API routes are only needed later if an external client (mobile app, webhook) appears.
- **No service/repository layers.** Keep data access in small files under `lib/data/`.
- **Always the user's client.** `lib/data/*` Server Functions use `lib/supabase/server.ts` (the signed-in user's cookie), so RLS and `is_house_admin()` apply to every call. Next 16 Server Functions are reachable by direct POST, so authorization must never depend on the UI. The service-role key is never used, except server-side for the optional members invite in Phase 6.
- **Postgres functions for every game-session action**, so the state change and its ledger/timeline row are written together or not at all. Plain RLS-guarded insert/update is used for CRUD outside the live game session (players, round templates).
- **The TS business logic stays for the optimistic UI.** `prize-rules.ts` and the reducer keep computing amounts so the screen updates instantly, but the SQL functions compute the persisted amounts themselves (same rules, price from the open round's `line_price`) and never trust amounts from the client. After each write the client can `HYDRATE` from the database.
- Realtime: observers refetch the game session when a new `activity_log` row arrives.

## Supabase Free plan constraints

This project stays on the Free plan. The design fits within it, but two limits need handling:

- **No automatic backups.** Because the game session record must never be lost, add `.github/workflows/db-backup.yml`: a nightly scheduled job that runs `supabase db dump` (schema) and `supabase db dump --data-only` using the connection string stored as a GitHub secret (`SUPABASE_DB_URL`), then uploads both files as a workflow artifact with 30-day retention. Document how to restore in `SUPABASE_AUTH.md`. The repo (`ED-bingo/admin_bingo_v1`) is private; keep it that way, since the dumps contain player data.
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
| Efectivo / Transferencia / Paypal / Tarjeta de crédito / Tarjeta de débito / Otro | `cash` / `transfer` / `paypal` / `credit_card` / `debit_card` / `other` |
| Pagado / Pendiente | `paid` / `pending` |
| Observador | observer |

Note: "game session" (a jornada) is unrelated to the admin's **login** session, which lives in `admin_auth_sessions`. Keep the two names distinct.

Routes and existing components keep the shorter "game" name: `/games`, `/games/[id]`, `/games/[id]/settlement`, `game-page.tsx`, `game-detail-page.tsx`. The database uses `game_sessions`. `Game.status` becomes `'active' | 'ended'` (today `"finished"`).

Known Spanish identifiers to rename (in the phase that touches each file):

| Where | Today | Rename to |
|---|---|---|
| `lib/round-draft/prize-rules.ts`, `types.ts`, `context.tsx` (`inferRoundKind`), `lib/rounds.ts`, `round-form.tsx`, `close-round-dialog.tsx`, `tickets-assignment-page.tsx`, `rounds-page.tsx` | round kind `"especial"` | `"special"` |
| `player-page.tsx`, `lib/round-draft/players.ts`, example comment in `data-table.tsx` | row keys `Nombre`, `usuario`, `metodo de pago`, `saldo positivo`, `saldo negativo` | `name`, `username`, `paymentMethod`, `positiveBalance`, `negativeBalance` |
| `rounds-page.tsx`, `lib/rounds.ts` | row keys `Nombre`, `Tipo`, `Numeros ganadores`, `Premios` | `name`, `kind`, `winnerCount`, `prizes` |
| `tabs-solid.tsx` | tab values `rondas`, `deudas`, `mensual`, `diario` | `rounds`, `debts`, `monthly`, `daily` |
| `player-form.tsx`, `player-page.tsx` | payment method values `"Paypal"`, `"Tarjeta de crédito"`, `"Tarjeta de débito"`, `"Transferencia"`, `"Efectivo"` | `paypal`, `credit_card`, `debit_card`, `transfer`, `cash` (labels stay in Spanish) |
| `game-detail-page.tsx` | variables `saldo`, `saldoIsPositive` | `balance`, `isBalancePositive` |

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
- **Seed admin (temporary):** `ferdevrondon@gmail.com`. This account will be replaced later; write the seed so the admin is looked up by email in one place (a single `select id from auth.users where email = …`), so swapping it is a one-line change plus a `house_members` update. No observers are seeded yet; add them when their emails are known.

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
-- Insert/update policies only let an admin write their OWN row with their
-- CURRENT session_id (see the init migration).
```

Functions (all **`security invoker`**, `set search_path = ''`, execute granted to `authenticated` only). They run as the caller and are bounded by the `admin_auth_sessions` policies above, so they are no more powerful than a direct write of the caller's own row. Being invoker keeps them out of Supabase lints 0028/0029 (security definer functions callable through the API).

- `admin_session_status()` returns `'not_admin' | 'none' | 'mine' | 'other_active' | 'other_stale'`. `other_active` means a different session was seen in the last 2 minutes.
- `claim_admin_session()`: raises unless the caller is an admin in some house, then upserts `(auth.uid(), current session_id)`.
- `admin_heartbeat()`: updates `last_seen_at = now()` only if the caller's session is the claimed one.

Login flow (adapt the existing login page/action):

The current `signInWithPassword` server action (`lib/supabase/actions.ts`) ends with `redirect("/")`. It must instead return a state (`{ status: 'ok' | 'other_active' }`) so the login form can show the dialog before navigating. **Google OAuth** (`signInWithGoogle` → `app/auth/callback/route.ts`) must run the same check: after `exchangeCodeForSession`, call `admin_session_status()`; for `other_active`, redirect to `/login?confirm=takeover` and show the same dialog there. The admin may sign in with Google; the check is the same for both paths.

1. `signInWithPassword` succeeds.
2. Call `admin_session_status()`.
   - `not_admin` → go to the app (observers may have several sessions).
   - `none`, `mine` or `other_stale` → call `claim_admin_session()`, then `supabase.auth.signOut({ scope: 'others' })`, then go to the app.
   - `other_active` → show a dialog that asks the admin which device keeps the session: **"Esta cuenta ya está abierta en otro dispositivo. ¿Quieres mantener la sesión aquí o cerrarla y seguir en el otro dispositivo?"** with two buttons:
     - **"Mantener sesión aquí"**: claim + `signOut({ scope: 'others' })` + go to app. The other device is kicked out (see below).
     - **"Seguir en el otro dispositivo"**: `signOut({ scope: 'local' })` and stay on `/login`. The other device keeps working untouched.

Kicking the old session:

- Admin client subscribes via Realtime to `admin_auth_sessions` filtered `user_id=eq.<me>`. When `session_id` changes to something other than its own, it calls `signOut({ scope: 'local' })` and redirects to `/login?reason=replaced`, which shows **"Tu sesión se cerró porque se inició sesión en otro dispositivo."**
- Fallback: in `(app)/layout.tsx`, if the user is admin and `admin_auth_sessions.session_id` differs from the current token's `session_id`, sign out and redirect the same way.
- Fallback: any write that fails with `not_admin` for an admin user triggers the same redirect.
- While the admin tab is open, call `admin_heartbeat()` every 60 seconds.

Read the current `session_id` from the access token claims with `supabase.auth.getClaims()` (available in the installed `@supabase/supabase-js` 2.116).

## 3. Schema

Ids are `bigint generated always as identity` (keeps the existing `number` ids in `DraftPlayer`/`Round` working). Money is `numeric(12,2)`. **Every table has `house_id`** (denormalized on child tables so RLS policies never need joins). All timestamps are `timestamptz default now()`.

| table | purpose | key columns |
|---|---|---|
| `players` | house player catalog (no balances) | house_id, name, username, payment_method, is_vip bool, active bool |
| `round_templates` | rounds configured on `/rounds` | house_id, name, kind ('regular','special'), winner_count, line_price numeric(12,2) not null check (line_price > 0), prizes numeric[] (informational only: the paid prize is always derived from `kind` and `line_price`) |
| `game_sessions` | one per day/session | house_id, number, status ('active','ended'), started_at, ended_at, house_balance, created_by |
| `game_session_players` | who plays in this game session **+ their balances for this game session** | house_id, game_session_id, player_id, positive_balance, negative_balance, checked_in, pending_carryover, removed_at null |
| `tickets` | tickets (cartones) | house_id, game_session_id, index |
| `ticket_numbers` | the numbers of each ticket and who owns each | house_id, game_session_id, ticket_id, number, player_id null, is_gift; PK(ticket_id, number) |
| `game_session_rounds` | each round played | house_id, game_session_id, seq, round_template_id, name, kind, line_price (copied from the template when the round starts), winning_numbers int[], status ('open','closed'), started_at, closed_at, margin_adjustment |
| `round_winners` | winners per round, **one row per winning ticket** | house_id, game_session_id, round_id, ticket_id, player_id, number, slot, prize |
| `activity_log` | **append-only timeline + money ledger** | house_id, game_session_id, round_id null, ticket_id null, number null, type, player_id null, amount numeric(12,2) null, payment_method text null, note text null, request_id uuid **unique**, created_by, created_at |

`activity_log` stores **structured data only, no Spanish text**. The UI builds the sentence from `type` + the columns (e.g. "Cartón 3 · #2", "Ana Torres recargó $50"). `note` is free text typed by the admin (e.g. a transfer reference), not generated text.

Ticket ids become `bigint` like every other id. Today `Ticket.id` is a string (`ticket-1-<timestamp>`), so `Ticket.id` changes to `number` in `types.ts` and in every `ticketId` payload.

Constraints and indexes:

- `unique (house_id) where status = 'active'` on `game_sessions`: only one active game session per house.
- `unique (house_id, number)` on `game_sessions`. The number is assigned inside the `start_game_session` function (`max + 1`), never by the client.
- `unique (game_session_id, player_id)` on `game_session_players`; `unique (game_session_id, seq)` on `game_session_rounds`.
- `unique (round_id, ticket_id, number)` on `round_winners`: the same ticket and number can't be paid twice in one round.
- Indexes: `house_id` on every table, `game_session_id` on child tables, `activity_log (game_session_id, created_at desc)`.
- `activity_log.type` uses the existing `ActivityEntryType` values that real actions produce, plus `'number_released'`, `'number_reassigned'`, `'check_in_undone'`, `'number_ungifted'` (today `number_changed` covers both a swap and removing a gift; split it), `'margin_adjustment'`, `'carryover_kept'` / `'carryover_released'` (today `numbers_kept` / `numbers_released`, renamed so they don't read like `number_released`), `'payout'`, `'game_session_started'`, `'game_session_ended'` and `'adjustment'` for corrections. Drop `special_round_won` and `game_closed`: only the seed data (`createSeedActivity`) uses them.
- `payment_method` is `check (payment_method in ('cash','transfer','paypal','credit_card','debit_card','other'))` on `players` and `activity_log`. The seed maps the current `data.json` values: Efectivo → `cash`, Transferencia → `transfer`, Paypal → `paypal`, Tarjeta de crédito → `credit_card`, Tarjeta de débito → `debit_card`.

**Same number on several tickets:**

A position is identified by **(ticket, number)**, never by the number alone. If a player owns number 2 on tickets 1, 2, 3 and 4, that is 4 separate `ticket_numbers` rows, 4 separate `record_purchase` calls and 4 separate ledger rows, each with its own `ticket_id`.

- There is no "open/closed ticket": every ticket plays every round, and owned numbers carry over from round to round until released (carryover) or reassigned.
- When number 2 wins a round, **`award_prize`** (not `close_round`; prizes are paid the moment a winning number is entered, as `AWARD_PRIZE` does today) writes **one `round_winners` row per ticket where number 2 is owned**, each with its `ticket_id`, and **one `prize_won` ledger row per ticket**. Each ticket pays the full per-ticket prize: nothing is split between tickets or between players. A gifted ticket pays 90% and the house keeps 10%. Today the reducer writes a single aggregated log line per player ("N líneas"); that becomes one row per ticket.
- `award_prize` computes the prize in SQL from the round `kind`, the slot and the round's `line_price` (multiplier 10 for a regular round; 10 and 5 for the two slots of a special round), mirroring `prize-rules.ts`. It never trusts an amount sent by the client.
- Every function that touches a number takes `ticket_id` + `number` as arguments, never `number` alone.
- In the UI and reports, always label positions as **"Cartón 3 · #2"**, so a player with the same number on several tickets sees each one.
- Mistakes are corrected per ticket: un-assigning #2 on ticket 3 does not affect #2 on the other tickets.

**Ledger rules:**

- Balances never change without an `activity_log` row, in the same transaction.
- `activity_log` is immutable: no update or delete, ever. A mistake is fixed with a compensating `adjustment` entry.
- Copy the mapping below into a SQL comment in the migration. The verification check in Phase 4 depends on it. `P` = `line_price` of the open round (`game_session_rounds.line_price`). "Pay debt first" means: `debt_paid = least(negative_balance, x)`, `negative_balance -= debt_paid`, `positive_balance += x - debt_paid`.

| type | `amount` (sign) | negative_balance | positive_balance | game_sessions.house_balance |
|---|---|---|---|---|
| `recharge` | +x | pay debt first | gets the remainder | +x |
| `number_purchased` | +P (charged) | +P, `checked_in = false` | not touched (purchases never use credit) | — |
| `number_released` (un-assign, not a gift) | −P (refund) | pay debt first | gets the remainder | — |
| `number_gifted` | −P (refund) | pay debt first | gets the remainder | — (absorbed at round close) |
| `number_ungifted` | +P | +P, `checked_in = false` | — | — |
| `number_reassigned` | two rows: refund previous owner (unless the number was a gift) and charge the new owner | as released / purchased | as released / purchased | — |
| `check_in` | +debt (paid, with `payment_method`) | set to 0 | — | +debt |
| `prize_won` (one row per ticket) | +prize (paid ticket: `mult × P`; gifted ticket: `0.9 × mult × P`) | pay debt first | gets the remainder | −prize |
| `margin_adjustment` (at round close, no player) | ±delta computed in SQL by `close_round`, same rules as `computeRoundMarginAdjustment` | — | — | +delta |
| `carryover_kept` | +P × kept non-gift numbers | +amount | — | — |
| `carryover_released` | 0 (no refund) | — | — | — |
| `player_removed` | 0 | unchanged (the player keeps their balance on `game_session_players`) | unchanged | — |
| `payout` | −x | — | −x (must be ≤ positive_balance) | — |
| `adjustment` | ±x | as specified by the entry | as specified by the entry | as specified by the entry |

Notes carried over from the current reducer:
- Unchecking check-in does not restore the debt (it only clears `checked_in`); it writes a `check_in_undone` timeline row with no `amount`.
- `margin_adjustment` keeps today's rules: −P per unsold losing number, `+(prize − P)` per unsold winning number, −P per gifted losing number. Paid numbers and gifted winning numbers are already covered by check-in and `prize_won`.
- The 10% the house keeps on gifted winning tickets is the difference between the full prize and what the player gets, so `house_balance` moves by the player's share only.

## 4. Security

Helpers (`stable security definer set search_path = ''`) live in the **`private` schema**, which the Data API does not expose: policies can call them, but nobody can call them via `/rest/v1/rpc`. Policies wrap them in `select` so they run once per statement: `using ((select private.is_house_member(house_id)))`. Also in `private`: `is_admin_anywhere()` (used by the `admin_auth_sessions` policies) and `current_session_id()` (the JWT `session_id` claim). Implemented in `supabase/migrations/20260924003234_init.sql`:

```sql
create function private.is_house_member(h bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.house_members m
    where m.house_id = h and m.user_id = (select auth.uid())
  );
$$;

create function private.is_house_admin(h bigint) returns boolean
language sql stable security definer set search_path = '' as $$
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
```

**Explicit grants (required):** new tables in `public` are no longer exposed to the Data API automatically. In the migration grant `select, insert, update` to `authenticated` **only on `players` and `round_templates`** (CRUD outside the live game session). Every other table gets `select` only: `houses`, `house_members`, `admin_auth_sessions`, `game_sessions`, `game_session_players`, `tickets`, `ticket_numbers`, `game_session_rounds`, `round_winners`, `activity_log`. Game-session tables are written exclusively by the `security definer` functions below, so a balance can never change without its ledger row (not even from the admin's browser console). The one extra grant is `insert, update` on `admin_auth_sessions` for the invoker session functions, limited by its policies to the caller's own row. Grant nothing to `anon`. RLS still decides which rows each user can see.

RLS on every table:

- `select`: `is_house_member(house_id)`.
- `insert` / `update`: only on `players` and `round_templates`, `is_house_admin(house_id)` (both `using` and `with check`).
- `delete`: none. Players are soft-deleted with `active = false`; game session players are removed with `removed_at`.
- Game-session tables (`game_sessions`, `game_session_players`, `tickets`, `ticket_numbers`, `game_session_rounds`, `round_winners`, `activity_log`): select only. Rows are written exclusively by the functions below.
- `house_members`, `houses`: select only for members. Changes happen through seed SQL for now.

**Money functions** (`security definer`, `set search_path = ''`, `revoke execute ... from public, anon`, `grant execute ... to authenticated`). They must bypass RLS to write select-only tables, so Supabase lint **0029** (security definer callable by `authenticated`) will flag each one: that is intentional (the lint's own "Option 3"). Each function's first check is `private.is_house_admin(h)`, so a signed-in non-admin gets `not_admin`. Phase 4's advisor check expects exactly these 0029 findings and nothing else:

| function | reducer action today | notes |
|---|---|---|
| `start_game_session` | (new; "Iniciar jornada" in `main-page-split.tsx`, before entering `/new-game`) | numbers are assigned on `/new-game`, so the game session must exist first |
| `add_session_player` | `ADD_PLAYER` / selecting an existing player | creating a brand-new player inserts into `players` first and returns the DB id; the client stops predicting `max + 1` (`add-player-control.tsx`) |
| `add_ticket` | `ADD_TICKET` | creates the ticket and its 15 `ticket_numbers` rows |
| `record_purchase` | `ASSIGN_NUMBER` (claim) | conditional update, see below; raises `no_open_round` without an open round |
| `release_number` | `ASSIGN_NUMBER` (un-assign own number) | refunds P unless the number was a gift; today this writes no log |
| `reassign_number` | `SET_NUMBER_OWNER` | moves a number from one player to another (refund old owner unless gift, charge new owner) |
| `edit_player_numbers` | the "Editar jugada" dialog (`player-edit-numbers-dialog.tsx`) | today the dialog dispatches many `setNumberOwner` + `logActivity` + `toggleGift` calls; this becomes one function taking the list of changes, applied in one transaction |
| `toggle_gift` | `TOGGLE_GIFT` | |
| `record_recharge` | `RECHARGE_BALANCE` | takes a `payment_method` |
| `record_check_in` | `TOGGLE_CHECK_IN` (on) | **money**: pays the debt with a `payment_method` |
| `undo_check_in` | `TOGGLE_CHECK_IN` (off) | clears `checked_in`, writes `check_in_undone`; the debt is not restored |
| `start_round` | `SET_ROUND` (picking the round on `/new-game`) | inserts `game_session_rounds`, copying `line_price` from the template |
| `award_prize` | `AWARD_PRIZE` | computes prizes in SQL |
| `close_round` | `CLOSE_ROUND` | computes and writes `margin_adjustment` in SQL, starts the next round with its template's `line_price`, marks active players `pending_carryover`, clears check-ins |
| `resolve_carryover` | `RESOLVE_CARRYOVER` | |
| `remove_player` | `REMOVE_PLAYER` | frees the player's numbers **without refund**; sets `removed_at`; the balance stays on `game_session_players` |
| `end_game_session` | "Terminar jornada" | `status = 'ended'`, nothing is deleted |
| `discard_game_session` | "Salir y borrar" | see below |
| `record_payout` | (new; settlement) | allowed on ended game sessions |

`LOG_ACTIVITY` disappears as a free-form action: every log row is written by the function that made the change.

**`discard_game_session` (the only delete):** admin only. If the game session has **no `game_session_rounds`**, it deletes the game session and all its child rows (`on delete cascade`), **including its `activity_log` rows**. This is the only documented exception to the immutable ledger, and it is safe because balances are per game session. If the game session has rounds, it raises `game_session_has_rounds` and the UI does not offer "Salir y borrar" (it offers "Terminar jornada" instead). It runs as `security definer`, so no `delete` grant or RLS policy is added for anyone.

Every money function must:

1. Derive `house_id` from the row being touched (player, game session, round), never trust it from arguments. Check that all referenced rows belong to the same house.
2. `if not public.is_house_admin(h) then raise exception 'not_admin' using errcode = '42501'; end if;`
3. Validate inputs (amount > 0 where relevant, game session is `active`, round is `open`).
4. Insert the `activity_log` row with the client's `request_id` using `on conflict (request_id) do nothing`. If nothing was inserted, return without changing anything (this makes double-clicks and retries harmless).
5. Update `game_session_players` balances and the other tables.

Assigning a number must be conditional so two writes can't both win:
`update ticket_numbers set player_id = $1 where ticket_id = $2 and number = $3 and player_id is null`, raising `number_taken` if 0 rows changed.

`reassign_number` uses the same guard with the expected previous owner (`where ... and player_id = $expected_owner`), so a stale screen can't take a number that changed in the meantime.

Every reducer action that changes a balance goes through a function, **including check-in** (it clears the debt and adds it to `house_balance`) and gift toggles. Actions that don't move money (add ticket, start round, uncheck check-in) also go through a function (there is no direct write grant on those tables) so the change and its `activity_log` row are written together. `SET_ACTIVE_PLAYER` is UI-only and is not persisted.

## 5. How the live game session works

Keep `RoundDraftProvider` and the reducer. Change where state comes from and goes to.

1. **Load:** today `RoundDraftProvider` is mounted in the root `app/layout.tsx` (it even wraps `/login`). Move it into a layout shared by `/new-game` and `/active-round` (e.g. a route group `app/(app)/(game)/layout.tsx`). That layout is a Server Component: it loads the house's active game session with `lib/data/load-game-session.ts`, builds a `RoundDraftState` and passes it to the provider as `initialState`. This replaces `localRoundDraftRepository.load()`; delete `storage.ts`. `RoundDraftState` gains `gameSessionId`, and `DraftRoundConfig` gains `linePrice`; `NUMBER_PRICE` stops being a constant: the open round's `linePrice` is passed to `computePerEntryPrize` (already takes `price`), `computeRoundMarginAdjustment`, `chargePlayer` and `refundPlayer`, and `open-numbers-card.tsx` / `player-active-card.tsx` read it too. `DraftPlayer` balances now mean the player's balances **in this game session**.
   `hasDraftProgress` (compares against `getBasePlayers().length`) is replaced by "the active game session has rounds".
2. **Act (admin only):** `dispatch` stays optimistic for instant UI. A thin wrapper in `context.tsx` generates a `request_id` (`crypto.randomUUID()`) and calls the matching action in `lib/data/game-session-actions.ts`. On error: `sonner` toast with a Spanish message (`number_taken` → "Ese número ya fue asignado", `not_admin` → session-replaced redirect), then refetch and `HYDRATE`.
3. **Watch (everyone):** one Realtime subscription per active game session on `activity_log` filtered `game_session_id=eq.X`. On insert, refetch and dispatch `HYDRATE`. Debounce the refetch by ~250 ms, and skip it while the local admin has actions in flight (refetch once they settle) so optimistic state doesn't flicker.
4. **Observer UI:** `useRole()` hides the action buttons (assign, recharge, award, close round, end game session, edit player/round). Observers see a small "Solo lectura" badge. RLS is the real guard.
5. "Iniciar jornada" calls `start_game_session` (or reuses the active one) before navigating to `/new-game`; picking the round there calls `start_round`. "Empezar ronda" only navigates to `/active-round`. "Terminar jornada" calls `end_game_session` (`status = 'ended'`); nothing is deleted. "Salir y borrar" (`app/(app)/new-game/layout.tsx`) calls `discard_game_session` and is only shown while the game session has no rounds. Remove `createSeedActivity`.
6. **Check-in asks for the payment method** when the player has debt (prefilled from `players.payment_method`), because `record_check_in` records that money coming in.

Enable Realtime publication on `activity_log` and `admin_auth_sessions` only.

## 5b. Settlement at the end of the game session

Business rule: payments to players happen **outside the app** (cash or transfer). After paying, the admin records each payment manually, player by player, with the method used.

- **Screen:** a settlement view for the game session at `/games/[id]/settlement` (component `settlement-page.tsx`, UI title "Liquidación"), reachable from the end-game dialog (`end-game-dialog.tsx`) and from `/games/[id]`. It lists every player in the game session (including removed ones) with their `game_session_players` balances. Each row has a "Registrar pago" action that opens a small form: amount (prefilled with the full positive balance, editable for partial payments), payment method (prefilled from `players.payment_method`), and an optional note (e.g. transfer reference).
- **Function `record_payout(p_player_id, p_game_session_id, p_amount, p_payment_method, p_note, p_request_id)`:** same rules as every money function (admin + current session, derive `house_id`, idempotent `request_id`). It rejects `amount <= 0` and **rejects paying more than the player's positive balance**. It inserts an `activity_log` row of type `payout` with `payment_method` and `note`, and lowers the player's `game_session_players.positive_balance` in the same transaction.
- **Allowed on ended game sessions.** Unlike the other money functions, `record_payout` works when the game session status is `ended`, because settlement happens after the game is over. It still requires the game session to belong to the same house.
- **Payment methods:** `payment_method` is text with `check (payment_method in ('cash','transfer','paypal','credit_card','debit_card','other'))` on both `players` and `activity_log`. `record_recharge` and `record_check_in` also take a payment method, so money coming in is tracked the same way as money going out.
- **Status per player:** computed as `paid` when the positive balance reaches 0 after payouts, `pending` otherwise. (UI labels "Pagado" / "Pendiente"). Debt left at the end of a game session (negative balance) is shown as "Debe" in the same list; since balances are per game session, it is not carried into the next one. This is computed from balances, not stored.
- **Corrections:** a wrong payout is fixed with an `adjustment` entry, never by editing the payout.
- Observers see the settlement screen and every payout live, read-only.

## 6. Phases

### Phase 1: Foundation
- Migration `supabase/migrations/<ts>_init.sql`: houses, members, admin_auth_sessions, all tables, constraints, indexes, RLS, helper functions, session functions.
- Seed: one house, the admin membership, observer memberships, current `data.json` players (catalog only: no balances; payment methods mapped to the English values) and rounds (`'Especial'` → `'special'`, `line_price = 10`).
- Generate `lib/supabase/database.types.ts`; type both clients.
- Resolve `{ houseId, role }` in `(app)/layout.tsx`; add `useRole()`.

**Acceptance:** `list_tables` shows every table with RLS on. `get_advisors` (security) shows no warnings. Inserting a second admin for the same house fails.

- Nightly backup GitHub Action (see "Supabase Free plan constraints").

**Status (2026-09-24): done** on branch `feat/backend-phase-1`.
- Migrations: `20260924003234_init.sql`, `20260924003304_seed_initial_house.sql` (house "Casa Bingo ED" / `CASA-BINGO-ED`, admin `ferdevrondon@gmail.com`, 8 players, 2 round templates at `line_price = 10`; no observers yet).
- All 12 tables have RLS on. The security advisor reports no schema findings; its only warning is the project-level Auth setting "Leaked password protection", which is a dashboard toggle, not SQL.
- RLS verified as simulated users (JWT claims, rolled back): a non-member sees 0 rows; the admin reads but cannot write until `claim_admin_session()`; after claiming, `players` inserts work and direct `game_sessions` inserts are still rejected; the same admin from another session gets `other_active` and every write is rejected.
- Second admin: the partial unique index `house_members_one_admin` is in place (catalog-verified). A behavioral test needs a second Auth user, so it runs when the first observer exists (promote them to admin → must fail).
- The backup workflow only runs from the default branch (`schedule` and `workflow_dispatch`), so its first manual run happens after this branch is merged: **Actions → db-backup → Run workflow**.

### Phase 2: Single admin session
- Session functions wired into the login flow (password action returns state instead of redirecting; Google callback runs the same check), the dialog, the Realtime kick, the layout fallback, the heartbeat, and the `/login?reason=replaced` message.

**Acceptance:** Admin logged in on browser A. Logging in on browser B shows the dialog. "Seguir en el otro dispositivo" signs B out and leaves A working. "Mantener sesión aquí" makes A redirect to login with the message within a few seconds, and any write attempted from A's old token is rejected. An observer can log in on two browsers at once without any dialog.

### Phase 3: Players and rounds CRUD
- `lib/data/players.ts`, `lib/data/rounds.ts` server actions; `/players` and `/rounds` read from the DB.
- Replace `getBasePlayers()` / `getBaseRounds()` with DB data passed as props (used today by `lib/round-draft/{context,selectors}.ts`, `close-round-dialog.tsx`, `tickets-assignment-page.tsx`). Delete both `data.json` files.
- Rename the Spanish row keys and values listed under "Naming conventions" for these pages; the `/players` table no longer shows balances (they are per game session).
- `/rounds` shows and edits "Precio de linea"; unify the two `Round` types (`components/round-form.tsx` and `lib/rounds.ts`).
- `/settings` has no price field (the price lives on round templates).
- Observer: no edit/add/delete controls.

**Acceptance:** Rounds created on `/rounds` appear in the round picker with their line price. As observer, a forced write via the browser console (`supabase.from('players').insert(...)`) is rejected.

### Phase 4: Live game session persisted
- Move `RoundDraftProvider` out of the root layout (section 5).
- Update `CLAUDE.md` in this phase (when `storage.ts` is deleted): the "UI-only prototype" and `storage.ts`-as-backend-seam sections stop being true here.
- Loader, game session actions and every function in the section 4 table wired to its reducer action: `ADD_PLAYER`, `ADD_TICKET`, `ASSIGN_NUMBER` (claim and release), `SET_NUMBER_OWNER`, the "Editar jugada" dialog, `TOGGLE_GIFT`, `TOGGLE_CHECK_IN`, `RECHARGE_BALANCE`, `SET_ROUND`, `AWARD_PRIZE`, `CLOSE_ROUND`, `RESOLVE_CARRYOVER`, `REMOVE_PLAYER`, end and discard game session. Remove `LOG_ACTIVITY`.
- Timeline texts are built in the UI from structured `activity_log` rows (`activity-log-card.tsx`).

**Acceptance:** Run a full game session as admin (assign numbers, recharge, award, close 2 rounds, end). Include one player who owns the same number on 4 tickets (one of them a gift): when that number wins, `round_winners` has 4 rows with 4 different `ticket_id`s, the timeline shows each labeled as "Cartón N · #X", and the gifted ticket pays 90%. Reload mid-session and nothing is lost. Double-clicking "Recargar" records one recharge. With `execute_sql`, each `game_session_players` balance and `game_sessions.house_balance` match the ledger according to the documented mapping. Editing a round template's line price mid-round does not change the open round's prices. Assigning a number with no open round is rejected (`no_open_round`). "Salir y borrar" deletes a game session with no rounds and is rejected (`game_session_has_rounds`) once a round exists. As observer, `supabase.rpc('record_recharge', ...)` is rejected.

- `record_payout` + the settlement screen (section 5b).

**Settlement acceptance:** after ending the test game session, record a partial payout by `transfer` and a full payout in `cash`. Balances drop accordingly, the timeline shows both with their method, paying more than the balance is rejected, and double-clicking "Registrar pago" records one payment.

### Phase 5: Realtime and observer view
- `activity_log` subscription + debounced `HYDRATE`; `useRole()` gating in every action component; "Solo lectura" badge.

**Acceptance:** Admin in one browser, observer in another: the observer sees each assignment and award appear within ~1 second and has no action buttons. A user from a second test house sees nothing from the first house.

### Phase 6: Reports and members
- `/games`: list of game sessions (replaces the hardcoded `games` array in `game-page.tsx`); `/games/[id]` reads the real game session. `/reports?game=id`: rounds, winners, timeline, per-player totals, from SQL. The report includes a **cash summary**: total recharges and total payouts per payment method, and the players still pending payment. "Daily" grouping uses `houses.timezone`, with a game session counted on its start date.
- `RoundHistoryCard` and `player-rounds-dialog` use real rounds; the "Jornada #42" heading (`page-heading.tsx`) and `NEXT_GAME_NUMBER` (`main-page*.tsx`) use real numbers.
- Optional: a members page where the admin invites observers by email through a server action using the service-role key (server-only, never exposed to the client).

**Acceptance:** A report for an ended game session matches what happened in the Phase 4 test run.

## Later (not now)
House switcher, editing the house name/identifier from `/settings` (needs an admin-only function, since `houses` is select-only), transferring the admin role to another member, dashboard metrics, offline queue.

## Files
New: `supabase/migrations/*_init.sql`, `lib/supabase/database.types.ts`, `lib/data/{house,admin-session,players,rounds,load-game-session,game-session-actions}.ts`, `app/(app)/(game)/layout.tsx` (provider), `app/(app)/games/[id]/settlement/page.tsx`, `components/settlement-page.tsx`.

Modified: `app/layout.tsx` (remove provider), `lib/round-draft/{context.tsx,types.ts,players.ts,prize-rules.ts,selectors.ts}`, `lib/rounds.ts`, `lib/supabase/{server,client,actions}.ts`, `app/auth/callback/route.ts`, the login page, `app/(app)/{layout,players,rounds,new-game,active-round,games,reports}/…`, `components/{main-page-split,open-numbers-card,player-page,player-form,rounds-page,round-form,game-page,game-detail-page,tabs-solid,add-player-control,player-edit-numbers-dialog,player-active-card,activity-log-card,tickets-assignment-page,page-heading}.tsx`, close-round/end-game dialogs, `round-history-card.tsx`, `CLAUDE.md` (remove "UI-only prototype", describe this architecture), `SUPABASE_AUTH.md` (tenancy + single admin session).

Delete: `lib/round-draft/storage.ts`, `players/data.json`, `rounds/data.json`.
