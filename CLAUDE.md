# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ Non-standard Next.js version

This project pins `next@16.2.6`, which has breaking changes vs. the Next.js you were trained on — APIs, conventions, and file structure may differ. **Before writing Next.js code, read the relevant guide in `node_modules/next/dist/docs/`** (organized as `01-app/`, `02-pages/`, `03-architecture/`, `04-community/`) and heed any deprecation notices you encounter. This rule comes from `AGENTS.md` in the repo root.

## Commands

```bash
npm run dev        # start the dev server (next dev)
npm run build       # production build
npm run start        # run a production build
npm run lint          # eslint (flat config: eslint-config-next core-web-vitals + typescript)
npm run typecheck      # tsc --noEmit
npm test               # vitest run (unit tests in lib/)
npm run format          # prettier --write "**/*.{ts,tsx}" (prettier-plugin-tailwindcss enabled)
```

There is no test runner configured in this project. `typecheck` and `lint` must both pass with 0 errors (BACKEND_PLAN.md checks them at the end of every phase). ESLint ignores the design-sync tooling output (`.ds-sync/`, `ds-bundle/`, `.design-sync/`) — it is not app code.

To add a shadcn/ui component: `npx shadcn@latest add <component>` — it lands in `components/ui/`.

## Backend migration in progress

`BACKEND_PLAN.md` is the source of truth for moving this app onto Supabase (Postgres + RLS + Realtime), implemented **one phase at a time**. Phases 1–3 are done: auth, tenancy/roles, the single admin session, and the player and round-template catalogs live in Supabase. Phase 4a added the game-session SQL functions (`supabase/migrations/*_game_session_functions.sql`: one `security definer` function per game action, idempotent by `request_id`, amounts computed in SQL), Phase 4b persists the live game session through them (`lib/round-draft/`, see below), Phase 4c (`*_game_rules_v2.sql`) switched them to business rules v2 (one signed balance per player, check-in with no money, configurable round prizes and the house result), Phase 4d1 (`*_player_accounts.sql`) carries the balance between game sessions in `player_accounts`, and Phase 4d2 (`*_settlements.sql`) adds the settlement of each ended game session. Phase 5 makes every screen live for everyone through Realtime and gives observers a read-only view (no migration). Phase 6a reads the game sessions and their reports (`lib/game-report/`, no migration), 6a2 (`*_payment_methods_v2.sql`) switches to the new payment methods and adds the player's bank, and 6b1/6b2 add the reports across game sessions (Rondas, Deudas, Diario, Mensual) — Phase 6 is complete, and Phase 7 polished the app and verified it end to end: the backend plan is done (only "Later" remains). Rules that already apply to all new code:

- **Code nomenclature is English** (tables, columns, functions, types, files, routes, enum values, activity types); **only user-facing text is Spanish**. The plan's "Naming conventions" section has the glossary (jornada → game session, cartón → ticket, …) and the list of existing Spanish identifiers to rename.
- Supabase database work goes through the `supabase` MCP server configured in `.mcp.json` (project `ADMIN-BINGO`, ref `xrporompvbfjfmkfxkwa`). Auth wiring is documented in `SUPABASE_AUTH.md`.
- When a screen is added or changed, refresh `docs/screens-registry.md` with the `ui-project-agent` (`/ui-audit`) instead of editing it by hand.

## Architecture

This is a Next.js App Router admin dashboard for running bingo game sessions ("jornadas"), backed by Supabase (Postgres + RLS). There is no `app/api/` and no ORM: every query uses the signed-in user's Supabase client, so RLS applies (BACKEND_PLAN.md "Architecture decisions").

- **Persisted pages** (`/players`, `/rounds`, `/settlement`, `/games/[id]/settlement`, the report routes `/reports/games`, `/reports/games/[id]`, `/reports/rounds`, `/reports/debts`, `/reports/daily`, `/reports/monthly` — each tab of Reportes is its own route under `app/(app)/reports/layout.tsx`; `/games` and `/games/[id]` redirect there —, home): the route's `page.tsx` is a Server Component that reads through `lib/data/<thing>.ts` (e.g. `listPlayers()`, cached per request) and passes domain objects as props to a Client Component. Writes are Server Actions in `lib/data/<thing>-actions.ts` (`"use server"`): validate with the shared zod schema (`lib/players.ts`, `lib/rounds.ts`), take `house_id` from `getCurrentHouse()` (never from the client), `.select()` after updates (RLS turns a forbidden update into 0 rows, not an error), return a `WriteResult` (`lib/data/write-result.ts`) and call `refresh()` from `next/cache`. Failures go through `rejectWrite()` (`lib/data/reject-write.ts`), which sends a replaced admin session to `/login?reason=replaced`; the client shows errors with `writeSucceeded()` (`lib/write-feedback.ts`). Hide admin-only controls with `useRole()` (`components/house-provider.tsx`) — the database is the real guard. Pages that must follow the admin live mount `<LiveRefresh />` (`components/live-refresh.tsx`: `router.refresh()` on each new `activity_log` row of the house, via `hooks/use-activity-feed.ts`); every write, in or out of a game session, adds such a row, so that is the only Realtime signal needed. Money writes outside the live game (account moves on `/players`, the settlement) are Server Actions too (`lib/data/account-actions.ts`, `lib/data/settlement-actions.ts`) that call the SQL functions with a `requestId` and return a `GameActionResult`; SQL error codes go through `rejectGameAction()` (`lib/data/reject-game-action.ts`).
- **Game session reports** (Phase 6a): `lib/game-report/` holds the report reads (`fetch.ts`, taking the Supabase client so the server pages and the live game's round history / "Ver rondas" share them), how ledger rows count as money (`ledger.ts`: `saleAmount`, `houseResult`; reuse it instead of re-deriving signs) and dates in the house time zone (`format.ts`). Server wrappers live in `lib/data/game-sessions.ts`.
- **Period reports** (Phase 6b2): `lib/game-report/period.ts` computes a period (Diario, Mensual) from the ledger in TypeScript; a game session counts on the day it started and a cash move on the day it was registered, both in the house time zone (`lib/game-report/format.ts`).

Domain vocabulary (Spanish) used throughout the UI and worth keeping consistent in new code: **jornada** = a game session/day, **ronda** = a round within a jornada (round template config: name, line price and 1–5 prizes, one per winning number, paid per winning ticket — see `lib/rounds.ts` and `components/round-form.tsx`), **cartón** = a bingo card (15 numbers, 1–15, see `components/ticket-card.tsx`), **jugador** = player.

`/new-game` (`components/tickets-assignment-page.tsx`) picks the round first: the active-player select stays disabled until a round is open (numbers need one). Its tickets show in two views, chosen with a Cartones/Lista toggle and remembered per browser in `localStorage` (`new-game-view`, a display preference only): the grid `TicketCard` and the column `TicketListColumn` (`components/ticket-list-column.tsx`, a row per number with its player). Both share the click rules and the gift toggle (`ticketNumberState`, `GiftToggle` in `ticket-card.tsx`), so a change to them applies to both views. Each row of its Jugadores card summarizes what the player holds without looking at the tickets (`PlayerNumbersSummary`, from `getPlayerNumberSummary` in `lib/round-draft/selectors.ts`, which `/active-round`'s player card also uses): each number once as a chip in the player's color, "×N" when it is on N tickets, a red gift mark (with the gift count when only some are gifts) and the total of plays.

### App shell

The root layout `app/layout.tsx` holds only global providers: `ThemeProvider` → route content, plus the `sonner` `Toaster`. Routes are split into two route groups: `app/(auth)/` (bare layout for `/login`) and `app/(app)/`, whose layout fetches the signed-in user and renders the chrome — `SidebarProvider` → `AppSidebar` (nav definitions live inline in `components/app-sidebar.tsx`) → `SidebarInset` → `SiteHeader` (its Spanish title comes from `pageTitle(usePathname())` in `lib/page-titles.ts` — add new routes there) → page. It also resolves the current house and role (`HouseProvider`). `proxy.ts` (Next 16's renamed middleware) redirects unauthenticated requests to `/login`. Nested layouts beyond that are the exception — only add one when a route subtree needs shared chrome or a scoped provider: `app/(app)/(game)/layout.tsx` (a URL-less route group around `/new-game` and `/active-round`) loads the catalog and mounts `RoundDraftProvider`; `app/(app)/(game)/new-game/layout.tsx` adds the step breadcrumb.

### UI kit

shadcn/ui components in `components/ui/` are built on **Base UI** (`@base-ui/react`), not Radix — e.g. `Dialog`/`Select` use a `render={<Button />}` prop pattern instead of `asChild`. `components.json` controls the shadcn config (style `base-maia`, base color `mist`, path aliases `@/components`, `@/lib`, `@/ui`, `@/hooks`). Match existing component source when adding new Base UI-backed primitives instead of assuming Radix conventions from other codebases.

Styling is Tailwind v4 with CSS-variable theming in `app/globals.css` (OKLCH colors, light/dark via `.dark`), centered on a violet/indigo `primary`/`accent`. `chart-1`..`chart-5` tokens are available as Tailwind color utilities (`bg-chart-1`, etc.) and are used both for chart series and as an ad-hoc color-cycling palette (see `lib/round-draft/colors.ts`).

### `components/data-table.tsx`

A shared, feature-rich table (drag-to-reorder rows via `@dnd-kit`, sorting/filtering/pagination via `@tanstack/react-table`, a row-detail `Drawer`, `rowActions` dropdown) used by the players and rounds list pages. Column config supports a `type: "select"` editable column and `color`/`textSize` display hints. The row-detail drawer is read-only (editing goes through `rowActions`), and the table re-syncs when its `data` prop changes, so pass memoized rows. Reuse this component for any new tabular list rather than building a bespoke table.

### Multi-step flows with cross-route state: `lib/round-draft/`

Most pages are single-route and don't need shared state. The live game flow (`/new-game` to assign tickets and players → `/active-round` to play and close rounds) is the one exception, since it spans two routes and needs to survive navigation between them. The pattern established there:

- `types.ts` — plain domain types for the flow (`RoundDraftState`: game session id, tickets, players with their signed balance in this game session, open round with its `linePrice` and `prizes`, the house result so far, recent structured activity).
- `fetch-state.ts` — `fetchGameSessionState(supabase, houseId)`: reads the active game session with any Supabase client. The server uses it in `app/(app)/(game)/layout.tsx` (via `lib/data/load-game-session.ts`) to pass `initialState`; the provider uses it in the browser to re-sync.
- `game-api.ts` — one function per SQL game function, called from the browser with `supabase.rpc()` (the functions are the guard: admin check, amounts, idempotency by `request_id`). Errors map to Spanish via `lib/data/game-action-result.ts`.
- `context.tsx` — a `useReducer`-based `RoundDraftProvider` + `useRoundDraft()`. Frequent actions dispatch an optimistic change (same rules as SQL, `prize-rules.ts`) and send the RPC through an ordered queue; when the queue is idle the game session is re-read in the background and replaces local state unless a newer action started. Structural actions (add ticket, pick/close round) await that re-read; end/discard don't re-sync. No localStorage.
- Live and read-only (Phase 5) — the provider re-syncs on every new `activity_log` row of the house (`useActivityFeed`), except in the tab ending or discarding the game session, so an observer or the admin's other tabs follow within ~1 s. It exposes `readOnly` (role ≠ admin): actions become no-ops and components hide their controls with it (`TicketCard`, `TicketListColumn` and `WinningNumberBall` take a `readOnly` prop).
- `assign-ticket.ts` — `assignTicket(lineNumber, tickets)`: a purchase of number N goes to the lowest-`index` ticket where N is free, whatever ticket was tapped. The database decides it (`record_purchase(game_session_id, number, player_id, request_id)` returns the ticket, via `private.first_free_ticket`; migration `*_auto_assign_ticket.sql`); this only predicts it for the optimistic UI. Tests: `npm test` (Vitest, `lib/**/*.test.ts`). Freeing a play compacts its number's row (`compactLine`, mirrors `private.compact_line` in `*_compact_ticket_rows.sql`): later plays of that number move one ticket down, the number and the money never change, each move is a `number_moved` activity row, and nothing moves once the open round has winning numbers. SQL integration test: `supabase/tests/auto_assign_and_compact.sql` (rolls itself back; the report comes back as the error message).
- `activity-text.ts` — builds the Spanish timeline sentence from each structured `activity_log` row ("Cartón N · #X").

Follow this same shape for any future multi-step/cross-route feature instead of introducing a new state management library.

### Data model notes

Database rows are snake_case (`lib/supabase/database.types.ts`, generated with the Supabase MCP); domain types are camelCase (`Player` in `lib/players.ts`, `Round` in `lib/rounds.ts`). The mapping lives in one place per table (`toPlayer()` / `toRound()` in `lib/data/`). Enum-like values are English in code and the database (`payment_method`: `lib/payment-methods.ts` has the values and their Spanish labels; `PAYMENT_METHODS` are the ones that can be chosen, and ledger reads use `RecordedPaymentMethod` because rows written before Phase 6a2 may carry retired `transfer`/card values, which a trigger rejects on new rows. `players.bank`: `lib/banks.ts`). `players` carries no balances: each player's signed balance lives in `player_accounts` (written only by SQL functions; negative = owes, positive = the house owes them) and, while they play, in `game_session_players.balance`, which opens with the account balance and goes back to the account when the game session ends (Phase 4d, BACKEND_PLAN.md business rules v2). Read those rules and the ledger mapping in the latest game migration before touching money logic.
