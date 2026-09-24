# Screens Registry

> Maintained by the `ui-project-agent` subagent. Don't hand-edit unless you're seeding the first audit — ask the agent to update it instead so status/history stays consistent.

Last audited: 2026-09-23 (full Audit Mode pass against `app/`, `components/`, `lib/`, `proxy.ts` on branch `chore/prepare-backend-phase-1`; `npm run typecheck` clean, `npm run lint` 0 errors / 17 unused-var warnings)

**Status vocabulary used here:** `Done` (works end-to-end for its purpose) · `Partial` (real UI + real interactions, but key data/flow missing) · `Stub` (renders, but content is hardcoded/template and buttons do nothing) · `Broken` (type-errors, or misused props / dead on arrival) · `Missing-but-linked` (nav points at a route that does not exist) · `Not started` (used only in the Planned section: specified in `BACKEND_PLAN.md`, no code yet).

**Persistence note:** this is still a UI-only prototype. There is no `app/api/` and no DB. The one exception is Supabase **Auth**, which is really wired (`lib/supabase/*`, `proxy.ts`, `app/auth/callback/route.ts`). The only cross-route app state is `lib/round-draft/` (React context + `localStorage` key `bingo:round-draft:v1`, provider mounted in the root `app/layout.tsx`). Everything else is `React.useState` seeded from a local `data.json` or an inline array literal, and it is lost on reload.

**Route layout:** `app/(auth)/` holds `/login` (bare layout). `app/(app)/` holds every signed-in screen; its layout fetches the user and renders `AppSidebar` + `SiteHeader`. `app/(app)/__themecheck__/` is an empty design-tool folder and is excluded from this registry.

## Registry

| ID | Screen Name | Route | User/Role | Purpose | Priority | Status | Entry points | Exit points | Dependencies | Notes/Risks |
|---|---|---|---|---|---|---|---|---|---|---|
| S-01 | Login | `/login` | Guest | Email+password or Google sign-in | MVP | Done | `proxy.ts` redirect from any unauthenticated route; `signOut()` → `/login`; `/auth/callback` and `signInWithGoogle` failures → `/login?error=…` | Password success → `redirect("/")`; Google → S-02 | `lib/supabase/actions.ts`, `schemas.ts`, `.env.local`, `@/fonts` | Real auth with zod validation and inline field/form errors. **Silent failure:** `/login?error=auth_callback_error` and `/login?error=oauth_error` are redirect targets, but neither `app/(auth)/login/page.tsx` nor `login-form.tsx` reads `searchParams`, so a failed Google login lands back on the form with no message. "Sign up", "Forgot your password?", "Terms of Service", "Privacy Policy" are all `href="#"`. UI copy is mixed English/Spanish ("Welcome back" / "Comienza la jornada de hoy!"). If `NEXT_PUBLIC_SUPABASE_*` are unset, `getUser()` in the proxy throws and every route 500s. |
| S-02 | OAuth callback | `/auth/callback` | Guest | Exchanges the OAuth code for a session | MVP | Done | Google OAuth redirect (`redirectTo: ${origin}/auth/callback`) | `?next` or `/` on success; `/login?error=auth_callback_error` on failure | `lib/supabase/server.ts` | Route handler, not a visual screen. `/auth` is correctly exempted in `AUTH_PATHS`. Error target is never displayed (see S-01). |
| S-03 | Home / Iniciar jornada | `/` | Admin | Post-login landing: live clock, greeting, jornada teaser stats, primary "Iniciar jornada" CTA | MVP | Partial | Post-login redirect; sidebar "Iniciar Jornada"; S-05 breadcrumb (via M-09); M-02 "Comenzar nueva jornada" | CTA `router.push("/new-game")` → S-05 | `components/main-page-split.tsx` | Clock is real. Everything else is hardcoded: `NEXT_GAME_NUMBER = 42`, "42 jugadores confirmados", "Bolsa $1,260", "Racha 7 días", "Última jornada #041". The CTA only navigates; it creates no jornada record. Now the canonical post-login home (replaces the deleted S-04). `SiteHeader` renders an empty title here (`pathname.slice(1)` of `/` is `""`). |
| S-05 | Nueva jornada — cartones y jugadores | `/new-game` | Admin | Pick the ronda, add/select jugadores, create cartones, assign numbers, check-in | MVP | Partial | S-03 CTA; S-06 empty-state button "Ir a cartones y jugadores"; `WinningNumbersCard` "Nueva jornada" link when no ronda is selected | "Empezar ronda" → `router.push("/active-round")`; breadcrumb "Iniciar jornada" → `/` (through M-09 when there is progress) | `lib/round-draft/*` (context + localStorage), `lib/rounds.ts` ← `rounds/data.json`, `lib/round-draft/players.ts` ← `players/data.json`, `prize-rules.ts` | The most real screen; survives reload. Gaps: (a) no jornada entity is created (no id/date/record); (b) the ronda picker reads the static `rounds/data.json` filtered by the required kind (odd = regular, even = especial), so rondas created on S-09 never appear; (c) "Empezar ronda" is never disabled, so you can reach S-06 with no ronda selected (S-06 then shows the "Selecciona una ronda" link back); (d) the nested layout's breadcrumb implies a multi-step wizard that has one step. |
| S-06 | Ronda activa | `/active-round` | Admin | Run the live round: open numbers, player cards, award prizes per slot, close round, end jornada | MVP | Partial | Sidebar "Ronda activa"; S-05 "Empezar ronda" | M-01 (stays on S-06 with next ronda); M-02 → `/` or S-10; empty state → S-05 | `lib/round-draft/context.tsx`, `selectors.ts`, `prize-rules.ts`, `lib/confetti.ts` | Genuinely interactive: awarding a number updates balances, house balance and the activity log. Guarded by `hasDraftProgress`; arriving cold shows an empty state with a link to S-05 (so the sidebar link is a soft dead end most of the time). Heading "Jornada #42 / Monday, Sept 7" is hardcoded in `page-heading.tsx`. The embedded `RoundHistoryCard` is a hardcoded mock filtered to today (always shows "Ronda 1 · Juan Pérez · #6"), not the rondas you just played. |
| S-07 | Jornadas (list) | `/games` | Admin | List the active jornada and past jornadas with totals | MVP | Stub / **orphan** | **none** — sidebar "Jornadas" entry is commented out in `components/app-sidebar.tsx`; nothing else links `/games` | Row arrow → `/games/{id}` (S-17) | `components/game-page.tsx` (exports the inline `games` array literal, #42/#41/#40) | Hardcoded array; nothing from S-05/S-06 ever lands here. "Iniciar jornada" button is `console.log("iniciar jornada")`. The same `GamePage` component is rendered as the "Jornadas" tab of S-10, which is the only way a user actually sees this list, so `/games` is a duplicate route with no entry. Finished rows are labelled "Teminada." (typo). |
| S-08 | Jugadores | `/players` | Admin | List players and add new ones | Post-MVP | Partial | Sidebar "Jugadores" | **none** — dead end | `players/data.json`, `DataTable`, M-07 | Add works in local state only. Row actions Editar / Duplicar / Eliminar are `console.log()`. Shares `players/data.json` with the draft flow via `lib/round-draft/players.ts`, but players added here never reach S-05. |
| S-09 | Rondas | `/rounds` | Admin | Configure rondas (name, kind, winning-number count, prizes) | MVP | Partial | Sidebar "Rondas" | **none** — dead end | `rounds/data.json`, `DataTable`, M-08 | "Crear ronda" adds to local `useState` only. `lib/rounds.ts` reads the raw JSON at import, so S-05's picker and M-01 never see a newly created ronda. This is still the break between "configure rondas" and "use rondas". |
| S-10 | Reportes | `/reports` | Admin | Post-jornada reporting: jornadas list, rondas by date, plus placeholder tabs | MVP | Stub | Sidebar "Reportes"; M-02 "Ver reporte del día"; S-17 "Volver" / "Volver a jornadas" | "Jornadas" tab row arrow → S-17 | `components/tabs-solid.tsx`, `game-page.tsx`, `round-history-card.tsx`, `rounds-date-filter.tsx` | Five tabs. "Jornadas" = the S-07 `GamePage` (hardcoded). "Rondas" = `RoundHistoryCard` with a working date filter over a hardcoded 3-entry mock (today / yesterday / 2 days ago). "Deudas", "Mensual", "Diario" render a "Sección … en construcción" placeholder. Not fed by `round-draft` state, so "Ver reporte del día" after M-02 shows mock data. |
| S-11 | Settings | `/settings` | Admin | User info + casa (house) info | Post-MVP | Stub | Sidebar "Settings" (nav-secondary) | **none** — dead end | `components/settings-page.tsx`, `user-info.tsx`, `house-info.tsx` | Type error from the last audit is fixed; the page now renders `<SettingsPage />` with no props and `settings/data.json` is gone. But both forms are `<form>` elements with no `onSubmit`/`action` and inputs with no `name`, so their submit buttons do a native form submit (page reload) and save nothing. Fields are placeholders ("Dairy Dalmonte", "E D Bingo", "EDB"). Only the house-logo file picker has local preview state. |
| S-17 | Detalle de jornada | `/games/[id]` | Admin | One jornada's result: rondas, jugadores, house ganancia, per-player cards | MVP | Stub | S-07 / S-10 "Jornadas" tab row arrow | "Volver" → `/reports` (S-10); per-player chevron → M-11; not-found state "Volver a jornadas" → `/reports` | `components/game-detail-page.tsx` (inline `gameEntries` keyed by 40/41/42), `games` from `game-page.tsx`, M-11 | New since the last audit. All data is inline mock. Stat cards and player cards disagree (#42 claims 18 jugadores but lists 4 player cards; ganancia is computed from the 6 mock entries). **Back-link mismatch:** both "Volver" and "Volver a jornadas" go to `/reports`, not `/games`. The label says "jornadas" and the list does live in S-10's tab, but anyone arriving from S-07 is sent somewhere else. Non-numeric ids render "No se encontró la jornada #NaN". The "Activa" jornada has no link to S-06. |
| M-01 | Cerrar ronda dialog | modal (S-06) | Admin | Pick the next ronda (kind forced by parity), close the current one, fire confetti | MVP | Done | `WinningNumbersCard` once every prize slot is filled | Closes → S-06 with the new ronda | `getBaseRounds()`, `prize-rules.ts`, `closeRound` | Only offers rondas from `rounds/data.json`. With the 2 seeded rondas (1 Regular, 1 Especial) the alternation works. Shows "No hay otra ronda configurada. Agrega una ronda en Rondas." otherwise, but rondas added on S-09 won't show up here anyway (S-09 break). |
| M-02 | Terminar jornada dialog | modal (S-06) | Admin | Jornada summary: rondas jugadas, house money, active players, duration, total negative balance | MVP | Partial | `PageHeadingWithActions` "Terminar jornada" | "Comenzar nueva jornada" → `resetDraft()` + `/`; "Ver reporte del día" → S-10 | `getGameSummary` | Summary numbers are real (from draft state), but ending the jornada **discards** them: `resetDraft()` clears localStorage and nothing is written to S-07, S-10 or S-17. "Ver reporte del día" leaves without resetting, so the draft stays live while S-10 shows mock data. **This is still where the MVP loses its result.** |
| M-03 | Editar números del jugador | modal (S-05/S-06) | Admin | Assign / change a player's numbers | MVP | Done | `AddPlayerControl`, `PlayerActiveCard` | Closes | `round-draft` (`setNumberOwner`, `toggleGift`, `logActivity`) | |
| M-04 | Recarga de jugador | modal (S-06) | Admin | Record a top-up | MVP | Done | `PlayerActiveCard` | Closes | `round-draft` (`rechargeBalance`) | |
| M-05 | Liberar números | modal (S-06) | Admin | Release a player's carried-over numbers back to the pool | MVP | Done | `PlayerActiveCard` | Closes | `round-draft` (`resolveCarryOver`) | |
| M-06 | Rondas del jugador (live) | modal (S-06) | Admin | Per-player round history during the live jornada | Post-MVP | Stub | `PlayerActiveCard` | Closes | — | `mockRounds` hardcoded inside `player-rounds-dialog.tsx`; ignores draft state. |
| M-07 | Nuevo jugador form | modal (S-05/S-06/S-08) | Admin | Create a player | MVP | Done | S-05 "Agregar jugador", S-06 `AddPlayerControl`, S-08 "Agregar jugador" | Closes | `components/player-form.tsx` | Writes to draft state (S-05/S-06) or to S-08's local list, two different destinations from the same form. |
| M-08 | Nueva ronda form | modal (S-09) | Admin | Create a ronda | MVP | Partial | S-09 "Crear ronda" | Closes | `components/round-form.tsx` | Result is local-only; see S-09. |
| M-09 | Descartar borrador confirm | modal (S-05 layout) | Admin | Confirm leaving the assignment flow and wiping the draft | MVP | Done | Breadcrumb "Iniciar jornada" when `hasDraftProgress` | "Salir y borrar" → `resetDraft()` + `/`; "Cancelar" closes | `hasDraftProgress` | |
| M-10 | Retirar jugador confirm | modal (S-06) | Admin | Confirm removing a player mid-round | MVP | Done | `PlayerActiveCard` | Closes | `round-draft` (`removePlayer`) | |
| M-11 | Rondas del jugador (jornada) | modal (S-17) | Admin | One player's rondas within a finished jornada: numbers played, gift, prize, recharge, cost | Post-MVP | Partial | S-17 player-card chevron | Closes | `components/game-player-rounds-dialog.tsx` | New since the last audit. Unlike M-06, it is data-driven through props, but S-17 only feeds it inline mock entries. It becomes real as soon as S-17 has real data. |

### Retired since the 2026-09-22 audit

| Old ID | Was | Why it's gone |
|---|---|---|
| S-04 | Dashboard `/dashboard` | Route and its template components (`chart-area-interactive`, `section-cards`, `ui/number-selector`) deleted. It was the second hop of the recorded MVP path; S-03 `/` now takes that slot (see MVP Critical Path). |
| S-12 | Account settings `/account-settings-01` | Route and `components/shadcn-studio/` deleted. |
| S-13 | Main page hero variant `/main-hero` | Route and `main-page-hero` deleted. |
| S-14 | Main page split variant `/main-split` | Route deleted (`main-page-split` kept; it powers S-03). |
| S-15 | Números `/numbers` (Missing-but-linked) | Sidebar entry removed, so it no longer 404s from the nav. |
| S-16 | Cartones (`url: "#"`) | Sidebar entry commented out. |

## Planned (BACKEND_PLAN.md)

Specified in `BACKEND_PLAN.md` but with no code yet. Not counted in the Progress Snapshot. Priorities follow the recorded MVP path (single Admin role, run and record one jornada); M-12 is MVP because the single admin session is a non-negotiable rule; the rest are off that path.

| ID | Screen Name | Route | User/Role | Purpose | Priority | Status | Entry points | Exit points | Dependencies | Notes/Risks |
|---|---|---|---|---|---|---|---|---|---|---|
| S-18 | Liquidación (settlement) | `/games/[id]/settlement` | Admin (Observer read-only) | List every player in an ended jornada with their balance; "Registrar pago" per row (amount, payment method, note) | Post-MVP | Not started | Planned from M-02 and from S-17 | Back to S-17 (implied) | `record_payout` RPC, `game_session_players`, `components/settlement-page.tsx` (planned), Phase 4 | BACKEND_PLAN §5b. Needs a real, persisted ended jornada, so it is blocked behind the same M-02 → S-07/S-17 persistence break as the MVP. |
| M-12 | "Otro dispositivo" takeover dialog | modal on `/login` (also `/login?confirm=takeover` after Google) | Admin | "Esta cuenta ya está abierta en otro dispositivo. ¿Quieres mantener la sesión aquí o cerrarla y seguir en el otro dispositivo?" with "Mantener sesión aquí" / "Seguir en el otro dispositivo" | MVP | Not started | S-01 password submit returning `other_active`; S-02 redirect to `/login?confirm=takeover` | "Mantener sesión aquí" → claim session, other device kicked → app; "Seguir en el otro dispositivo" → local sign-out, stay on S-01 | `admin_session_status()`, `claim_admin_session()`, `signInWithPassword` returning state instead of `redirect("/")`, Phase 2 | BACKEND_PLAN §2. Single admin session is a non-negotiable business rule (BACKEND_PLAN rule 5); user confirmed the keep-here / continue-on-other-device choice on 2026-09-23, so it is MVP. |
| M-13 | Sesión reemplazada notice | `/login?reason=replaced` (state of S-01) | Admin | "Tu sesión se cerró porque se inició sesión en otro dispositivo." | Post-MVP | Not started | Realtime kick on `admin_auth_sessions`; `(app)/layout.tsx` fallback; any `not_admin` write failure | S-01 | Phase 2 | S-01 currently reads no query params at all (see its `?error=` gap), so this needs the same `searchParams` handling. |
| X-01 | "Solo lectura" observer mode | cross-cutting (S-06, S-08, S-09, S-17, S-18) | Observer | Observers see everything live but with action buttons hidden and a "Solo lectura" badge | Post-MVP | Not started | Any route, signed in as a `house_members.role = 'observer'` | n/a | `useRole()` context from `(app)/layout.tsx`, Realtime `activity_log` subscription, Phase 5 | Not a screen but a mode applied across screens. Introduces the Observer role, which the recorded MVP path does not have. |

## Flow Map

**Guest**
`[S-01 Login]` → (password) → `/` [S-03] · (Google) → `[S-02 /auth/callback]` → `/` [S-03]
Auth gating is real: `proxy.ts` matches every non-static path, redirects unauthenticated users to `/login`, and redirects signed-in users away from `/login` and `/auth` to `/`. There is **no sign-up and no password-reset screen** (both links `href="#"`). OAuth failures return to S-01 with an `?error=` param that is never displayed.

**Admin — happy path as actually wired in code**
`[S-03 /]` → "Iniciar jornada" → `[S-05 /new-game]` → "Empezar ronda" → `[S-06 /active-round]` → `[M-01 Cerrar ronda]` (loops back into S-06 with the next ronda) → `[M-02 Terminar jornada]` → `/` [S-03] **or** `[S-10 /reports]` → "Jornadas" tab → `[S-17 /games/[id]]` → "Volver" → `[S-10]`
The code path is walkable end to end, but from M-02 onward it shows **mock data**. The jornada you just ran is never written anywhere (see Data-flow breaks).

**Admin — sidebar (flat)**
Header logo → `#` · `Iniciar Jornada → /` · `Ronda activa → /active-round` · `Rondas → /rounds` · `Jugadores → /players` · `Reportes → /reports` · `Settings → /settings` (nav-secondary) · NavUser → "Account" (no handler) + "Log out" (real, → `/login`).
Commented out: `Jornadas → /games`, `Cartones → #`. Unused data arrays `navClouds` and `documents` are still defined in `app-sidebar.tsx`.

**Chrome note:** `SiteHeader` prints the raw path uppercased, so page titles read "NEW-GAME", "ACTIVE-ROUND", "GAMES/42" (English slugs in a Spanish UI), and `/` has no title.

### Dead ends (screen has entry, no exit link other than the sidebar)
S-08 `/players`, S-09 `/rounds`, S-11 `/settings`. S-06 reached cold from the sidebar is a soft dead end (empty state, only exit is to S-05).
*Fixed since last audit:* S-10 `/reports` now exits to S-17. S-07 `/games` now exits to S-17. S-04 is gone.

### Orphans (reachable by URL, linked from nowhere)
S-07 `/games`. Its sidebar entry is commented out, S-17's back links go to `/reports`, and its content is duplicated as S-10's "Jornadas" tab.
*Fixed since last audit:* S-12, S-13, S-14 deleted.

### Broken / missing links
- S-07 "Iniciar jornada" → `console.log`. It should route to `/` or `/new-game`.
- S-17 "Volver" and not-found "Volver a jornadas" → `/reports`, not `/games`.
- S-01 never renders `?error=auth_callback_error` / `?error=oauth_error`.
- S-01 "Sign up", "Forgot your password?", "Terms of Service", "Privacy Policy" → `href="#"`.
- Sidebar header logo → `href="#"`.
- NavUser "Account" → no `onClick`, no href.
- S-08 row actions Editar / Duplicar / Eliminar → `console.log`.
- S-11 "submit" buttons → native form submit with no handler (reloads, saves nothing).
- S-10 tabs "Deudas", "Mensual", "Diario" → "en construcción" placeholders.
- `/games/<non-number>` → "No se encontró la jornada #NaN". There are no custom `not-found.tsx` / `error.tsx` pages anywhere in `app/`.
*Fixed since last audit:* `/numbers` 404 (link removed), Cartones `#` (commented out), `CLAUDE.md` route docs (now describe `/new-game` → `/active-round`), all 4 type errors.

### Data-flow breaks (links that exist but carry no data)
- S-09 `/rounds` → S-05 ronda picker and M-01: both read `rounds/data.json` via `lib/rounds.ts`, so rondas created on S-09 are invisible to the flow.
- S-08 `/players` → S-05 player picker: same break, via `lib/round-draft/players.ts`.
- S-06 / M-02 → S-07, S-10, S-17: the finished jornada is never recorded. `resetDraft()` wipes it, and all three screens show hardcoded jornadas #40–#42.
- S-06 embedded `RoundHistoryCard` and M-06: mock history, not the draft's closed rondas.
- S-03 teaser stats and S-06 heading ("Jornada #42"): hardcoded, not derived from any jornada record.

## MVP Critical Path

Confirmed with the user on 2026-09-22. Single role: **Admin**. Updated 2026-09-23 because S-04 `/dashboard` was deleted: its hop is now taken by S-03 `/`, which was already the real post-login landing and the only in-page link into S-05. *(Agent substitution. Flag if you intended a different home screen.)*

`[S-01 Login] -> [S-03 Home /]` (start) `-> [S-05 Nueva jornada /new-game]` (create jornada + pick rondas + assign cartones) `-> [S-06 Ronda activa /active-round]` (call numbers, mark winner) `-> [M-02 Terminar jornada] -> [S-07 Jornadas list, rendered in S-10 /reports] -> [S-17 Detalle de jornada]` (history / result recorded)

Supporting screens that the path depends on and are therefore also MVP: S-02, S-09, S-10, M-01, M-03, M-04, M-05, M-07, M-08, M-09, M-10. S-17 is classified MVP as the result view of the terminal "result recorded" hop (new classification by the same logic).

## Progress Snapshot

- **Total built items:** 22 (11 screens + 11 modals). Plus 4 planned (Not started), 6 retired.
- **By status:** Done 9 · Partial 8 · Stub 5 · Broken 0 · Missing-but-linked 0 · (Planned: Not started 4)
  - Done: S-01, S-02, M-01, M-03, M-04, M-05, M-07, M-09, M-10
  - Partial: S-03, S-05, S-06, S-08, S-09, M-02, M-08, M-11
  - Stub: S-07, S-10, S-11, S-17, M-06
- **By priority:** MVP 18 · Post-MVP 4 (S-08, S-11, M-06, M-11) · Nice-to-have 0 · (Planned: Post-MVP 4)
- **MVP at Done:** 9 / 18 = **50%**. Every MVP *screen* except auth (S-01, S-02) is below Done. The Done items are auth plus the live-round modals.
- **Blockers:**
  1. M-02 → S-07/S-10/S-17: finished jornada not persisted (terminal hop cannot be completed with real data).
  2. S-09 → S-05/M-01: configured rondas never reach the flow.
  3. S-05: no jornada entity created (no id/date), so there is nothing to record later.
  4. S-07 orphaned and S-17 back-links to `/reports`: the jornadas-list navigation is inconsistent.

## MVP Readiness Verdict

**1. Verdict: NOT READY.** The navigation path now connects end to end (S-01 → S-03 → S-05 → S-06 → M-02 → S-10 → S-17), which is an improvement over 2026-09-22. But the terminal hop still carries no real data: a finished jornada is deleted, not recorded, and every history screen shows hardcoded jornadas #40–#42.

**2. What's done**
- **S-01 / S-02 auth — Done.** Real Supabase email+password and Google OAuth; `proxy.ts` gates every route.
- **S-05 → S-06 hand-off — works.** `lib/round-draft/` carries cartones, players, active ronda and activity across the route change and survives reload.
- **Running a round — works.** `awardPrize` updates balances + house balance + activity log; M-01 closes and alternates regular/especial rondas.
- M-03, M-04, M-05, M-07, M-09, M-10 all work against real draft state.
- Cleanup since last audit: all demo routes and orphan pages removed, typecheck clean, `/numbers` 404 gone, CLAUDE.md in sync.

**3. What's missing, hop by hop**

| Hop | Status | What specifically blocks it |
|---|---|---|
| S-01 Login | **Done** | Soft gaps only: OAuth errors are silent, and there is no sign-up or password reset. |
| S-03 Home | **Partial** | CTA works; all stats and the jornada number are hardcoded. Doesn't create a jornada. |
| S-05 Nueva jornada | **Partial** | No jornada entity; ronda list is static JSON (S-09 disconnected); "Empezar ronda" not gated on a selected ronda. |
| S-06 Ronda activa | **Partial** | Heading hardcoded; embedded round history is mock. |
| M-02 → S-07 / S-10 / S-17 (result recorded) | **Partial → Stub — the fatal break** | M-02 calls `resetDraft()` and writes nothing. S-07, S-10's "Jornadas" tab and S-17 all read inline arrays in `game-page.tsx` / `game-detail-page.tsx`. S-07 is also unreachable (no nav entry). |
| S-09 Rondas (supporting) | **Partial** | Created rondas are local `useState` only. |

**4. Flow integrity**
- **Nav: connected.** S-17 is reachable via S-10 and returns to S-10. The only nav defect on the path is the duplicate, orphaned `/games` (S-07).
- **Data break 1 (terminal, worst):** S-06/M-02 → S-07/S-10/S-17. The jornada result is discarded, so the MVP's last hop cannot be completed with real data.
- **Data break 2:** S-09 → S-05/M-01. Configuring rondas and using rondas are separate systems.
- **Data gap 3:** S-05 creates no jornada record (id/date), so even with a store there is nothing keyed to write M-02's summary against.

**5. Recommendation — the single next action**
**Persist the finished jornada and read it back.** On M-02 confirm, write the jornada (id, date, `getGameSummary()`, closed rondas with winners, per-player entries) to a store *before* `resetDraft()`, and make `game-page.tsx` (S-07 + S-10 tab) and `game-detail-page.tsx` (S-17) read from that store instead of their inline arrays. On this branch that is BACKEND_PLAN Phase 4 (`game_sessions` persisted). If you want a demoable MVP before Phase 4, a `jornadas` repository following the `lib/round-draft/storage.ts` seam is the interim option. It also unblocks S-18 Liquidación.

Quick wins after that (small, independent): restore the sidebar "Jornadas → /games" entry *or* delete `/games` and keep the list only under S-10; point S-17's "Volver" to whichever you keep; wire S-07's "Iniciar jornada" to `/`; render `?error=` on S-01; disable "Empezar ronda" on S-05 until a ronda is selected.
