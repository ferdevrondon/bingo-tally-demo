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
- Supabase project `xrporompvbfjfmkfxkwa`: schema, RLS and seed created in Phase 1 (`supabase/migrations/`).

## Business rules (non-negotiable)

1. **The game session record must never be lost.** Every number assignment, balance change, timeline entry, round and winner is written to Postgres as it happens. The database is the source of truth from the first action; localStorage is no longer a store.
2. **Multi-house.** Today there is 1 house, later 3 to 50+. A user logs in and works inside their house. A user from another house sees nothing.
3. **Exactly one admin per house.** The admin is the only person who can operate: assign numbers, recharge balances, award prizes, close rounds, end the game session, and edit players and rounds.
4. **Everyone else is an observer.** Observers see everything in their house live, including a game session in progress, but cannot change anything. The database enforces this, not just the UI.
5. **The admin account can only be active in one session at a time.** If the admin logs in on a second device while the first is in use, the login screen warns them. If they continue, the old session is closed and can no longer write.
6. Reports and live information are reviewed daily.
7. ~~**Balances are per game session.** Every game session starts each player at 0. Positive/negative balances live on `game_session_players`, not on `players`, and are settled at the end of the game session (section 5b).~~ **Superseded by v2 rules B and D** (below): one signed balance per player that carries over from one game session to the next. Phases 1–4b implement the old rule; 4c and 4d replace it.
8. **The line price ("Precio de linea") is configured per round template** (`round_templates.line_price`) and copied onto the round when it starts (`game_session_rounds.line_price`), so editing a template never alters a round in progress. Every charge, refund and prize uses the price of the **open round**.
9. **No number without an open round.** A number can only be assigned while the game session has an open round; `/new-game` requires picking the round first.
10. ~~**Purchases always create debt.** Buying a number adds the price to `negative_balance`; it never consumes `positive_balance`. Debt is paid at check-in (or by a recharge).~~ **Superseded by v2 rules A and B**: a purchase lowers the player's signed balance, and check-in moves no money.

### Business rules v2 (decided with the product owner on 2026-09-28)

These replace the money rules above. They are implemented in **Phase 4c** (A, B, C, E, F; done) and **Phase 4d** (D, G; balances still start at 0 per game session until then). The "Pending design" list at the end of this section is settled in the plan of the phase that needs it, not before.

- **A. Check-in means "this player is in this round".** It is per round (cleared when the round closes), moves no money and never blocks anyone: a player can play with a positive or a negative balance. Money moves only through recharges (payments in), purchases and prizes (on the balance) and payouts (payments out).
- **B. One signed balance per player.** Buying a number subtracts the line price, releasing a paid number adds it back, recharges and prizes add. The `positive_balance` / `negative_balance` pair and "pay debt first" go away. A negative balance is what the player owes; a positive one is what the house owes them.
- **C. Gifted numbers.** A gift is only for the round in which it was given: if the player keeps their play after the round closes, the gifted number becomes a normal number and is charged like the others. A gifted number that wins pays the prize **minus the line price** for each gifted ticket. Example: Ana plays #5 on 5 tickets, 3 of them gifted, so she pays 2 × $10 = $20; if #5 wins she receives 5 × prize − 3 × $10. The 90 % / 10 % split goes away.
- **D. The balance carries over between game sessions, with traceability.** A game session no longer starts every player at 0: each player enters with the balance they had (positive or negative), and that opening balance is recorded for each game session, as is the closing balance. Reports can show, per game session, what each player started with, what moved and what they ended with.
- **E. Configurable rounds.** A round template has a line price, a number of prizes (winning numbers) and the value of each prize, all set by the admin on `/rounds`. The prize is no longer derived from a multiplier of the line price. The round copies its prizes when it starts, like `line_price` today (rule 8).
- **F. Round summary.** When a round closes, the admin sees who won, with which number and on which ticket ("Cartón N · #X"), and how much.
- **G. Before starting a game session**, the admin is warned about players with a positive balance still unpaid (and players who owe). A player status (owes / has credit / settled) is **derived from the balance**, never stored; a manual status for cases like "not reachable" may come later.

Pending design (settled in the 4c or 4d plan):
- ~~House balance with one signed balance (4c).~~ **Decided 2026-09-28:** `house_balance` is the **house result**: sales − prizes paid + the round margin. The house still "plays" what it didn't sell: −P per unsold number that loses, prize − P per unsold number that wins (the prize stays with the house, minus that number's line price), −P per gifted number that loses. Recharges and payouts are cash: they move the player's balance, not the house result. Summaries show each part: sales, prizes paid, gifts that lost, unsold that lost, unsold that won, total. Worked examples agreed with the product owner (1 ticket, P = $10, prize $100, 10 sold, 2 gifted, 3 unsold): a sold number wins → −$50; an unsold number wins → +$150.
- ~~Round kind (4c).~~ **Decided:** `regular` / `special` goes away; a round is its name, line price and list of prizes.
- Check-in lock (4c): winning numbers still wait until every player with numbers is checked in (`award_prize` raises `check_in_pending`); a negative balance never blocks.
- ~~Recharges and payouts outside a game session (4d).~~ **Decided 2026-09-28:** at any time, in or out of a game session. Payouts have **no limit**: paying more than a positive balance leaves it negative. A settlement screen opens after "Terminar jornada", player by player, and can be reopened later.
- ~~Manual player statuses (4d).~~ **Decided:** the balance gives Debe / A favor / Al día. A positive balance also carries a status set at each settlement: **"Para jugar"** (left in the house to keep playing) or **"Pendiente de pago"** (should be paid but couldn't be, e.g. the player couldn't be reached; with a note). Those pending ones are what "Iniciar jornada" warns about, together with debts and positive balances not yet marked.
- ~~Removed player's balance (4d).~~ **Decided:** it moves to their account like everyone else's.

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
| (from 6a2) Efectivo / Zelle / Venmo / Majority / PayPal / Square / Otro | `cash` / `zelle` / `venmo` / `majority` / `paypal` / `square` / `other` (transfer and cards retired) |
| Entidad bancaria (ingreso) | `bank` (`chase`, `bank_of_america`, `td_bank`, `wells_fargo`, `chime`, `capital_one`, `first_one_bank`, `ufcu_bank`, `regional_bank`, `southwest_bank`, `southstate_bank`, `frost_bank`, `mid_bank`, `pnc_business`, `pnc_personal`, `other`) |
| Nickname (was "Usuario") | `nickname` (`players.nickname`, was `username`); the player's name and nickname are stored in uppercase |
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

Login flow (implemented in Phase 2; shared logic in `lib/data/admin-session.ts`):

Permissions principle: **the database decides** (RLS + `is_house_admin()`); the UI only hides controls and translates errors. Hiding edit controls from observers is done per phase, in the phase that connects each screen to the database (players/rounds in Phase 3, the live game in Phase 4, the "Solo lectura" badge and a full pass in Phase 5).

`proxy.ts` bounces signed-in users away from `/login` and `/auth/*`, and the "other device" choice happens *after* signing in, so it lives on its own page, **`/session-conflict`** (`app/(auth)/session-conflict/page.tsx`), used by both sign-in paths.

1. Password (`signInWithPassword` in `lib/supabase/actions.ts`) or Google (`app/auth/callback/route.ts`, after `exchangeCodeForSession`) succeeds.
2. `resolveAdminSessionAfterLogin()` calls `admin_session_status()`:
   - `not_admin` → go to the app (observers may have several sessions).
   - `none`, `mine` or `other_stale` → `claim_admin_session()` + `supabase.auth.signOut({ scope: 'others' })` → go to the app.
   - `other_active` → `/session-conflict`: **"Esta cuenta ya está abierta en otro dispositivo. ¿Quieres mantener la sesión aquí o cerrarla y seguir en el otro dispositivo?"**
     - **"Mantener sesión aquí"** (`keepSessionHere`): claim + `signOut({ scope: 'others' })` → `/`. The other device is kicked out (see below).
     - **"Seguir en el otro dispositivo"** (`continueOnOtherDevice`): `signOut({ scope: 'local' })` → `/login`. The other device keeps working untouched.
   - If the other device went quiet before the choice is made, `/session-conflict` resolves again and redirects without asking.

Kicking the old session (`components/admin-session-guard.tsx`, mounted by `(app)/layout.tsx` for the admin only):

- Realtime subscription to `admin_auth_sessions` filtered `user_id=eq.<me>` (table added to the `supabase_realtime` publication in `20260924010837_realtime_admin_auth_sessions.sql`). When `session_id` changes to another value: `signOut({ scope: 'local' })` → `/login?reason=replaced`, which shows **"Tu sesión se cerró porque se inició sesión en otro dispositivo."**
- Heartbeat: `admin_heartbeat()` on mount and every 60 seconds, then `admin_session_status()`; `other_active`/`other_stale` means this session was replaced and the Realtime event was missed → same sign-out.
- Layout fallback (`ensureAdminSession()` in `(app)/layout.tsx`, every request): `none`/`other_stale` → claim silently (covers sessions opened before Phase 2); `other_active` → `/session-conflict`. It doesn't sign out other sessions (a layout can't write cookies; the claim alone already blocks their writes).
- Writes that fail with `not_admin` (from Phase 3 on): `rejectWrite()` (`lib/data/reject-write.ts`) uses `isNotAdminError()` (or an update that matched 0 rows) plus `admin_session_status()`; if the session is no longer `mine` it signs out locally and redirects to `/login?reason=replaced`.
- `/login` also shows `?error=auth_callback_error|oauth_error` messages.

Read the current `session_id` from the access token claims with `supabase.auth.getClaims()` (available in the installed `@supabase/supabase-js` 2.116).

## 3. Schema

Ids are `bigint generated always as identity` (keeps the existing `number` ids in `DraftPlayer`/`Round` working). Money is `numeric(12,2)`. **Every table has `house_id`** (denormalized on child tables so RLS policies never need joins). All timestamps are `timestamptz default now()`.

| table | purpose | key columns |
|---|---|---|
| `players` | house player catalog (no balances) | house_id, name, nickname (was username), payment_method, bank, is_vip bool, active bool |
| `round_templates` | rounds configured on `/rounds` | house_id, name, kind ('regular','special'), winner_count, line_price numeric(12,2) not null check (line_price > 0), prizes numeric[] (informational only: the paid prize is always derived from `kind` and `line_price`; **from 4c** the real paid value per slot, rule E) |
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
- When number 2 wins a round, **`award_prize`** (not `close_round`; prizes are paid the moment a winning number is entered, as `AWARD_PRIZE` does today) writes **one `round_winners` row per ticket where number 2 is owned**, each with its `ticket_id`, and **one `prize_won` ledger row per ticket**. Each ticket pays the full per-ticket prize: nothing is split between tickets or between players. A gifted ticket pays 90% and the house keeps 10% (**from 4c:** prize − P, rule C). Today the reducer writes a single aggregated log line per player ("N líneas"); that becomes one row per ticket.
- `award_prize` computes the prize in SQL from the round `kind`, the slot and the round's `line_price` (multiplier 10 for a regular round; 10 and 5 for the two slots of a special round), mirroring `prize-rules.ts`. From 4c it pays the round's copied `prizes[slot]` instead (rule E). It never trusts an amount sent by the client.
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

**Ledger mapping v2 (Phase 4c, business rules v2).** The table above describes Phases 4a–4b. From 4c (`20260928215255_game_rules_v2.sql`, which carries this mapping and the reconciliation formulas as a SQL comment), `game_session_players` has one signed `balance` instead of `positive_balance` / `negative_balance`, and `house_balance` is the house result. `P` = the open round's `line_price`; `prize[s]` = the round's copied prize for slot `s`.

| type | `amount` (sign) | balance | house_balance |
|---|---|---|---|
| `number_purchased` | +P (charged) | −P | +P |
| `number_released` (paid / gifted number) | −P (refund) / 0 | +P / — | −P / — |
| `number_gifted` / `number_ungifted` | −P / +P | +P / −P | −P / +P |
| `number_reassigned` | refund the previous owner (unless gift), charge the new owner | as released / purchased | as released / purchased |
| `carryover_kept` | +P × every kept number, gifts included (they stop being gifts, rule C) | −amount | +amount |
| `carryover_released` | 0 | — | — |
| `prize_won` (one row per ticket) | paid ticket: +prize[s]; gifted ticket: +max(prize[s] − P, 0) | +amount | −amount |
| `adjustment` (unplayed round refund) | +x | +x | −x |
| `margin_adjustment` (round close, no player) | ± gifts + unsold losing + unsold winning | — | +amount |
| `recharge` | +x (with `payment_method`) | +x | — (cash) |
| `payout` | −x (with `payment_method`) | −x (≤ a positive balance; redesigned in 4d) | — (cash) |
| `check_in` / `check_in_undone` | none | — (rule A) | — |
| `player_removed` | 0 | unchanged | — |

Each closed round also keeps its margin split (`margin_gifts`, `margin_unsold_losing`, `margin_unsold_winning`) for the summaries.

Phase 4d adds `game_session_players.opening_balance` (the player's balance when they join the game session, positive or negative) and the player's running balance between game sessions, kept in its own table written only by functions (never in `players`, which the admin edits directly). Reconciliation then becomes: `opening_balance + sum(ledger rows of the game session) = closing balance`, per player and per game session.

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
2. **Act (admin only):** `dispatch` stays optimistic for instant UI. A thin wrapper in `context.tsx` generates a `request_id` (`crypto.randomUUID()`) and calls the matching SQL function **straight from the browser** with `supabase.rpc()` (`lib/round-draft/game-api.ts`; decided in 4b because a Server Action per tap, which Next runs one at a time and follows with a router refresh, added about a second to every interaction). Calls go through an ordered client-side queue. When the queue is idle, the game session is read again in the background (`lib/round-draft/fetch-state.ts`, shared with the server loader, ~300 ms debounce) and replaces the local state unless a new action started meanwhile. Structural actions (add ticket, pick round, close round) wait for that read. On error: `sonner` toast with a Spanish message (`number_taken` → "Ese número ya fue asignado", `not_admin` → session-replaced redirect), then the re-sync reverts the optimistic change. Only "Iniciar jornada" (home page) stays a Server Action, because it redirects.
3. **Watch (everyone):** one Realtime subscription per active game session on `activity_log` filtered `game_session_id=eq.X`. On insert, refetch and dispatch `HYDRATE`. Debounce the refetch by ~250 ms, and skip it while the local admin has actions in flight (refetch once they settle) so optimistic state doesn't flicker. **As built in Phase 5:** the channel is filtered by `house_id` instead (so a starting game session, account moves and settlements arrive too), with a 100 ms debounce.
4. **Observer UI:** `useRole()` hides the action buttons (assign, recharge, award, close round, end game session, edit player/round). Observers see a small "Solo lectura" badge. RLS is the real guard.
5. "Iniciar jornada" calls `start_game_session` (or reuses the active one) before navigating to `/new-game`; picking the round there calls `start_round`. "Empezar ronda" only navigates to `/active-round`. "Terminar jornada" calls `end_game_session` (`status = 'ended'`); nothing is deleted. "Salir y borrar" (`app/(app)/new-game/layout.tsx`) calls `discard_game_session` and is only shown while the game session has no rounds. Remove `createSeedActivity`.
6. **Check-in** with debt shows a confirmation only ("la deuda se toma como pagada y su saldo queda en…"). It does not ask for the payment method: `record_check_in` records the player's default one (`players.payment_method`, `other` when unset). Decided with the product owner in 4b; the recharge dialog does ask for the method. After a round closes, a player's check-in only appears once they keep or release their numbers (the new round's charge is known then).
   **From Phase 4c (rule A):** check-in only confirms the player is in the current round. It moves no money, asks for no payment method and never blocks a player with a negative balance; `record_check_in` stops paying debt and the confirmation text changes accordingly. The "keep or release first" order stays.

Enable Realtime publication on `activity_log` and `admin_auth_sessions` only.

## 5b. Settlement at the end of the game session

> **Superseded by business rules v2 (rule D), implemented in Phase 4d.** Money in (`record_account_recharge`) and out (`record_account_payout`, no limit) goes against the player's balance at any time: to the active game session when the player is in it, otherwise to their account (`public.player_accounts`). `record_payout` from 4a was dropped.
>
> **Settlement as built in 4d2 (designed with the product owner on 2026-09-28).** Every ended game session opens a settlement (`public.settlements` + `settlement_players`, one row per player with the balance they ended with). `/games/[id]/settlement` works it as a task list grouped **Por cobrar → Por pagar → Completados**; a player moves to "Completados" once resolved: a collection leaves them at ≥ 0 (`paid_in`), a payout at ≤ 0 (`paid_out`), or the balance is marked "Para jugar" (`play`), "Pendiente de pago" (`pending_payout`, note required, e.g. couldn't be reached) or "Queda debiendo" (`owes`, optional note such as "paga el viernes"); ending at $0 is `settled`. Collection and payout forms open with the full balance, editable for partial payments. "Cerrar liquidación" is always available (it confirms and says how many are unresolved) and keeps each player's balance at that moment (`final_balance`); a closed settlement is read-only, reachable from "Liquidación" in the sidebar (`/settlement`). The account status (`player_accounts.balance_status` / `balance_note`, `play` | `pending_payout` | `owes`) feeds `/players` and the warning on "Iniciar jornada". The text below is the original design, kept for reference.

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
- Session functions wired into the login flow (password and Google both resolve the session; the choice lives on `/session-conflict`), the Realtime kick, the layout fallback, the heartbeat, and the `/login?reason=replaced` message.

**Acceptance:** Admin logged in on browser A. Logging in on browser B shows the dialog. "Seguir en el otro dispositivo" signs B out and leaves A working. "Mantener sesión aquí" makes A redirect to login with the message within a few seconds, and any write attempted from A's old token is rejected. An observer can log in on two browsers at once without any dialog.

**Status (2026-09-24): done** on branch `feat/backend-phase-2` (stacked on `feat/backend-phase-1`).
- Verified with the real admin account: a page load claims the session silently and the heartbeat advances `last_seen_at` every 60 s; a second device (the preview browser, already signed in) was sent to `/session-conflict`; "Seguir en el otro dispositivo" signed only that device out (open Auth sessions 2 → 1) and left the claimed session untouched; `/login?reason=replaced` and `?error=oauth_error` show their messages. Security advisor: no new findings.
- Two-device test with the user (2026-09-24): device B (preview browser) signed in with Google, got `/session-conflict`, chose "Mantener sesión aquí"; device A was signed out live. DB: `admin_auth_sessions.session_id` moved to B's session, the account went from 2 open Auth sessions to 1 (A's refresh token revoked), and B's heartbeat is running. The DB side (a replaced session's writes are rejected) was verified in Phase 1. Observer case pending until an observer exists.

### Phase 3: Players and rounds CRUD
- `lib/data/players.ts`, `lib/data/rounds.ts` server actions; `/players` and `/rounds` read from the DB.
- Replace `getBasePlayers()` / `getBaseRounds()` with DB data passed as props (used today by `lib/round-draft/{context,selectors}.ts`, `close-round-dialog.tsx`, `tickets-assignment-page.tsx`). Delete both `data.json` files.
- Rename the Spanish row keys and values listed under "Naming conventions" for these pages; the `/players` table no longer shows balances (they are per game session).
- `/rounds` shows and edits "Precio de linea"; unify the two `Round` types (`components/round-form.tsx` and `lib/rounds.ts`).
- `/settings` has no price field (the price lives on round templates).
- Observer: no edit/add/delete controls (`useRole()` from `components/house-provider.tsx`).
- Every write action checks `isNotAdminError()` (`lib/data/admin-session.ts`) and sends a replaced admin session to `/login?reason=replaced`.

**Acceptance:** Rounds created on `/rounds` appear in the round picker with their line price. As observer, a forced write via the browser console (`supabase.from('players').insert(...)`) is rejected.

**Status (2026-09-24): done** on branch `feat/backend-phase-3`.
- Reads: `lib/data/players.ts` (`listPlayers`), `lib/data/rounds.ts` (`listRoundTemplates`), active rows of the current house. Writes: Server Actions in `lib/data/player-actions.ts` / `round-actions.ts` (create, update, soft delete with `active = false`), zod schemas shared with the forms (`lib/players.ts`, `lib/rounds.ts`), `house_id` from the server, `rejectWrite()` for RLS rejections. No schema migration was needed.
- Renames done: round kind `"especial"` → `"special"` (a saved draft with the old value is migrated on load), English row keys on both tables, payment method values (`lib/payment-methods.ts`, Spanish labels). `/players` has no balances and `PlayerForm` has no balance fields. One `Round` type (`lib/rounds.ts`, with `linePrice`); `DraftRoundConfig` is an alias of it. Both `data.json` files, `getBasePlayers()` and `getBaseRounds()` are gone. `/settings` never had a price field.
- Two Phase 4 items done early (approved): `RoundDraftProvider` moved to `app/(app)/(game)/layout.tsx`, and "Agregar jugador/nuevo" during a game saves the player to the catalog and uses its database id. The reducer still charges `NUMBER_PRICE`; the pickers already show each template's price ("Regular · $10"), and Phase 4 switches the amounts to the open round's `line_price`.
- First observer: `rondon.fernanda11@gmail.com` (email + password, created in the dashboard), membership in `20260924212622_seed_first_observer.sql`.
- Verified in the browser with the real accounts: as admin, create/edit/inline payment method/delete on `/players` and `/rounds`, all persisted; a round "Prueba F3" at $15 appeared in the `/new-game` picker as "Prueba F3 · $15" and was then deleted; a player created from `/new-game` got its database id and became the active player. As observer: `/players` and `/rounds` show no add button, row actions or inline select; a forced `POST /rest/v1/players` with the observer's token returned 403 / `42501`, and `PATCH` on `players` and `round_templates` changed 0 rows. Test rows were deactivated afterwards (players 14–19, template "Prueba F3").
- SQL as a simulated observer (rolled back): reads 8 players and 2 templates, inserts rejected with `42501`, updates change 0 rows. Second admin (pending from Phase 1): promoting the observer to admin fails on `house_members_one_admin`.
- Replaced admin session: `rejectWrite()` checks `admin_session_status()` after a rejected write and signs out to `/login?reason=replaced`; the database side (a non-claimed session's writes are rejected with `42501`) was verified in Phase 1. Not exercised end to end in the browser, because the Phase 2 guard signs a replaced tab out first.
- Security advisor: no new findings (only the project-level "Leaked password protection" setting, now relevant since the observer uses a password).

### Phase 4: Live game session persisted
- Move `RoundDraftProvider` out of the root layout (section 5). **Done early in Phase 3:** it lives in `app/(app)/(game)/layout.tsx`, which already loads the catalog; Phase 4 adds the active game session to that loader.
- `add_session_player`: the catalog half is **done in Phase 3** (a brand-new player is saved with `createPlayer` and the draft uses its database id); Phase 4 adds the `game_session_players` row.
- Update `CLAUDE.md` in this phase (when `storage.ts` is deleted): the "UI-only prototype" and `storage.ts`-as-backend-seam sections stop being true here.
- Loader, game session actions and every function in the section 4 table wired to its reducer action: `ADD_PLAYER`, `ADD_TICKET`, `ASSIGN_NUMBER` (claim and release), `SET_NUMBER_OWNER`, the "Editar jugada" dialog, `TOGGLE_GIFT`, `TOGGLE_CHECK_IN`, `RECHARGE_BALANCE`, `SET_ROUND`, `AWARD_PRIZE`, `CLOSE_ROUND`, `RESOLVE_CARRYOVER`, `REMOVE_PLAYER`, end and discard game session. Remove `LOG_ACTIVITY`.
- Timeline texts are built in the UI from structured `activity_log` rows (`activity-log-card.tsx`).

**Acceptance:** Run a full game session as admin (assign numbers, recharge, award, close 2 rounds, end). Include one player who owns the same number on 4 tickets (one of them a gift): when that number wins, `round_winners` has 4 rows with 4 different `ticket_id`s, the timeline shows each labeled as "Cartón N · #X", and the gifted ticket pays 90%. Reload mid-session and nothing is lost. Double-clicking "Recargar" records one recharge. With `execute_sql`, each `game_session_players` balance and `game_sessions.house_balance` match the ledger according to the documented mapping. Editing a round template's line price mid-round does not change the open round's prices. Assigning a number with no open round is rejected (`no_open_round`). "Salir y borrar" deletes a game session with no rounds and is rejected (`game_session_has_rounds`) once a round exists. As observer, `supabase.rpc('record_recharge', ...)` is rejected.

- ~~`record_payout` + the settlement screen (section 5b).~~ Moved to Phase 4d (business rules v2).

~~**Settlement acceptance:** after ending the test game session, record a partial payout by `transfer` and a full payout in `cash`. Balances drop accordingly, the timeline shows both with their method, paying more than the balance is rejected, and double-clicking "Registrar pago" records one payment.~~ Replaced by the 4d acceptance.

Phase 4 is delivered in four branches, each with its own plan and acceptance: **4a** the database functions (no UI change), **4b** the loader and wiring the draft to them, **4c** game rules v2, **4d** the player account between game sessions (which absorbs the settlement). The original plan had a 4c for the settlement screen; business rules v2 (2026-09-28) replaced it.

Decisions taken with the product owner (2026-09-24), implemented in 4a:
- **Free round choice.** The admin picks any active round template to start the game session and to continue after each close, the same template included. The odd = regular / even = special suggestion no longer restricts the pickers (the UI filter goes away in 4b). `start_round` / `close_round` accept any active template of the house.
- **Changing the picked round.** While the open round has no activity besides its start (nothing sold, kept or awarded in it), `start_round` with another template replaces it; after that it raises `round_in_progress`.
- **"Terminar jornada" with an open round.** Every winning number entered: the round is closed with its margin. No winning number yet (the round was never played): it is closed without margin and each player's net charge in it (numbers bought or kept for it) is credited back with an `adjustment` row (`note = 'unplayed_round_refund'`). Partly awarded: `round_in_progress`.
- **Releasing a gifted number refunds nothing** (it was never charged). The current reducer refunds P; 4b aligns it.

**Phase 4a status (2026-09-24): done** on branch `feat/backend-phase-4a`.
- Migration `20260925005758_game_session_functions.sql`: the 19 public functions of the section 4 table plus `undo_check_in` (security definer, `search_path = ''`, execute for `authenticated` only), private helpers (not executable by API roles), the ledger mapping as a SQL comment (with the reconciliation formulas), and `activity_log` added to the `supabase_realtime` publication. `lib/supabase/database.types.ts` regenerated.
- Idempotency: each call records its `request_id` in `private.processed_requests` (not exposed by the API) in the same transaction, so a repeated id returns without changes, even for calls that write several rows. `activity_log.request_id` stays unique per row: row 0 carries the client's id, the other rows of the same call carry ids derived from it (`private.request_id_for`).
- Every function locks the game session row (actions on one game session are serialized), checks `private.is_house_admin` first (`not_admin`, 42501) and raises the error code as the message (`no_open_round`, `number_taken`, `number_owner_changed`, `round_in_progress`, `payment_method_required`, `payout_exceeds_balance`, `game_session_has_rounds`, …) for the UI to translate.
- Verified with `execute_sql` as the real admin session and the observer (one transaction, rolled back): a full game session with 3 rounds (switching the picked template before any sale, same number on 4 tickets with one gift → 4 `round_winners` rows on 4 tickets paying 100/100/100/90, special round slots paying 10 × P and 5 × P, carryover keep/release, remove player, release, stale and valid reassign, "Editar jugada" with buy + gift + release, check-in/undo, the next round with the same template, ending with an unplayed round refunded, partial and full payouts). Per-player balances and `house_balance` match the ledger (0 mismatches; house −1060 = 120 in − 540 prizes − 540 − 100 margins, checked by hand). Rejections: `no_open_round`, `number_taken`, `number_owner_changed`, `round_in_progress` (switch after a sale, close/end partly awarded), `payment_method_required`, `game_session_has_rounds`, `payout_exceeds_balance`; repeated request ids wrote one row (purchase, recharge, payout, add_ticket); editing a template's price mid-round left the open round at its price; a game session with no rounds was discarded; the observer and a non-claimed admin session got `not_admin` on every call tried.
- Security advisor: exactly the 19 expected 0029 findings (one per public function) plus the project-level leaked-password setting; nothing else.

**Phase 4b status (2026-09-28): done** on branch `feat/backend-phase-4b`.
- `app/(app)/(game)/layout.tsx` loads the active game session (`lib/data/load-game-session.ts` → `fetchGameSessionState`) and hands it to `RoundDraftProvider`; without one, it shows "No hay una jornada activa" with "Iniciar jornada". `storage.ts`, `LOG_ACTIVITY`, the seed activity, `NUMBER_PRICE`, `hasDraftProgress` and the odd/even round filter are gone; ticket ids are numbers; `ActivityEntry` is structured and `lib/round-draft/activity-text.ts` builds the Spanish timeline ("Cartón N · #X").
- Writes: see §5.2 (direct `supabase.rpc`, ordered queue, background re-sync). The reducer uses the open round's `line_price` and no longer refunds a released gifted number (same as SQL).
- Home "Iniciar jornada" creates or reuses the active game session with ticket #1. "Salir y borrar" only while the game session has no rounds. "Terminar jornada" confirms, calls `end_game_session` and shows the saved summary. The real game session number on the home page and heading stays for Phase 6.
- First real game session played by the product owner (#1, 2 rounds, 71 ledger rows): number 2 on 4 tickets (one gifted) paid 100/100/100/90 on 4 `round_winners` rows; every player balance and `house_balance` (−360) match the ledger.
- Adjustments after that first run: writes moved from Server Actions to direct `supabase.rpc` (§5.2) to remove a ~1 s delay per tap; check-in with debt is a confirmation only, with the player's default payment method (§5.6); after a round closes, check-in appears only once the player keeps or releases their play; one request id per recharge dialog opening (a double click records one recharge); the round picker locks once something happens in the round; the background re-sync retries on failure.
- **Reduced acceptance (decided 2026-09-28).** Business rules v2 change the money rules in 4c, so 4b is only accepted on what survives them: interactions feel instant and the queue keeps their order; reloading mid-session loses nothing; double-clicking "Recargar" records one recharge; "Iniciar jornada", "Terminar jornada" (with its summary) and "Salir y borrar" work. The check-in money flow and the SQL reconciliation of game session #2 are not tested here: 4c rewrites them.
- Reduced acceptance passed in the browser with the admin account (2026-09-28), on game session #2: five quick taps showed on screen within 37 ms and were stored in order (~150 ms per call in the background); buy/release sequences tapped 80–120 ms apart ended with the right owners on screen and in the database; a reload mid-session kept numbers, balance (−$30) and timeline; double-clicking "Confirmar recarga" wrote one `recharge` row; "Terminar jornada" closed the unplayed round, refunded its $80 (`unplayed_round_refund`) and showed the summary; a new game session was removed with "Salir y borrar". Known limit: two opposite taps on the same number fired within the same frame (only possible from a script) are sent as two purchases, and the second is rejected with `number_taken`, with no data harm.
- Fixed during acceptance: the timeline's relative time ("hace 2 minutos") caused a hydration mismatch now that entries come from the server; it is rendered from a client-only clock (`hooks/use-now.ts`, refreshed every 30 s).

### Phase 4c: Game rules v2
Business rules v2 A, B, C, E and F, within one game session (balances still start at 0 per game session until 4d).
- New migration (never edit 4a's): `round_templates` with a configurable number of prizes and their values (`winner_count` = length of `prizes`, which become the real paid values); `game_session_rounds` copies `prizes` and `winner_count` when the round starts; `game_session_players` gets one signed `balance` in place of `positive_balance` / `negative_balance`. Money functions rewritten with `create or replace` (purchase, release, gift, check-in, award, close, carryover, end) following the v2 ledger mapping (section 3). **Deletes every game session created before 4c** (test data only; approved by the product owner on 2026-09-28), so the new columns start clean.
- UI: the `/rounds` form (number of prizes and each prize value), winning-number slots from the round's `winner_count`, `prize-rules.ts` and the reducer on the new rules (the optimistic UI must still match SQL), balances shown as one signed amount, check-in as "está en esta ronda" with no money and no negative-balance block, a round summary when a round closes (rule F).
- Decided in the 4c plan: house balance and round margin, round kind, check-in lock (see "Pending design").

**Acceptance:** SQL simulation like 4a's (one transaction, rolled back): a round with 3 configured prizes pays each slot its configured value; a gifted winning ticket pays prize − P; a kept gifted number is charged in the next round and is no longer a gift; check-in writes no money; balances go negative and positive and match the ledger (0 mismatches). In the browser: create a round template with its prizes, play a full game session with it, see the round summary on close, and check that editing a template's prizes mid-round doesn't change the open round.

**Phase 4c status (2026-09-28): done** on branch `feat/backend-phase-4c`.
- Migration `20260928215255_game_rules_v2.sql` (applied with the product owner's approval): deleted the test game sessions #1 and #2; `round_templates` lost `kind` / `winner_count` and holds 1–5 prizes (all > 0); `game_session_rounds` copies `prizes` and keeps the margin split at close; `game_session_players.balance` replaces the positive/negative pair; money helpers split into sales/refunds (`charge_player` / `credit_player`, which move the house result) and cash (`move_cash`); `record_check_in(p_game_session_id, p_player_id, p_request_id)` moves no money and raises `pending_carryover` before the player keeps or releases their numbers; `award_prize` pays `prizes[slot]` (a gifted ticket prize − P) and raises `check_in_pending`; `resolve_carryover` charges every kept number and clears gifts. `winner_count` / `prize_multiplier` / `round_margin` helpers dropped.
- SQL simulation (one transaction, rolled back, as the real admin session and the observer): the agreed case A (−$50) and case B (+$150) exact, with their margin parts; a 3-prize round ($5; $60/$30/$15) paid slot values, a gifted winner prize − P ($55); a kept gifted number charged in the next round and no longer a gift; check-in wrote no money and was rejected while the carryover was pending; winning numbers rejected before every check-in; a recharge moved the balance but not the house result; payout limited to the balance; editing a template's prizes mid-round left the open round unchanged; switching the template before any sale copied the new prizes; the observer got `not_admin`; 0 player mismatches and 0 house difference against the ledger in both game sessions.
- Browser (admin account): created "Prueba 4c" ($5, 3 prizes) on `/rounds`; played it (Ana 3 numbers with one gifted, Carlos 1), check-in with a debt asked for confirmation and left the balance as is; winners #3 (Ana's gift, $55), #4 (Carlos, $30), #15 (unsold); the round summary showed each winner as "Cartón 1 · #X" and the house result (+15 − 85 + 0 − 50 + 10 = −$110); Ana kept her play (gift charged, balance $45 → $15); "Terminar jornada" refunded the unplayed round and showed the game session summary (house −$110, $70 owed to players). SQL reconciliation of that game session: 0 differences.
- Security advisor: the 19 expected 0029 findings (one per public function) plus the project-level leaked-password setting; nothing new.

### Phase 4d: Player account between game sessions
Business rules v2 D and G, plus the settlement that used to be 4c (section 5b).
- Design decisions taken on 2026-09-28 (see "Pending design" under business rules v2).
- Delivered in two branches: **4d1** the database (no screen change besides the timeline texts of the new rows, so it can be merged alone) and **4d2** the screens: the settlement at `/games/[id]/settlement` opened from the end-of-game summary, balance and status columns plus "Recibir pago" / "Registrar pago" / status actions on `/players`, the alert on "Iniciar jornada", and account balances shown in the live game before a player joins.

**Acceptance:** SQL reconciliation across at least two consecutive game sessions: for each player, `opening_balance + ledger = closing balance`, and the next game session opens with that closing balance. In the browser: the alert before starting a game session lists the right players; a payout lowers the balance and appears in the timeline with its method; double-clicking the payout button records one payment.

**Phase 4d1 status (2026-09-28): done** on branch `feat/backend-phase-4d1`.
- Migration `20260928225421_player_accounts.sql` (applied with the product owner's approval): deleted the Phase 4c test game session; `public.player_accounts` (one signed balance per player, `credit_status` `play` / `pending_payout` + `credit_note`; members read, only functions write; a $0 row per existing player, created on demand for new ones); `game_session_players.opening_balance`; `activity_log.game_session_id` nullable for recharges, payouts and status changes outside a game session; new rows `balance_opened`, `balance_closed`, `credit_kept_for_play`, `credit_payout_pending`.
- Functions: `record_account_recharge`, `record_account_payout` (no limit) and `set_credit_status` (raises `no_credit_balance` unless the balance is positive), all routed to the active game session when the player is in it; `ensure_session_player` opens with the account balance; `end_game_session` moves every final balance (removed players included) to the account and clears the status of balances that are no longer positive; `discard_game_session` also raises `game_session_has_payments`; `record_payout` dropped. The live-game timeline shows the new rows ("entró con saldo…", "terminó con saldo…").
- SQL simulation (one transaction, rolled back, run before applying and again against the applied functions): a recharge and a payout outside a game session (a repeated request id wrote one), status refused on a negative balance and kept on a positive one; game session 1 opened each player with their account balance, a recharge and a payout for a player in it went to the game session, a removed player's balance (−$25) reached their account; after it, "Para jugar" then a full payout cleared the status and a further payout left −$10 (no limit); game session 2 opened with those balances and "Salir y borrar" was refused after a recharge (`game_session_has_payments`); 0 mismatches per game session player (opening + ledger) and per account (whole history); the observer got `not_admin`.
- Security advisor: 21 expected 0029 findings (the 19 of 4c minus `record_payout`, plus the three new functions) and the project-level leaked-password setting; nothing else.

**Phase 4d2 status (2026-09-29): done** on branch `feat/backend-phase-4d2` (Phase 4d complete).
- Migration `20260929052150_settlements.sql`: `settlements` / `settlement_players` (members read, only functions write), created by `end_game_session`; `settlement_receive`, `settlement_payout`, `settlement_mark`, `close_settlement` (`settlement_closed` afterwards); `player_accounts.credit_status/credit_note` renamed `balance_status/balance_note` with `owes`, `set_credit_status` replaced by `set_balance_status` (`no_credit_balance`, `no_debt_balance`, `note_required`); cash moves share `private.record_cash`; new ledger rows `debt_noted`, `settlement_closed`.
- Screens: `/games/[id]/settlement` (`components/settlement-page.tsx`, data in `lib/data/settlement.ts`, which reads the game session ledger page by page), `/settlement` (list), "Liquidación" in the sidebar, "Ir a liquidación" in the end-of-game summary; `/players` shows each account's balance and status with "Recibir pago" / "Registrar pago" / "Estado del saldo" (`components/account-movement-dialog.tsx`, `components/balance-status-dialog.tsx`, `lib/data/account-actions.ts`); "Iniciar jornada" warns about debts, pending payouts, undecided positive balances and open settlements with unresolved players (`getStartAlerts`), without blocking; the live game shows a catalog player's account balance before they join. SQL errors from Server Actions go through `lib/data/reject-game-action.ts`.
- SQL simulation (rolled back, before applying and again against the applied functions): one settlement row per player (a $0 player `settled`); a partial collection left the player unresolved and the rest resolved them `paid_in` (a repeated request id recorded once); a payout `paid_out`; `pending_payout` without a note refused; `owes` on a positive balance and `play` on a negative one refused; a payout above the balance left it negative and cleared its status; a collection for a player playing another game session went to that session; closing kept the balances and refused later changes; the observer got `not_admin`; 0 account mismatches.
- Browser (admin account): game session #1 with Ana, Carlos, María and Luis (Ana won #1) → summary → "Ir a liquidación": Carlos paid $10 then $10 more with a double click (one move, "Pagó $20"), María "Queda debiendo · paga el viernes", Luis paid in full, Ana was paid $50 of $80 and the rest marked "Pendiente de pago" (an empty note was refused inline) → "Todo resuelto"; `/players` showed each balance and note, and a $20 collection from Juan outside any game session left him "Por definir"; the settlement was closed and reopened from the sidebar read-only; "Iniciar jornada" warned about María, Juan and Ana; game session #2 opened Ana with +$30 ("A favor $20" after buying a number). SQL reconciliation: 0 mismatches per game session player (opening + ledger) and per account.
- Security advisor: 25 expected 0029 findings (the 21 of 4d1 minus `set_credit_status`, plus five new functions) and the project-level leaked-password setting.

### Carryover lock and automatic check-in (2026-10-06)

Decided with the product owner after a double charge found in the data (a number bought in the new round before deciding was charged once by the purchase and again inside the kept amount of `resolve_carryover`). Migration `*_carryover_lock_and_auto_check_in.sql`, test `supabase/tests/carryover_lock_and_auto_check_in.sql`:

- **Lock:** while `game_session_players.pending_carryover` is set, the player's play can't change. `private.assert_no_pending_carryover` is called by the four `private.apply_*` helpers (purchase, release, reassign — from or to the player —, gift toggle), so `record_purchase`, `release_number`, `reassign_number`, `toggle_gift` and `edit_player_numbers` raise `pending_carryover`. Only `resolve_carryover` can touch it. The UI mirrors it (`isPendingDecision` in `lib/round-draft/context.tsx`, "Editar jugada" disabled).
- **Automatic check-in:** `resolve_carryover` sets `checked_in` and logs a `check_in` row with note `auto` when the player still holds at least one number after the decision. Releasing everything leaves them without check-in; buying again brings the regular check-in.
- Charges already made twice before this change are not corrected.

### Gifts are cleared when the round closes (2026-10-07)

Rule C says a gift lasts only its round, but the `is_gift` flag stayed on in the next round until the player kept or released their numbers, so the screen kept showing those numbers as gifts. `close_round` now sets `is_gift = false` right after `close_played_round` (the round's margin is computed from the flag there and the history reads the ledger, so nothing is lost). No money moves: `resolve_carryover` already charges every kept number, gifts included. Migration `*_clear_gifts_on_close_round.sql` also clears the flags of players waiting on that decision; test `supabase/tests/clear_gifts_on_close_round.sql`.

### Phase 5: Realtime and observer view
- `activity_log` subscription + debounced `HYDRATE`; `useRole()` gating in every action component; "Solo lectura" badge.

**Acceptance:** Admin in one browser, observer in another: the observer sees each assignment and award appear within ~1 second and has no action buttons. A user from a second test house sees nothing from the first house.

Decided with the product owner (2026-09-29): observers see home, `/active-round` and `/new-game` read-only and live; the settlement, `/settlement` and `/players` refresh live too; the second-house check is a rolled-back SQL simulation (no permanent test house). No migration: `activity_log` was already in the Realtime publication (4a) and every game, account and settlement write adds a row there.

**Phase 5 status (2026-09-29): done** on branch `feat/backend-phase-5`.
- Realtime: `hooks/use-activity-feed.ts` opens one channel per page on `activity_log` inserts filtered `house_id=eq.<house>` (RLS decides what each user receives) and asks for a re-read when the channel reconnects. `RoundDraftProvider` re-syncs the live game on each row (100 ms debounce; the existing re-sync already yields to this tab's actions in flight), except in the tab that is ending or discarding the game session, so its end-of-game summary stays on screen. The re-sync reads the known game session's rows together with the active game session (`fetchGameSessionState(…, knownGameSessionId)`), one round trip instead of two. `components/live-refresh.tsx` (`router.refresh()`, 250 ms debounce) is mounted on home, `/players`, `/settlement`, `/games/[id]/settlement` and the "No hay una jornada activa" screen, so an observer enters a game session as soon as it starts.
- Observer UI: `RoundDraftProvider` exposes `readOnly` (role ≠ admin) and its actions become no-ops (no optimistic flicker). Hidden or disabled for observers: round picker, "Agregar jugador", check-in, "Agregar cartón", ticket cells and gift toggles (a gift shows as a badge), open-number balls, winning-number inputs ("?" for an empty slot), "Cerrar ronda", "Terminar jornada", every player-card action except "Ver rondas", "Salir y borrar", "Iniciar jornada" (home, sidebar quick link, no-session screen). Home shows observers "Ver jornada en vivo" or "No hay una jornada activa." The header shows a "Solo lectura" badge.
- Acceptance: admin in the app's browser pane, the product owner as observer in Chrome, on game sessions #2 and #3: purchase, gift, check-in, recharge, winning number, round close, keep play, end of game session, settlement mark / payout / close, a collection on `/players` and starting a game session all appeared for the observer without reloading and quickly, with no action buttons and "Solo lectura" always shown. Measured between two tabs: 0.96–1.18 s from the admin's tap to the other tab (≈0.7–0.9 s after the write commits; 1.7 s before the re-sync changes above). Found and fixed during acceptance: the admin's own Realtime echo replaced the end-of-game summary with "No hay una jornada activa". SQL (rolled back): an admin of a second house read 0 rows of the first house in all 15 tables and got `not_admin` from `record_recharge`, `settlement_receive` and `record_account_recharge`; the real observer read everything of their house and nothing of the other. Reconciliation of game sessions #1–#2: 0 mismatches.
- Security advisor: unchanged (25 expected 0029 findings and the leaked-password setting).

### Phase 6: Reports and members
- `/games`: list of game sessions (replaces the hardcoded `games` array in `game-page.tsx`); `/games/[id]` reads the real game session. `/reports?game=id`: rounds, winners, timeline, per-player totals, from SQL. The report includes a **cash summary**: total recharges and total payouts per payment method, and the players still pending payment. With business rules v2 each game session report also shows every player's opening balance, movements and closing balance (from 4d), and the prizes as configured on each round (from 4c). "Daily" grouping uses `houses.timezone`, with a game session counted on its start date.
- `RoundHistoryCard` and `player-rounds-dialog` use real rounds; the "Jornada #42" heading (`page-heading.tsx`) and `NEXT_GAME_NUMBER` (`main-page*.tsx`) use real numbers.
- Optional: a members page where the admin invites observers by email through a server action using the service-role key (server-only, never exposed to the client).

**Acceptance:** A report for an ended game session matches what happened in the Phase 4 test run.

Decided with the product owner (2026-09-29): Phase 6 ships in two branches, **6a** game sessions (Reportes → Jornadas, the game session report, the live game's round history and "Ver rondas", real game session numbers, home) and **6b** the reports across game sessions (the Rondas, Deudas, Mensual and Diario tabs and the cash summary for a period). The full report of one game session is `/games/[id]`, opened from Reportes → Jornadas ("Volver" returns there); there is no second report under `/reports?game=`. Home shows simple real data; the streak and record-time cards are dropped (dashboard metrics stay under "Later"). The members page is postponed: observers keep being added by hand.

**Phase 6a status (2026-09-29): done** on branch `feat/backend-phase-6a`. No migration.
- `lib/game-report/`: `ledger.ts` (the house result and how ledger amounts count as sales; `lib/round-draft/game-api.ts` and `lib/data/settlement.ts` now share it), `fetch.ts` (`fetchGameSessionList`, `fetchGameSessionReport`, `fetchClosedRounds`, `fetchPlayerRounds`; they take the Supabase client like `fetch-state.ts`, and read the ledger page by page), `types.ts`, `format.ts` (dates in the house time zone). Server reads in `lib/data/game-sessions.ts` (`listGameSessions`, `loadGameSessionReport`, `loadHomeSummary`).
- Screens: Reportes → Jornadas and `/games` list every game session (number, date, rounds played, players, tickets, house result, settlement state); `/games/[id]` is the report: house result and its breakdown, cash by payment method plus what the settlement collected and paid, every round (line price, configured prizes, winning numbers, winners "Cartón N · #X", unsold winning numbers, house result), every player (opening, played, prizes, recharges, payouts, closing, "Ver rondas"), and the full timeline; an active game session shows what happened so far. The live game shows "Jornada #N" and its date, a real round history (re-read when a round closes) and a real "Ver rondas" (per round: numbers bought, gifted, kept count, wins, recharges and payouts; kept numbers are counted, not listed, because `carryover_kept` stores only the amount). Home shows the active or next game session number, the last ended game session (players, house result, link to its report) and how many players have a pending balance. The end-of-game summary links to the game session report. The Rondas tab of Reportes shows "en construcción" until 6b. Mock data removed (`game-player-rounds-dialog.tsx` deleted).
- Acceptance: SQL over game sessions #1–#4: sales − prizes + round margins equals `house_balance` in every one (#1 −130, #2 −210, #3 0, #4 −140), and the report showed those values, the same recharges by method and the same players. In the browser (admin): the list showed #1–#4; #1's report matched what was played (Ana won $100 with Cartón 1 · #1; settlement collected $30 and paid $50); game session #4 (Especial, 2 prizes) showed "Jornada #4 · Martes, 29 de septiembre", the round summary with Carlos winning $100 with #9 and #15 unsold (+$40 for the house), the round history refreshed on close, "Ver rondas" for Carlos (bought #2 and #9 and won $100 in round 1, kept 2 numbers in round 2), and its report after ending it. Observers read these pages through the same RLS as Phase 5 and they have no write controls; not re-run with the observer account in this phase.

### Phase 6a2: Payment methods v2 and the player's bank
Decided with the product owner (2026-09-30), before 6b because the cash reports group by payment method:
- **Payment method** (chosen on every recharge, collection and payout, and as the player's default): Efectivo, Zelle, Venmo, Majority, PayPal, Square, Otro (`cash`, `zelle`, `venmo`, `majority`, `paypal`, `square`, `other`).
- **Bank** (`players.bank`, a player attribute edited on `/players`, optional; not asked on each movement): Chase, Bank of America, TD Bank, Wells Fargo, Chime, Otro (`chase`, `bank_of_america`, `td_bank`, `wells_fargo`, `chime`, `other`). More banks will be added later (a new migration + `lib/banks.ts`). **2026-10-07** (`*_player_nickname_uppercase_banks.sql`, applied by the product owner in the SQL Editor after a rolled-back dry run): Capital One, First One Bank, UFCU Bank, Regional Bank, Southwest Bank, SouthState Bank, Frost Bank, Mid Bank, PNC Negocio, PNC Personal added (all earlier banks kept); `players.username` renamed to `nickname` ("Nickname"); a trigger (`private.normalize_player_names()`) stores the name and nickname trimmed and in uppercase (an empty nickname is null), and the existing 15 players were converted. Labels on the player: "Entidad bancaria (ingreso)" and "Método de pago (salida)" (names only; recharges and payouts are recorded as before).
- Fixed lists in code for now.
- `transfer`, `credit_card`, `debit_card` are **retired**: ledger rows that carry them stay (the ledger is immutable) and still show "Transferencia" / "Tarjeta de …"; new rows can't use them. Players whose default was one of them moved to `other`.

**Phase 6a2 status (2026-09-30): done** on branch `feat/backend-phase-6a2`.
- Migration `20260930174446_payment_methods_v2.sql` (applied as approved in the plan): 5 players moved from `transfer`/cards to `other`; `players.payment_method` check with the new list; `players.bank` with its check; `activity_log.payment_method` check with the new list plus the three retired values; trigger `activity_log_reject_retired_payment_method` (`private.reject_retired_payment_method()`) raises `payment_method_retired` on new rows with a retired method, whichever function writes them.
- Code: `lib/payment-methods.ts` (`PAYMENT_METHODS` current, `LEGACY_PAYMENT_METHODS`, `RecordedPaymentMethod` for ledger reads, `isRecordedPaymentMethod`), `lib/banks.ts`; `Player.bank`, `DraftPlayer.bank`, `SettlementPlayer.bank`; "Entidad bancaria" in the player form and as an inline-editable column on `/players` (text for observers); recharge and collect/pay dialogs offer only current methods, prefill the player's method (or Efectivo) and show "Banco: …".
- Acceptance: SQL (rolled back, as the admin session) — `record_account_recharge` with `zelle` and `record_account_payout` with `venmo` saved, `transfer` rejected with `payment_method_retired`, the 3 old `transfer` rows untouched, `bank = 'chase'` accepted and an unknown bank / a card method on a player rejected (23514). Browser (admin): Carlos edited inline to Zelle + Chase (saved), "Recibir pago" showed "Banco: Chase", offered only the 7 methods and recorded $10 by Venmo (+$90 → +$100); a test player created with TD Bank and removed; game session #2's report still shows "Transferencia $20". The live-game recharge dialog uses the same selector and was not exercised (no active game session). Security advisor unchanged (25 expected 0029 findings + leaked-password setting).

### Phase 6b: Reports across game sessions (planned, decided 2026-09-29)
- **Routes:** `/reports` → `/reports/games`; `/reports/games` (list), `/reports/games/[id]` (the game session report, moved from `/games/[id]`), `/reports/rounds`, `/reports/debts`, `/reports/daily`, `/reports/monthly`. `/games` and `/games/[id]` redirect there; the settlement stays at `/games/[id]/settlement`. The tabs become links in a `reports/layout.tsx`.
- **Rondas:** every round played on a chosen day (house time zone, a game session counts on its start date), with winners, prizes and house result per round and the day's total.
- **Deudas:** pending balances today: who owes (with note), who is owed ("Pendiente de pago", "Para jugar", "Por definir"), totals, and the game session the balance comes from.
- **Diario / Mensual:** per day or month: house result with its breakdown, cash by payment method (in game sessions, in settlements, outside game sessions), activity (game sessions, rounds played, distinct players, tickets) and top players (who played and who won the most).
- Decided in the 6b plan (2026-09-30): cash has **two origins**, "Durante la jornada" (rows with `game_session_id`) and "Fuera de jornada" (settlement and `/players` together; they aren't told apart and no migration is added); Diario picks one day, Mensual one month plus a day-by-day table; totals are computed in TypeScript from the ledger (paged), no SQL view for now. Delivered in two branches: **6b1** (routes, Rondas, Deudas, plus "Sin banco" in the `/players` table left over from 6a2) and **6b2** (Diario, Mensual).

**Phase 6b1 status (2026-09-30): done** on branch `feat/backend-phase-6b1`. No migration.
- Routes: `app/(app)/reports/layout.tsx` with `components/reports-tabs.tsx` (the tabs are links: Jornadas, Rondas, Deudas; Diario and Mensual come in 6b2); `/reports` redirects to `/reports/games`; the list and the game session report moved to `/reports/games` and `/reports/games/[id]`; `/games` and `/games/[id]` redirect there; the settlement stays at `/games/[id]/settlement`. Links updated (list rows, report "Volver", home "Ver reporte", end-of-game summary). `tabs-solid.tsx` and `reports-page.tsx` deleted.
- Rondas (`/reports/rounds?date=YYYY-MM-DD`, today in the house time zone by default): `fetchRoundsOfDay` (`lib/game-report/fetch.ts`) takes the game sessions that started that day (`houseDayRange` / `houseToday` in `lib/game-report/format.ts`, DST-safe) and shows their played rounds per game session with the day's house result (`components/rounds-report.tsx`, reusing `RoundHistoryCard` and `RoundsDateFilter`).
- Deudas (`/reports/debts`): `lib/data/debts.ts` (`listDebts`: active players with a non-zero live balance, their status and note, method and bank, and the last game session they played) and `components/debts-report.tsx` (totals owed to / by the house, groups Deben, Pendiente de pago, Por definir, Para jugar with their totals).
- `/players`: "Sin banco" in the "Entidad bancaria" column clears the bank (`NO_BANK`, `BANK_OPTIONS_WITH_NONE` in `lib/banks.ts`, shared with the player form).
- Acceptance (admin, browser): `/reports` → `/reports/games` with the Jornadas tab active; `/games/17` → `/reports/games/17`; Rondas of 2026-09-29 showed the played rounds of game sessions #1, #2 and #4 (#3 had none) and a day total of −$480 (−130 −210 −140, matching `house_balance`); the previous-day arrow moved to `?date=2026-09-28` ("No se jugaron rondas") and "back" returned to the 29th; Deudas showed Carlos (+$100, Para jugar, Zelle · Chase) and Juan (+$10, Por definir), both with last game session #4, owed by the house $110, matching `player_accounts` (no active game session); "Sin banco" set Carlos's bank to null in the database.

### Phase 6b2: Diario and Mensual
See the 6b decisions above.

**Phase 6b2 status (2026-09-30): done** on branch `feat/backend-phase-6b2` (**Phase 6 complete**, except the optional members page, postponed by the product owner). No migration.
- `lib/game-report/period.ts` (`fetchPeriodReport(supabase, houseId, from, to, timeZone)`): the game sessions that started in the period (house time zone) with their rounds, winners, tickets and players; their ledger (paged) for sales per player; and every recharge/payout registered in the period (paged). Returns the house result (`houseResult` from ledger sales, `round_winners` prizes and round margins), cash by method split "Durante la jornada" (row has `game_session_id`) / "Fuera de jornada", activity (game sessions, rounds played, distinct players, tickets), top 5 by net amount played and by prizes won, and one entry per day (house result of the game sessions started that day, net cash registered that day). Dates: `houseDayRange`, `houseDayOf`, `monthDays`, `isMonthString`, `formatDayShort`, `formatPeriod` in `lib/game-report/format.ts` (labels formatted on the server).
- Screens: Diario (`/reports/daily?date=`) and Mensual (`/reports/monthly?month=YYYY-MM`, month arrows up to the current month, plus a day-by-day table whose days open their Diario), sharing `components/period-report.tsx`; the tabs bar now has Jornadas, Rondas, Deudas, Diario, Mensual. `lib/day-param.ts` holds the `?date=` helpers shared with Rondas.
- Acceptance (admin, browser + SQL): Diario 2026-09-29 → house result −$480 (sales +110, prizes −300, gifts −10, unsold losing −320, unsold winning +40; equal to the sum of `house_balance` of #1–#4), 4 game sessions, 3 rounds played, 5 players; its cash matched `activity_log` grouped by house day, method and origin row by row (in game: Transferencia $20; outside: Transferencia $20, Efectivo $10, PayPal $20 in / $170 out, Tarjeta de crédito $10 — retired methods shown with their labels). Mensual septiembre = 29 + 30 (−$480; outside recharges $70 with the 30th's Venmo $10), 30 day rows (29: −$480, net cash −$90; 30: net cash +$10), "Mes siguiente" disabled on the current month, a day link opened Diario (tab active) and "back" returned; August showed "No hubo movimiento".


### Phase 7: Polish and final verification
Decided with the product owner (2026-10-01) after Phase 6: close the minor gaps the screens registry kept open, which belong to no phase, and run one last end-to-end game session with the admin and an observer. No migration.
- Header titles in Spanish from a route → title table (`lib/page-titles.ts`) instead of the raw path ("REPORTS/DAILY").
- A Spanish "not found" page for unmatched URLs (`app/not-found.tsx`) and an own message for a settlement that doesn't exist (like the game session report).
- "Ver reporte de la jornada" from the settlement to `/reports/games/[id]`.
- Home "Jornada Live" → "Jornada en vivo"; the live round history shows a message when its read fails; Mensual shows the current month for a future `?month=`; unused template data removed from the sidebar and "Settings" → "Configuración".
- Out of scope: the Settings page forms (house editing stays under "Later").
- **Acceptance:** typecheck, lint and build with 0 errors; one short game session played end to end by the admin with the product owner watching as observer: home summary and the "Iniciar jornada" alert, "Editar jugada", a recharge by Zelle showing the player's bank, check-in, winning number and round close, "Liberar", "Retirar jugador", end of game session, settlement (collect, pay, "Para jugar") → its report; the observer walks every Reportes tab, the report and the settlement read-only and live, with Spanish titles; SQL reconciliation of the game session (opening + ledger = closing per player, house result = `house_balance`).

**Phase 7 status (2026-10-01): done** on branch `feat/backend-phase-7`. **The backend plan is complete** (only "Later" and the postponed members page remain).
- Code: `lib/page-titles.ts` + `components/site-header.tsx` (Spanish titles per route); `app/not-found.tsx` (unmatched URLs; it has to live at the root, a route group's `not-found.tsx` doesn't catch them); the settlement page shows "No se encontró la liquidación" for an unknown id and links "Ver reporte de la jornada"; home "Jornada en vivo"; the live round history says when its read fails; Mensual clamps a future `?month=` to the current month; the sidebar lost its unused template data and shows "Configuración".
- Final game session #5 (admin in the app's browser pane, the product owner as observer in Chrome): home showed "Jornada #5" and the pending-balance summary; "Iniciar jornada" warned about Juan (+$10, Por definir) and the open settlement of #4; Carlos bought #3 and #8, Ana #5; "Editar jugada" gave Ana #12 as a gift; a $20 recharge by Zelle for Ana showed "Banco: Chime" (−$10 → +$10); check-ins, winner #8 (Carlos +$100) and the round close (house −$190); "Liberar" (Carlos kept #8, released #3); "Retirar jugador" (Ana); "Terminar jornada" → "Ir a liquidación": Ana paid $10 by Venmo, Carlos "Para jugar", "Todo resuelto"; "Ver reporte de la jornada" opened `/reports/games/21` with the same numbers. The observer saw every change live, no write controls, Spanish titles and "Configuración", and walked the five Reportes tabs, the report and the settlement. SQL: computed house result = `house_balance` = −$190; opening + ledger = closing for both players (0 differences); accounts Ana $0, Carlos +$180 "Para jugar".

### After the plan: the bank of each cash move (2026-10-07)
Decided with the product owner in QA: "Recibir pago" / "Registrar pago" (`/players`, the settlement) and the recharge in the live game ask for **Banco** ("Entidad bancaria (ingreso)") and **Método** ("Método de pago (salida)"), both prefilled from the player, and both are stored on the ledger row of that move.
- Migration `20261008120000_movement_bank.sql` (applied by the product owner in the SQL Editor on 2026-10-07; the MCP refuses destructive DDL): `activity_log.bank` (nullable, same check as `players.bank`); the ledger is append-only, so `private.log_activity` and `private.record_cash` take `p_bank` (dropped and recreated); `record_account_recharge`, `record_account_payout`, `settlement_receive`, `settlement_payout` and `record_recharge` take `p_bank text default null` as their last argument (dropped and recreated with the same grants), so callers that don't send it keep working.
- Verified with read-only SQL: the column, the five public signatures with `p_bank`, and `execute` only for `authenticated` (private helpers for nobody).

### Configuración (2026-10-07)
Decided with the product owner while preparing the demo house: `/settings` stops being a prototype.
- Migration `20261008170000_house_settings.sql` (dry run with rollback, then applied by the product owner in the SQL Editor): `houses.phone`, `houses.logo_path`; `update_house(p_house_id, p_name, p_identifier, p_timezone, p_phone, p_request_id)` and `set_house_logo(p_house_id, p_logo_path, p_request_id)` (admin only via `private.require_admin`, by request id, errors `invalid_name`, `invalid_identifier`, `identifier_taken`, `invalid_timezone`, `invalid_phone`, `invalid_logo_path`), each leaving a `house_updated` ledger row without a game session (so `LiveRefresh` follows); public bucket `house-logos` (1 MB, PNG/JPG/WEBP/SVG) whose writes are limited to the house admin under `{house_id}/` (`private.is_logo_admin`).
- Dry run (as the demo house admin): anon → `not_admin`, another house's identifier → `identifier_taken`, `Mars/Base` → `invalid_timezone`, another house's folder → `invalid_logo_path`; a save trimmed/uppercased and logged two `house_updated` rows.
- App: `getCurrentHouse()` adds `identifier`, `phone`, `logoPath`, `logoUrl`; `lib/house-settings.ts` (schemas, time zones, logo limits); Server Actions in `lib/data/settings-actions.ts` (`updateHouse`, `setHouseLogo`, `updateDisplayName` → `user_metadata.full_name`, `changePassword` → `auth.updateUser`). The logo shows in the sidebar user avatar and the Inicio greeting (never replaces the Bingo Tally logo); "Mi cuenta" in the user menu opens `/settings`.
### Demo environment for the client (2026-10-07)
Decided with the product owner: the client reviews the product in their own house, in **the same Supabase project** (it only holds the product owner's test data so far; RLS keeps houses apart and `getCurrentHouse()` opens the user's oldest membership).
- Migration `20261008150000_seed_demo_house.sql` (applied with the MCP): house **CASA DEMO DAIRY** (`CASA-DEMO-DAIRY`, `America/Chicago`), admin `guiaaliadabingoo@gmail.com` (account created by hand in Authentication → Users), 12 fictitious players with payment methods and banks, 4 round templates (Regular, Doble, Especial, Gran Bingo), no game sessions. Verified with read-only SQL.
- Branch **`bingo-dev-1`** (created from `main`) is what the demo runs: it only gets what the product owner merges into it from `main` (PR `main → bingo-dev-1`); nobody commits to it directly. Since migrations reach the shared database when applied, not when merged, they must stay backward compatible.
- Tried first locally in production mode (`next build` + `next start` on port 3001); next, a Vercel project with Production Branch `bingo-dev-1` and an unlisted `*.vercel.app` link, plus that URL in Supabase Auth → URL Configuration.
- Before real money: a separate Supabase project and Vercel project for production.

### Player contact (2026-10-07)
Agreed in the 2026-09-25 meeting: players get a phone and an email, and the name is the only required field.
- Migration `20261008190000_player_contact.sql` (dry run with rollback, then applied by the product owner in the SQL Editor): `players.phone` (up to 30) and `players.email` (up to 254, basic shape check), both optional; `private.normalize_player_names()` also trims the phone and trims + lowercases the email (empty → null), and the trigger now fires on those columns too. Dry run: `' Cliente@Ejemplo.COM '` → `cliente@ejemplo.com`, a malformed email → `players_email_check`, blanks → null.
- App: `Player.phone` / `Player.email` and the zod schema (`lib/players.ts`, tests in `lib/players.test.ts`); the player form adds Teléfono and Correo, and Nickname is no longer required; `/players` shows them in one "Contacto" column (data-table `type: "lines"`).

## Later (not now)
House switcher, transferring the admin role to another member, dashboard metrics, offline queue.

## Files
New: `supabase/migrations/*_init.sql`, `lib/supabase/database.types.ts`, `lib/data/{house,admin-session,players,rounds,load-game-session,game-session-actions}.ts`, `app/(app)/(game)/layout.tsx` (provider), `app/(app)/games/[id]/settlement/page.tsx`, `components/settlement-page.tsx`.

Modified: `app/layout.tsx` (remove provider), `lib/round-draft/{context.tsx,types.ts,players.ts,prize-rules.ts,selectors.ts}`, `lib/rounds.ts`, `lib/supabase/{server,client,actions}.ts`, `app/auth/callback/route.ts`, the login page, `app/(app)/{layout,players,rounds,new-game,active-round,games,reports}/…`, `components/{main-page-split,open-numbers-card,player-page,player-form,rounds-page,round-form,game-page,game-detail-page,tabs-solid,add-player-control,player-edit-numbers-dialog,player-active-card,activity-log-card,tickets-assignment-page,page-heading}.tsx`, close-round/end-game dialogs, `round-history-card.tsx`, `CLAUDE.md` (remove "UI-only prototype", describe this architecture), `SUPABASE_AUTH.md` (tenancy + single admin session).

Delete: `lib/round-draft/storage.ts`, `players/data.json`, `rounds/data.json`.
