# Supabase Auth — how it's wired up

This app uses [Supabase Auth](https://supabase.com/docs/guides/auth) for login (email/password + Google OAuth), via the `@supabase/ssr` package. This document explains the moving pieces: which files exist, what each one does, and how a request flows through them.

Project: `ADMIN-BINGO` (ref `xrporompvbfjfmkfxkwa`).

## The three ways Supabase talks to this app

Supabase Auth needs a slightly different client depending on *where* in Next.js the code runs, because each context has different access to cookies:

| File | Runs where | Purpose |
|---|---|---|
| [`lib/supabase/client.ts`](lib/supabase/client.ts) | Client Components (browser) | `createBrowserClient()` — for any future client-side `supabase.auth.*` calls |
| [`lib/supabase/server.ts`](lib/supabase/server.ts) | Server Components, Server Actions, Route Handlers | `createServerClient()` wired to `next/headers`' `cookies()`, so it can read the session and (where allowed) refresh it |
| [`lib/supabase/middleware.ts`](lib/supabase/middleware.ts) | `proxy.ts` (every request) | A third `createServerClient()` variant bound directly to the request/response cookie jar, used specifically for route protection |

All three read the same two env vars from `.env.local`: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Route protection: `proxy.ts`

Next.js 16 renamed "Middleware" to **"Proxy"** — the file convention is `proxy.ts` at the project root (not `middleware.ts`). It runs on (almost) every request, before any page renders.

```
proxy.ts
  └─ calls updateSession(request)   [lib/supabase/middleware.ts]
       ├─ refreshes the session via supabase.auth.getUser()
       │  (getUser() re-validates with the Auth server; getSession() would
       │   only trust the local cookie, which isn't safe to rely on here)
       ├─ if NOT logged in AND path isn't /login or /auth  → redirect to /login
       ├─ if     logged in AND path IS /login or /auth     → redirect to /
       └─ otherwise → let the request through (with refreshed cookies)
```

[`proxy.ts`](proxy.ts)'s `matcher` config excludes only static assets (`_next/static`, `_next/image`, images, favicon) — everything else, including every page route, passes through this check.

**Why `/auth` is in the exemption list (`AUTH_PATHS`) alongside `/login`:** the OAuth callback route (`/auth/callback`) is hit *before* a session exists — that's the whole point of it, it's what *creates* the session. Early on, `/auth` wasn't exempted, so `proxy.ts` saw "no session yet" on that route and redirected away to `/login` before the callback ever got to run, silently dropping the OAuth code every time. Now `/auth/*` is treated the same as `/login`: reachable while logged out, and bounced to `/` if you're already logged in.

## The two login paths

### 1. Email + password

```
components/login-form.tsx  (Client Component)
  │  <form action={signInWithPassword}>  — useActionState for pending/error state
  ▼
lib/supabase/actions.ts → signInWithPassword()   ["use server"]
  │  1. validates formData with lib/supabase/schemas.ts's zod loginSchema
  │  2. supabase.auth.signInWithPassword({ email, password })
  │  3. on error   → returns { errors } → shown inline via FieldError
  │  4. on success → redirect("/")
  ▼
proxy.ts sees the new session cookie → lets the request to "/" through
```

### 2. Google OAuth

```
components/login-form.tsx
  │  <form action={signInWithGoogle}>  (separate tiny form, just the Google button)
  ▼
lib/supabase/actions.ts → signInWithGoogle()   ["use server"]
  │  supabase.auth.signInWithOAuth({
  │    provider: "google",
  │    options: { redirectTo: "<origin>/auth/callback" }
  │  })
  │  redirect(data.url)  →  sends the browser to Supabase's own
  │                          /auth/v1/authorize endpoint
  ▼
Supabase  →  redirects browser to Google's consent screen
  ▼
Google    →  redirects browser back to SUPABASE's own callback
              (https://xrporompvbfjfmkfxkwa.supabase.co/auth/v1/callback —
               this is what's registered in Google Cloud Console, never our app)
  ▼
Supabase  →  exchanges the code with Google, creates the Supabase auth code,
              redirects the browser to our redirectTo: /auth/callback?code=...
  ▼
app/auth/callback/route.ts   (Route Handler, GET)
  │  1. reads ?code= from the URL
  │  2. supabase.auth.exchangeCodeForSession(code)  → sets the session cookie
  │  3. redirect(origin + next)   where next defaults to "/"
  │  4. on failure → redirect to /login?error=auth_callback_error
  ▼
proxy.ts sees the new session cookie → lets the request to "/" through
```

Two *separate* Supabase-side settings had to be correct for this to work (Authentication → dashboard, project `xrporompvbfjfmkfxkwa`):
- **Providers → Google**: enabled, with the Client ID/Secret from Google Cloud Console (a mismatched secret produces `invalid_client` errors, visible in Supabase's `auth_logs`).
- **URL Configuration**: Site URL = `http://localhost:3000`, and `http://localhost:3000/auth/callback` in the Redirect URLs allow-list (no trailing slash — Supabase falls back to the Site URL if `redirectTo` doesn't match an allow-listed entry exactly).

### Logout

```
components/nav-user.tsx  ("Log out" dropdown item)
  │  onClick={() => signOut()}   — calling the Server Action directly, no <form> needed
  ▼
lib/supabase/actions.ts → signOut()
  │  supabase.auth.signOut()
  │  redirect("/login")
```

## Route layout: two groups, one auth-aware split

`app/layout.tsx` used to wrap *every* route (including `/login`) in the full sidebar/header chrome. That's wrong once real redirects exist — a logged-out visitor would see the admin sidebar flash around the login card. So routes are split into two [route groups](https://nextjs.org/docs/app/building-your-application/routing/route-groups) (these don't affect the URL, only which layout wraps a page):

```
app/
├── layout.tsx              — global only: fonts, <html>/<body>, ThemeProvider,
│                              RoundDraftProvider, Toaster
├── auth/callback/route.ts  — the OAuth callback (a Route Handler, not a page —
│                              no layout wraps it at all)
├── (app)/                  — every real page of the app
│   ├── layout.tsx          — fetches the current user server-side, renders the
│   │                          sidebar/header chrome, passes the user down
│   ├── page.tsx            — root "/", the post-login landing page
│   ├── new-game/, active-round/, players/, rounds/, games/, reports/, settings/
│
└── (auth)/                 — auth-only pages
    ├── layout.tsx          — bare, just {children}, no sidebar
    └── login/page.tsx
```

`app/(app)/layout.tsx` is a Server Component: it calls `lib/supabase/server.ts`'s `createClient()`, reads `auth.getUser()`, maps the result through `lib/supabase/types.ts`'s `toAppUser()` (Supabase's `User` shape → the simple `{name, email, avatar}` shape `AppSidebar`/`NavUser` expect), and passes it down as a prop — replacing what used to be a hardcoded `{name: "shadcn", email: "m@example.com", ...}` object in `components/app-sidebar.tsx`.

## All the auth-related files, in one place

| File | New/Modified | Role |
|---|---|---|
| `lib/supabase/client.ts` | new | Browser Supabase client factory |
| `lib/supabase/server.ts` | new | Server Supabase client factory (Server Components/Actions/Route Handlers) |
| `lib/supabase/middleware.ts` | new | `updateSession()` — the actual route-protection logic used by `proxy.ts` |
| `lib/supabase/actions.ts` | new | Server Actions: `signInWithPassword`, `signInWithGoogle`, `signOut` |
| `lib/supabase/schemas.ts` | new | zod schema for the login form |
| `lib/supabase/types.ts` | new | `AppUser` type + `toAppUser()` mapper |
| `proxy.ts` | new | Next 16's route-protection entry point (was `middleware.ts` pre-v16) |
| `app/auth/callback/route.ts` | new | OAuth code-exchange endpoint |
| `app/(app)/layout.tsx` | new | Sidebar/header chrome + fetches the real user |
| `app/(auth)/layout.tsx` | new | Bare layout for `/login` |
| `app/layout.tsx` | modified | Trimmed down to only global providers |
| `components/login-form.tsx` | modified | Wired to the real Server Actions; Apple button removed |
| `components/app-sidebar.tsx` | modified | Takes `user` as a prop instead of a hardcoded object |
| `components/nav-user.tsx` | modified | "Log out" now calls `signOut()` |
| `.env.local` (gitignored) | — | Holds `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `.env.example` | new | Committed placeholder for the two env vars above |

## Tenancy: current house and role

A signed-in user works inside one **house** (`public.houses`); `public.house_members` links users to houses with role `admin` (at most one per house, enforced by a unique index) or `observer`. The schema, RLS and helper functions are in `supabase/migrations/`; BACKEND_PLAN.md §1–4 explains the model.

```
app/(app)/layout.tsx  (Server Component)
  │  getCurrentUser() + getCurrentHouse()   [lib/data/house.ts, cached per request]
  │    getCurrentHouse = the user's oldest membership → { houseId, houseName, role }, or null
  ▼
components/house-provider.tsx  <HouseProvider house={…}>
  └─ client components: useHouse() / useRole()  → "admin" | "observer" | null
```

`useRole()` only decides what the UI shows. The database is the real guard: RLS lets members read their house and lets only the admin write, and only from the admin's currently claimed login session (`admin_auth_sessions`, wired into the login flow in BACKEND_PLAN Phase 2).

## Database backups and restore

The project is on the Supabase Free plan, which has no automatic backups. `.github/workflows/db-backup.yml` runs every night at 03:00 America/Mexico_City (and on demand from **Actions → db-backup → Run workflow**). It uses the Supabase CLI to write three files and uploads them as the workflow artifact `db-backup-<run id>`, kept for 30 days:

| File | Contents |
|---|---|
| `roles.sql` | Custom database roles |
| `schema.sql` | Tables, functions, RLS policies, triggers (Supabase internals filtered out) |
| `data.sql` | All rows, including `auth.users`, as `COPY` statements |

**Secret:** `SUPABASE_DB_URL` (GitHub → Settings → Secrets and variables → Actions) holds the **Session pooler** connection string, port `5432`, user `postgres.xrporompvbfjfmkfxkwa`. GitHub runners are IPv4-only and the direct connection is IPv6 on the Free plan, so the direct string would fail. The dumps contain player data: keep the repo private.

### Restore

1. Download the artifact from the workflow run and unzip it.
2. Target: the same project (after data loss) or a new project. In a new project, first enable any non-default extensions.
3. Get the target's Session pooler connection string (**Connect** in the dashboard) and its database password (**Project Settings → Database → Reset database password** if unknown).
4. With `psql` installed (`brew install postgresql@17`), run:

   ```bash
   psql --single-transaction --variable ON_ERROR_STOP=1 \
     --file roles.sql --file schema.sql \
     --command 'SET session_replication_role = replica' \
     --file data.sql \
     --dbname "<SESSION_POOLER_CONNECTION_STRING>"
   ```

   `session_replication_role = replica` disables triggers during the import. The whole restore is one transaction, so a failure changes nothing.
5. Re-enable the Realtime publication on `activity_log` and `admin_auth_sessions` (from BACKEND_PLAN Phase 2/5 on) in **Database → Publications**.

Restoring into the *same* project over existing tables fails on conflicts; restore into a fresh project, or reset the database first. Known fixes for permission errors (`supabase_admin` owner lines, the `cli_login_postgres` grant) are in Supabase's guide: https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore

## Not wired up yet (intentional, out of scope so far)

- `components/user-info.tsx` (the account-settings edit form) still isn't connected to `supabase.auth.updateUser` — doing that properly means first deciding whether "username" lives in Supabase's `user_metadata` or a separate `profiles` table.
- `app/(app)/page.tsx`'s content is still the original marketing/hero component (`MainPageSplit`) — it's just the *authenticated landing spot* now, not yet redesigned as a real dashboard.
