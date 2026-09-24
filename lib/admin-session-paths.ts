// Shared by server code (lib/data/admin-session.ts) and the client guard
// (components/admin-session-guard.tsx), so it must not import server modules.
export const SESSION_CONFLICT_PATH = "/session-conflict"
export const SESSION_REPLACED_PATH = "/login?reason=replaced"
