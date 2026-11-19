import type { SupabaseClient } from "@supabase/supabase-js"

import { SESSION_EXPIRED_PATH } from "@/lib/admin-session-paths"

// Browser calls whose access token expired. supabase-js refreshes the token on
// a timer and when a hidden tab becomes visible again, but a suspended mobile
// tab can still send a request with the old token first, and PostgREST answers
// 401 (PGRST303 "JWT expired", PGRST301 for a token it can't verify). The
// caller refreshes once and retries; when the refresh token is gone too
// ("Refresh Token Not Found") the only way back is to log in again.

const JWT_ERROR_CODES = new Set(["PGRST301", "PGRST302", "PGRST303"])

export function isJwtError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  if (error.code && JWT_ERROR_CODES.has(error.code)) return true
  return /\bJWT\b/i.test(error.message ?? "")
}

// One refresh for every call that hit the expired token at the same time.
let refreshing: Promise<boolean> | null = null
let leaving = false

/**
 * Refreshes the login session. Returns true when the caller can retry; false
 * when it couldn't be refreshed, after signing this device out and sending it
 * to /login with the "session expired" notice.
 */
export function refreshExpiredSession(supabase: SupabaseClient): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession()
      if (!error && data.session) return true
      console.warn("session refresh failed", error)
      await signOutExpired(supabase)
      return false
    } finally {
      refreshing = null
    }
  })()
  return refreshing
}

export async function signOutExpired(supabase: SupabaseClient) {
  if (leaving) return
  leaving = true
  // The sign-out comes first because proxy.ts sends signed-in users away
  // from /login.
  await supabase.auth.signOut({ scope: "local" })
  window.location.replace(SESSION_EXPIRED_PATH)
}
