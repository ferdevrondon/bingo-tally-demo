-- BACKEND_PLAN.md Phase 2: the admin's open tab listens to its own
-- admin_auth_sessions row so it can sign out the moment another device claims
-- the session. The "read own" RLS policy limits each client to its own row.
alter publication supabase_realtime add table public.admin_auth_sessions;
