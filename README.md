# Admin Bingo

Admin dashboard for running bingo game sessions (jornadas): assign tickets (cartones) and numbers to players, run rounds, award prizes and track balances. Built with Next.js 16 (App Router), shadcn/ui on Base UI, Tailwind v4 and Supabase.

## Setup

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env.local` and fill in the Supabase project values:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Start the dev server: `npm run dev` → http://localhost:3000 (every route except `/login` requires a signed-in user).

## Commands

```bash
npm run dev         # dev server
npm run build       # production build
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run format      # prettier
```

## Docs

- [`CLAUDE.md`](CLAUDE.md): architecture, conventions and domain vocabulary.
- [`BACKEND_PLAN.md`](BACKEND_PLAN.md): phased plan for the Supabase backend (houses, admin/observer roles, live game sessions, settlement).
- [`SUPABASE_AUTH.md`](SUPABASE_AUTH.md): how Supabase Auth is wired (email/password, Google, `proxy.ts`).
- [`docs/screens-registry.md`](docs/screens-registry.md): inventory and status of every screen.
