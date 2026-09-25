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
npm run format          # prettier --write "**/*.{ts,tsx}" (prettier-plugin-tailwindcss enabled)
```

There is no test runner configured in this project. `typecheck` and `lint` must both pass with 0 errors (BACKEND_PLAN.md checks them at the end of every phase). ESLint ignores the design-sync tooling output (`.ds-sync/`, `ds-bundle/`, `.design-sync/`) — it is not app code.

To add a shadcn/ui component: `npx shadcn@latest add <component>` — it lands in `components/ui/`.

## Backend migration in progress

`BACKEND_PLAN.md` is the source of truth for moving this app onto Supabase (Postgres + RLS + Realtime), implemented **one phase at a time**. Phases 1–3 are done: auth, tenancy/roles, the single admin session, and the player and round-template catalogs live in Supabase. Phase 4a added the game-session SQL functions (`supabase/migrations/*_game_session_functions.sql`: one `security definer` function per game action, idempotent by `request_id`, amounts computed in SQL); the live game session (`lib/round-draft/`) is still client-only until Phase 4b wires it to them. Rules that already apply to all new code:

- **Code nomenclature is English** (tables, columns, functions, types, files, routes, enum values, activity types); **only user-facing text is Spanish**. The plan's "Naming conventions" section has the glossary (jornada → game session, cartón → ticket, …) and the list of existing Spanish identifiers to rename.
- Supabase database work goes through the `supabase` MCP server configured in `.mcp.json` (project `ADMIN-BINGO`, ref `xrporompvbfjfmkfxkwa`). Auth wiring is documented in `SUPABASE_AUTH.md`.
- When a screen is added or changed, refresh `docs/screens-registry.md` with the `ui-project-agent` (`/ui-audit`) instead of editing it by hand.

## Architecture

This is a Next.js App Router admin dashboard for running bingo game sessions ("jornadas"), backed by Supabase (Postgres + RLS). There is no `app/api/` and no ORM: every query uses the signed-in user's Supabase client, so RLS applies (BACKEND_PLAN.md "Architecture decisions").

- **Persisted pages** (`/players`, `/rounds`): the route's `page.tsx` is a Server Component that reads through `lib/data/<thing>.ts` (e.g. `listPlayers()`, cached per request) and passes domain objects as props to a Client Component. Writes are Server Actions in `lib/data/<thing>-actions.ts` (`"use server"`): validate with the shared zod schema (`lib/players.ts`, `lib/rounds.ts`), take `house_id` from `getCurrentHouse()` (never from the client), `.select()` after updates (RLS turns a forbidden update into 0 rows, not an error), return a `WriteResult` (`lib/data/write-result.ts`) and call `refresh()` from `next/cache`. Failures go through `rejectWrite()` (`lib/data/reject-write.ts`), which sends a replaced admin session to `/login?reason=replaced`; the client shows errors with `writeSucceeded()` (`lib/write-feedback.ts`). Hide admin-only controls with `useRole()` (`components/house-provider.tsx`) — the database is the real guard.
- **Still mock** (`/games`, `/games/[id]`, `/reports`, dashboard numbers): hardcoded arrays in their components until BACKEND_PLAN.md Phase 6.

Domain vocabulary (Spanish) used throughout the UI and worth keeping consistent in new code: **jornada** = a game session/day, **ronda** = a round within a jornada (round template config: name, kind `regular`/`special`, line price, informational prizes — see `lib/rounds.ts` and `components/round-form.tsx`), **cartón** = a bingo card (15 numbers, 1–15, see `components/ticket-card.tsx`), **jugador** = player.

### App shell

The root layout `app/layout.tsx` holds only global providers: `ThemeProvider` → route content, plus the `sonner` `Toaster`. Routes are split into two route groups: `app/(auth)/` (bare layout for `/login`) and `app/(app)/`, whose layout fetches the signed-in user and renders the chrome — `SidebarProvider` → `AppSidebar` (nav definitions live inline in `components/app-sidebar.tsx`) → `SidebarInset` → `SiteHeader` (derives its page title from `usePathname()`) → page. It also resolves the current house and role (`HouseProvider`). `proxy.ts` (Next 16's renamed middleware) redirects unauthenticated requests to `/login`. Nested layouts beyond that are the exception — only add one when a route subtree needs shared chrome or a scoped provider: `app/(app)/(game)/layout.tsx` (a URL-less route group around `/new-game` and `/active-round`) loads the catalog and mounts `RoundDraftProvider`; `app/(app)/(game)/new-game/layout.tsx` adds the step breadcrumb.

### UI kit

shadcn/ui components in `components/ui/` are built on **Base UI** (`@base-ui/react`), not Radix — e.g. `Dialog`/`Select` use a `render={<Button />}` prop pattern instead of `asChild`. `components.json` controls the shadcn config (style `base-maia`, base color `mist`, path aliases `@/components`, `@/lib`, `@/ui`, `@/hooks`). Match existing component source when adding new Base UI-backed primitives instead of assuming Radix conventions from other codebases.

Styling is Tailwind v4 with CSS-variable theming in `app/globals.css` (OKLCH colors, light/dark via `.dark`), centered on a violet/indigo `primary`/`accent`. `chart-1`..`chart-5` tokens are available as Tailwind color utilities (`bg-chart-1`, etc.) and are used both for chart series and as an ad-hoc color-cycling palette (see `lib/round-draft/colors.ts`).

### `components/data-table.tsx`

A shared, feature-rich table (drag-to-reorder rows via `@dnd-kit`, sorting/filtering/pagination via `@tanstack/react-table`, a row-detail `Drawer`, `rowActions` dropdown) used by the players and rounds list pages. Column config supports a `type: "select"` editable column and `color`/`textSize` display hints. The row-detail drawer is read-only (editing goes through `rowActions`), and the table re-syncs when its `data` prop changes, so pass memoized rows. Reuse this component for any new tabular list rather than building a bespoke table.

### Multi-step flows with cross-route state: `lib/round-draft/`

Most pages are single-route and don't need shared state. The live game flow (`/new-game` to assign tickets and players → `/active-round` to play and close rounds) is the one exception, since it spans two routes and needs to survive navigation between them. The pattern established there:

- `types.ts` — plain domain types for the flow.
- `players.ts` — converts catalog players (loaded from the database by the `(game)` layout) into draft players with per-game-session balances at 0, and merges catalog changes into a saved draft (`SYNC_CATALOG`). The provider also exposes the house's round templates (`roundTemplates`). A player created during the flow is saved to the catalog first (`createPlayer`) and enters the draft with its database id.
- `storage.ts` — defines a small repository interface (`load`/`save`/`clear`) with a `localStorage`-backed implementation as the only one that exists today. It was meant as the seam for a real backend, but BACKEND_PLAN.md Phase 4 replaces it instead (per-action database writes don't fit a whole-state `save`): the provider will receive its initial state from a server loader and `storage.ts` is deleted.
- `context.tsx` — a `useReducer`-based `XProvider` + `useX()` hook. Hydration from storage happens in a `useEffect` *after* mount (not in the reducer's lazy initializer) to stay SSR-safe, and the "save to storage" effect is gated on a `isHydrated` flag so it never overwrites saved state with the pre-hydration default on mount.

Follow this same shape for any future multi-step/cross-route feature instead of introducing a new state management library.

### Data model notes

Database rows are snake_case (`lib/supabase/database.types.ts`, generated with the Supabase MCP); domain types are camelCase (`Player` in `lib/players.ts`, `Round` in `lib/rounds.ts`). The mapping lives in one place per table (`toPlayer()` / `toRound()` in `lib/data/`). Enum-like values are English in code and the database (`payment_method`: `lib/payment-methods.ts` has the values and their Spanish labels; round kind `regular`/`special`). Players carry no balances: balances are per game session (`game_session_players`, BACKEND_PLAN.md rule 7).
