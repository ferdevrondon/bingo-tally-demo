# Screens Registry

> Maintained by the `ui-project-agent` subagent. Don't hand-edit unless you're seeding the first audit — ask the agent to update it instead so status/history stays consistent.

Last audited: 2026-09-22 (full Audit Mode pass against `app/`, `components/`, `lib/`, `proxy.ts`)

**Status vocabulary used here:** `Done` (works end-to-end for its purpose) · `Partial` (real UI + real interactions, but key data/flow missing) · `Stub` (renders, but content is hardcoded/template and buttons do nothing) · `Broken` (type-errors, or misused props / dead on arrival) · `Missing-but-linked` (nav points at a route that does not exist).

**Persistence note:** per `CLAUDE.md` this is a UI-only prototype — no `app/api/`, no DB. The one exception is Supabase **Auth**, which is really wired (`lib/supabase/*`, `proxy.ts`, `app/auth/callback/route.ts`). The only cross-route app state is `lib/round-draft/` (React context + `localStorage`). Everything else is `React.useState` seeded from a local `data.json` and lost on reload.

## Registry

| ID | Screen Name | Route | User/Role | Purpose | Priority | Status | Entry points | Exit points | Dependencies | Notes/Risks |
|---|---|---|---|---|---|---|---|---|---|---|
| S-01 | Login | `/login` | Guest | Email+password or Google sign-in | MVP | Done | `proxy.ts` redirect from any unauthenticated route; `signOut()` | Supabase redirect → `/`; Google → S-02 | `lib/supabase/actions.ts`, `schemas.ts`, `.env.local` | Real auth. "Sign up" and "Forgot your password?" are `href="#"` dead links — no signup screen exists at all. If env vars are missing, `getUser()` in the proxy throws and *every* route 500s. |
| S-02 | OAuth callback | `/auth/callback` | Guest | Exchanges OAuth code for a session | MVP | Done | Google OAuth redirect | `/` on success, `/login?error=auth_callback_error` on failure | `lib/supabase/server.ts` | Route handler, not a visual screen. `/auth` is correctly exempted in `AUTH_PATHS`. |
| S-03 | Home / Iniciar jornada | `/` | Admin | Landing after login; clock, jornada teaser stats, primary "Iniciar jornada" CTA | MVP | Partial | Post-login redirect; sidebar "Iniciar Jornada" button; breadcrumb back from S-05; `EndJornadaDialog` → "Comenzar nueva jornada" | `router.push("/nueva-jornada")` | `components/main-page-split.tsx` | All numbers are hardcoded constants (`NEXT_SESSION_NUMBER = 42`, 42 jugadores, $1,260, "Racha 7 días"). Does not create a jornada record — the CTA is pure navigation. |
| S-04 | Dashboard | `/dashboard` | Admin | (Intended) operational overview | MVP | Broken | Sidebar "Dashboard" | **none** — dead end | `dashboard/data.json`, `NumberSelectorCard`, `SectionCards`, `ChartAreaInteractive`, `DataTable` | 100% unmodified shadcn template: data.json rows are "Cover page / Table of contents / Eddie Lake"; cards read "Total Revenue $1,250.00 / New Customers"; chart is desktop-vs-mobile demo series. Zero bingo content. TS error: `NumberSelectorCard` requires `onChange`, none passed (`app/(app)/dashboard/page.tsx:13`), and `components/ui/number-selector.tsx` is untyped JS (implicit `any` ×2). |
| S-05 | Nueva jornada — cartones y jugadores | `/nueva-jornada` | Admin | Pick a ronda, add/select jugadores, create cartones, assign numbers, check-in | MVP | Partial | S-03 CTA; S-06 empty-state button; `WinningNumbersCard` link when no round selected | "Empezar ronda" → `router.push("/ronda-activa")`; breadcrumb → `/` (with discard-confirm dialog) | `lib/round-draft/context.tsx` + `storage.ts` (localStorage), `lib/rounds.ts` ← `rounds/data.json`, `lib/round-draft/players.ts` | The most real screen in the app; survives reload via localStorage. But: it does **not** create a jornada entity (no id, date, or record); rondas come from the static `rounds/data.json`, so rondas created on S-09 never appear here. Has its own nested layout with a step breadcrumb, implying a multi-step wizard that has only one step. |
| S-06 | Ronda activa | `/ronda-activa` | Admin | Run the live round: open numbers, player cards, award prizes per slot, close round, end jornada | MVP | Partial | Sidebar "Ronda activa"; S-05 "Empezar ronda" | M-01 close round (stays on page, next ronda); M-02 end jornada → `/` or `/reports`; empty state → S-05 | `lib/round-draft/context.tsx`, `selectors.ts`, `confetti.ts` | Genuinely interactive (awarding a number updates balances + activity log). Guarded by `hasDraftProgress` — lands on an empty state if you arrive cold. Heading "Jornada #42 / Monday, Sept 7" is hardcoded in `page-heading.tsx`. Embedded `RoundHistoryCard` is hardcoded mock data, not the rounds you just played. |
| S-07 | Jornadas (sessions) | `/sessions` | Admin | List active + past jornadas with totals | MVP | Stub | Sidebar "Jornadas" | **none** — dead end | none (array literal inside `components/session-page.tsx`) | Three hardcoded jornadas (#42/#41/#40). "Iniciar jornada" button and every row's arrow are `console.log()` only. Nothing produced by S-05/S-06 ever lands here — the jornada you just ran is invisible. |
| S-08 | Jugadores | `/players` | Admin | CRUD-ish list of players | Post-MVP | Partial | Sidebar "Jugadores" | **none** — dead end | `players/data.json`, `DataTable`, `PlayerForm` (M-07) | Add works in local state only. Row actions Editar / Duplicar / Eliminar are all `console.log()` — no edit, no delete. Shares `players/data.json` with the draft flow via `lib/round-draft/players.ts`, but edits here don't reach the draft. |
| S-09 | Rondas | `/rounds` | Admin | Configure rondas (name, winning-number count, prizes) | MVP | Partial | Sidebar "Rondas" | **none** — dead end | `rounds/data.json`, `DataTable`, `RoundForm` (M-08) | "Crear ronda" adds to local `useState` only. `lib/rounds.ts` reads the raw JSON file, so S-05's ronda picker never sees a newly created ronda — this is the break between "configure rondas" and "use rondas". |
| S-10 | Historial / Reportes | `/reports` | Admin | Post-jornada report of rounds and results | MVP | Stub | Sidebar "Historial"; M-02 "Ver reporte del día" | **none** — dead end | `components/round-history-card.tsx` | Renders the same hardcoded 3-round mock as S-06 (Juan Pérez / María López / Carlos Ruiz). Not fed by `round-draft` state, so the "Ver reporte del día" link after ending a jornada shows fiction. |
| S-11 | Settings | `/settings` | Admin | User + casa (house) settings | Post-MVP | Broken | Sidebar "Settings" (nav-secondary) | **none** — dead end | `settings/data.json`, `UserInfo`, `HouseInfo` | TS error at `app/(app)/settings/page.tsx:16` — page passes `casa` / `account` / `onSaveCasa` to `SettingsPage`, which accepts **no props**. `settings/data.json` is therefore read and silently discarded; the form fields are uncontrolled placeholders ("Dairy Dalmonte") and save nothing. |
| S-12 | Account settings (shadcn block) | `/account-settings-01` | Admin | Personal info + email/password block | Nice-to-have | Stub / **orphan** | URL only — nothing links here | none | `components/shadcn-studio/blocks/account-settings-01/*` | Orphan route, vendor demo block, English-only, overlaps S-11. The page declares a `tabs` array it never renders. Also note `danger-zone.tsx`, `social-url.tsx`, `connect-account.tsx` exist but are not rendered anywhere. |
| S-13 | Main page — hero variant | `/main-hero` | Admin | Design variant of S-03 | Nice-to-have | Stub / **orphan** | URL only | none | `components/main-page-hero.tsx` | Design scratch route. Should be deleted or moved behind a flag before ship. |
| S-14 | Main page — split variant | `/main-split` | Admin | Design variant of S-03 (the one actually used at `/`) | Nice-to-have | Stub / **orphan** | URL only | `router.push("/nueva-jornada")` | `components/main-page-split.tsx` | Duplicate of S-03; same component. Two URLs for one screen. |
| S-15 | Números | `/numbers` | Admin | — | Unclassified | **Missing-but-linked** | Sidebar "Numeros" | — | — | `components/app-sidebar.tsx` links `/numbers`; **no `app/(app)/numbers/` exists** → clicking it 404s. |
| S-16 | Cartones | (none — `url: "#"`) | Admin | — | Unclassified | **Missing** | Sidebar "Cartones" | — | — | Sidebar item exists with `url: "#"`. `CLAUDE.md` documents an `app/cartones/` → `app/cartones/resumen/` two-step flow that **does not exist in the repo** — it was renamed to `/nueva-jornada` and the `resumen` (confirm/summary) step was never built. Docs are stale. |
| M-01 | Cerrar ronda dialog | modal (S-06) | Admin | Pick the next ronda, close the current one, fire confetti | MVP | Done | `WinningNumbersCard` once every prize slot is filled | closes → S-06 with new ronda | `getBaseRounds()`, `closeRound` | Only offers rondas from `rounds/data.json`; with 2 seeded rondas you can alternate but never add a third mid-jornada. |
| M-02 | Terminar jornada dialog | modal (S-06) | Admin | Jornada summary (rounds played, house balance, players, duration) | MVP | Partial | `PageHeadingWithActions` → "Terminar jornada" | "Comenzar nueva jornada" → `/` (resets draft); "Ver reporte del día" → S-10 | `getJornadaSummary` | Summary numbers are real (from draft state) — but ending the jornada **discards** them: `resetDraft()` clears localStorage and nothing is written to S-07 or S-10. This is where the MVP loses its result. |
| M-03 | Editar números del jugador | modal (S-05/S-06) | Admin | Assign / change a player's numbers | MVP | Done | `AddPlayerControl`, `PlayerActiveCard` | closes | `round-draft` context | |
| M-04 | Recarga de jugador | modal (S-06) | Admin | Record a top-up | MVP | Done | `PlayerActiveCard` | closes | `round-draft` context | |
| M-05 | Liberar números | modal (S-06) | Admin | Release a player's numbers back to the pool | MVP | Done | `PlayerActiveCard` | closes | `round-draft` context | |
| M-06 | Rondas del jugador | modal (S-06) | Admin | Per-player round history | Post-MVP | Stub | `PlayerActiveCard` | closes | — | `mockRounds` hardcoded inside `player-rounds-dialog.tsx`; ignores actual draft state. |
| M-07 | Nuevo jugador form | modal (S-05/S-06/S-08) | Admin | Create a player | MVP | Done | 3 call sites | closes | `components/player-form.tsx` | Writes to draft state (S-05/S-06) or local list (S-08) — two different destinations from the same form. |
| M-08 | Nueva ronda form | modal (S-09) | Admin | Create a ronda | MVP | Partial | S-09 "Crear ronda" | closes | `components/round-form.tsx` | Result is local-only; see S-09. |
| M-09 | Descartar borrador confirm | modal (S-05) | Admin | Confirm leaving the assignment flow | MVP | Done | Breadcrumb "Iniciar jornada" | → `/` | `hasDraftProgress` | |
| M-10 | Retirar jugador confirm | modal (S-06) | Admin | Confirm removing a player mid-round | MVP | Done | `PlayerActiveCard` | closes | `round-draft` context | |

## Flow Map

**Guest**
`[S-01 Login]` → (password) → `/` · (Google) → `[S-02 /auth/callback]` → `/`
Auth gating is real: `proxy.ts` (Next 16's renamed middleware) matches every non-static path and redirects unauthenticated users to `/login`, and logged-in users off `/login` and `/auth` back to `/`. There is **no sign-up and no password-reset screen** — both links are `href="#"`.

**Admin — happy path as actually wired in code**
`[S-03 /]` → "Iniciar jornada" → `[S-05 /nueva-jornada]` → "Empezar ronda" → `[S-06 /ronda-activa]` → `[M-01 Cerrar ronda]` (loops back into S-06 with the next ronda) → `[M-02 Terminar jornada]` → `/` **or** `[S-10 /reports]`

**Admin — sidebar (flat, no hierarchy)**
`Iniciar Jornada → /` · `Ronda activa → /ronda-activa` · `Rondas → /rounds` · `Dashboard → /dashboard` · `Jornadas → /sessions` · `Jugadores → /players` · `Cartones → #` · `Numeros → /numbers` · `Historial → /reports` · `Settings → /settings` · NavUser → Account / Billing / Notifications (all no-ops) + Log out (real).

### Dead ends (screen has entry, no exit link at all)
S-04 `/dashboard`, S-07 `/sessions`, S-08 `/players`, S-09 `/rounds`, S-10 `/reports`, S-11 `/settings`. Every one of these is reachable only from the sidebar and offers no forward navigation — the sidebar is the sole way back into the flow.

### Orphans (reachable by URL, linked from nowhere)
S-12 `/account-settings-01`, S-13 `/main-hero`, S-14 `/main-split`.

### Broken / missing links
- Sidebar "Numeros" → `/numbers` — **route does not exist (404)**.
- Sidebar "Cartones" → `"#"` — placeholder, no destination.
- Sidebar logo → `href="#"`.
- S-01: "Sign up", "Forgot your password?", "Terms of Service", "Privacy Policy" → all `href="#"`.
- NavUser dropdown: Account / Billing / Notifications have no `onClick` and no href.
- `CLAUDE.md` documents `app/cartones/` and `app/cartones/resumen/`; neither exists. The `resumen` (pre-round summary/confirm) step is **not built**.

### Data-flow breaks (links that exist but carry no data)
- S-09 `/rounds` → S-05 ronda picker: S-05 reads `rounds/data.json` off disk via `lib/rounds.ts`, so rondas created on S-09 are invisible to the flow.
- S-08 `/players` → S-05 player picker: same break, via `lib/round-draft/players.ts`.
- S-06 / M-02 → S-07 `/sessions` and S-10 `/reports`: the finished jornada is never recorded; `resetDraft()` wipes it. S-07 and S-10 show hardcoded fiction.

## MVP Critical Path

Confirmed with the user (2026-09-22). Single role: **Admin**.

`[S-01 Login] -> [S-04 Dashboard] -> [S-05 Nueva jornada]` (create jornada + configure rondas + assign cartones) `-> [S-06 Ronda activa]` (call numbers, mark winner) `-> [S-07 Jornadas]` (history / result recorded)

Supporting screens that the path depends on and are therefore also MVP: S-02 (OAuth callback), S-03 (`/` — the actual post-login landing and the only route that links into S-05), S-09 (`/rounds`, where rondas are configured), M-01, M-02, M-03, M-07, M-08.

## MVP Readiness Verdict

**1. Verdict: NOT READY.** Three of the five hops are incomplete, and the path breaks completely at the last one: a finished jornada is deleted rather than recorded.

**2. What's done**
- **S-01 Login — Done.** Real Supabase auth, email/password + Google OAuth, zod validation, inline errors. Auth *does* gate: `proxy.ts` matches every non-static route and bounces unauthenticated users to `/login`. (The hypothesis that auth isn't gating is wrong — it is.)
- **S-05 → S-06 hand-off — Done.** `lib/round-draft/` (context + localStorage) carries cartones, players, active ronda and activity across the route change and survives a reload. This is the one piece of cross-route persistence and it works.
- **Marking a winner — Done.** `WinningNumbersCard` → `awardPrize(slot, number)` updates player balances, house balance and the activity log; M-01 closes the ronda and starts the next one.
- Supporting modals M-03, M-04, M-05, M-07, M-09, M-10 all work against real draft state.

**3. What's missing, hop by hop**

| Hop | Status | What specifically blocks it |
|---|---|---|
| S-01 Login | **Done** | Only soft gaps: no sign-up screen and no password reset (both `href="#"`), so a new admin can only be created in the Supabase console. Hard dependency: if `NEXT_PUBLIC_SUPABASE_*` are unset, `proxy.ts` throws on every request and the whole app 500s. |
| S-04 Dashboard | **Broken** | It is the untouched shadcn starter dashboard — "Cover page / Table of contents / Eddie Lake" table rows, "Total Revenue $1,250.00", a desktop-vs-mobile demo chart. No bingo data. It has **no exit link**, so it cannot forward the admin to S-05 — the real entry to the flow is `/` (S-03), not `/dashboard`. Also type-errors: `NumberSelectorCard` requires `onChange` and isn't given one, and the component itself is untyped JS. |
| S-05 Nueva jornada | **Partial** | (a) No jornada is actually created — no id, date or record; "Jornada #42" is a hardcoded string in `page-heading.tsx` and `main-page-split.tsx`. (b) Rondas are **not** configured here; they're picked from the static `rounds/data.json`, and rondas created on S-09 never reach it (S-09 mutates React state only). (c) The `resumen`/confirm step that `CLAUDE.md` describes at `app/cartones/resumen/` **does not exist** — the nested layout renders a breadcrumb for a two-step wizard with only one step. |
| S-06 Ronda activa | **Partial** | Running the round and marking winners works. But the embedded `RoundHistoryCard` is hardcoded mock data (Juan Pérez / María López / Carlos Ruiz), so the rounds you just played never appear; M-06 per-player history is likewise mock. Arriving at `/ronda-activa` without a draft shows an empty state — correct behaviour, but it means the sidebar link is a dead end most of the time. |
| S-07 Jornadas (result recorded) | **Stub — this is the fatal break** | The list is a hardcoded array literal inside `components/session-page.tsx` (#42/#41/#40). Nothing from S-05/S-06 is ever written to it. Worse, **M-02 "Terminar jornada" calls `resetDraft()`, which clears localStorage and destroys the jornada** — the summary is shown once in a dialog and then deleted forever. Both buttons on S-07 ("Iniciar jornada", per-row arrow) are `console.log()` only, and the screen has no exit link. |

**4. Flow integrity**
The path is broken in two places and detoured in a third:
- **Detour:** S-01 lands on `/` (S-03), not `/dashboard` — and `/dashboard` has no link to S-05, so the confirmed path can only be walked via the sidebar. The only in-page link into S-05 is S-03's "Iniciar jornada" CTA.
- **Break 1 (data):** S-09 → S-05. Configuring a ronda and using a ronda are two disconnected systems.
- **Break 2 (terminal, worst):** S-06/M-02 → S-07. The jornada result is never persisted anywhere; it is explicitly deleted. The MVP's final hop currently cannot be completed at all.

**5. Recommendation — ordered blockers**
1. **Persist the finished jornada.** On M-02 confirm, write the `getJornadaSummary()` result + closed rounds into a jornada store *before* `resetDraft()`, and have S-07 `/sessions` read from it. This is the single change that turns the path from impossible into walkable. Extend the existing `lib/round-draft/storage.ts` repository pattern (a `jornadas` key) rather than inventing new state machinery.
2. **Connect S-09 → S-05.** Move rondas out of `rounds/data.json`-read-at-import into the same repository seam so a ronda created on `/rounds` is selectable in `/nueva-jornada` and in M-01.
3. **Decide S-04's fate.** Either rebuild `/dashboard` with bingo data and a "Iniciar jornada" CTA into S-05, or drop it from the critical path and make `/` (S-03) the canonical post-login home. Right now it is template debris sitting on the MVP path.
4. **Make S-06's history real.** Point `RoundHistoryCard` (used by both S-06 and S-10 `/reports`) at draft/jornada state instead of its mock array — otherwise "Ver reporte del día" after ending a jornada shows other people's games.
5. **Fix the 4 type errors** (`dashboard/page.tsx:13`, `settings/page.tsx:16`, `data-table.tsx:414`, `ui/number-selector.tsx`) — `npm run typecheck` currently fails, so CI can't gate anything.
6. **Clean the nav:** create or remove `/numbers` (currently 404s from the sidebar), give "Cartones" a destination or delete it, and delete the orphan routes `/main-hero`, `/main-split`, `/account-settings-01`.
7. **Update `CLAUDE.md`** — it documents an `app/cartones/` + `app/cartones/resumen/` flow that no longer exists.
