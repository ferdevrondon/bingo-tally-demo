import { cache } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"

import { SESSION_CONFLICT_PATH } from "@/lib/admin-session-paths"
import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/supabase/database.types"

type Client = SupabaseClient<Database>

// Values returned by public.admin_session_status() (see the init migration).
export type AdminSessionStatus = "not_admin" | "none" | "mine" | "other_active" | "other_stale"

export async function getAdminSessionStatus(supabase: Client): Promise<AdminSessionStatus> {
  const { data, error } = await supabase.rpc("admin_session_status")
  if (error) throw error
  return data as AdminSessionStatus
}

// Makes the caller's current login session the only one that can write, and
// revokes the refresh tokens of every other session of this account. Their
// access tokens stay valid for up to an hour, but is_house_admin() already
// rejects their writes.
export async function claimAdminSession(supabase: Client) {
  const { error } = await supabase.rpc("claim_admin_session")
  if (error) throw error
  await supabase.auth.signOut({ scope: "others" })
}

// Right after a successful sign-in (password or Google): where to send the
// user. Admins claim the session unless another device is actively using it,
// in which case they choose on /session-conflict.
export async function resolveAdminSessionAfterLogin(
  supabase: Client
): Promise<"/" | typeof SESSION_CONFLICT_PATH> {
  const status = await getAdminSessionStatus(supabase)
  if (status === "other_active") return SESSION_CONFLICT_PATH
  if (status !== "not_admin" && status !== "mine") await claimAdminSession(supabase)
  return "/"
}

// Fallback for (app)/layout.tsx on every request: an admin session opened
// before this check existed (or whose other device went quiet) claims silently;
// one that lost the session to an active device goes to /session-conflict.
// Doesn't sign out other sessions: a layout can't write cookies, and the
// claim alone already blocks their writes.
export const ensureAdminSession = cache(async (): Promise<"ok" | "conflict"> => {
  const supabase = await createClient()
  const status = await getAdminSessionStatus(supabase)
  if (status === "other_active") return "conflict"
  if (status === "none" || status === "other_stale") {
    const { error } = await supabase.rpc("claim_admin_session")
    if (error) throw error
  }
  return "ok"
})

// For Phase 3+ write actions: a write rejected because this login session is
// no longer the admin's claimed one should send the user to
// SESSION_REPLACED_PATH (lib/admin-session-paths.ts) instead of showing a
// generic error.
export function isNotAdminError(error: { code?: string; message?: string } | null): boolean {
  return !!error && (error.code === "42501" || error.message === "not_admin")
}
