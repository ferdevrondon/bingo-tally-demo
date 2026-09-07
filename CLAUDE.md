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

There is no test runner configured in this project.

To add a shadcn/ui component: `npx shadcn@latest add <component>` — it lands in `components/ui/`.

## Architecture

This is a Next.js App Router admin dashboard for running bingo game sessions ("jornadas"). It is a **UI-only prototype with no backend**: there is no `app/api/`, no ORM/database, and no shared client-side store beyond one feature's local state (see below). Every "page" component follows the same convention — seed `React.useState` from a static `data.json` in the corresponding `app/**/` route folder, mutate that array locally via dialogs/forms, and never persist across reloads. When extending an existing page (players, rounds, sessions), follow this same pattern unless the task specifically calls for real persistence.

Domain vocabulary (Spanish) used throughout the UI and worth keeping consistent in new code: **jornada** = a game session/day, **ronda** = a round within a jornada (config: name, winning-number count, prizes — see `components/round-form.tsx`), **cartón** = a bingo card (15 numbers, 1–15, per `components/ui/number-selector.tsx` / `components/carton-card.tsx`), **jugador** = player.

### App shell

There is a single root layout, `app/layout.tsx`: `ThemeProvider` → `SidebarProvider` → `AppSidebar` (nav definitions live inline in `components/app-sidebar.tsx`) → `SidebarInset` → `SiteHeader` (derives its page title from `usePathname()`) → route content. Nested layouts are the exception, not the norm — only add one (like `app/cartones/layout.tsx`) when a route subtree needs shared chrome or a scoped provider.

### UI kit

shadcn/ui components in `components/ui/` are built on **Base UI** (`@base-ui/react`), not Radix — e.g. `Dialog`/`Select` use a `render={<Button />}` prop pattern instead of `asChild`. `components.json` controls the shadcn config (style `base-maia`, base color `mist`, path aliases `@/components`, `@/lib`, `@/ui`, `@/hooks`). Match existing component source when adding new Base UI-backed primitives instead of assuming Radix conventions from other codebases.

Styling is Tailwind v4 with CSS-variable theming in `app/globals.css` (OKLCH colors, light/dark via `.dark`), centered on a violet/indigo `primary`/`accent`. `chart-1`..`chart-5` tokens are available as Tailwind color utilities (`bg-chart-1`, etc.) and are used both for chart series and as an ad-hoc color-cycling palette (see `lib/round-draft/colors.ts`).

### `components/data-table.tsx`

A shared, feature-rich table (drag-to-reorder rows via `@dnd-kit`, sorting/filtering/pagination via `@tanstack/react-table`, a row-detail `Drawer`, `rowActions` dropdown) used by the players and rounds list pages. Column config supports a `type: "select"` editable column and `color`/`textSize` display hints. Reuse this component for any new tabular list rather than building a bespoke table.

### Multi-step flows with cross-route state: `lib/round-draft/`

Most pages are single-route and don't need shared state. The cartones-assignment flow (`app/cartones/` → `app/cartones/resumen/`) is the one exception, since it spans two routes and needs to survive navigation between them. The pattern established there:

- `types.ts` — plain domain types for the flow.
- `players.ts` / similarly-named normalizers — convert a route's Spanish-keyed, string-typed mock `data.json` into typed domain objects (see the money-string parsing in `players.ts`, mirroring the manual field mapping already done in `components/player-page.tsx`).
- `storage.ts` — defines a small repository interface (`load`/`save`/`clear`) with a `localStorage`-backed implementation as the only one that exists today. This is the seam for swapping in a real backend later: implement the same interface and pass it into the provider, no consuming component changes.
- `context.tsx` — a `useReducer`-based `XProvider` + `useX()` hook. Hydration from storage happens in a `useEffect` *after* mount (not in the reducer's lazy initializer) to stay SSR-safe, and the "save to storage" effect is gated on a `isHydrated` flag so it never overwrites saved state with the pre-hydration default on mount.

Follow this same shape for any future multi-step/cross-route feature instead of introducing a new state management library.

### Data model notes

Mock `data.json` files often use **Spanish keys and string-typed money fields** (e.g. `"saldo positivo": "130$"`) that don't match the TypeScript domain interfaces 1:1 (e.g. `Player` in `components/player-form.tsx` uses English field names). Field mapping is done manually at the read/write boundary in each page — check the existing mapping in `components/player-page.tsx` / `lib/round-draft/players.ts` before adding a new consumer of that data.
