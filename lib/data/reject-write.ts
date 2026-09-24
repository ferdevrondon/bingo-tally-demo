import type { SupabaseClient } from "@supabase/supabase-js"
import { redirect } from "next/navigation"

import { SESSION_REPLACED_PATH } from "@/lib/admin-session-paths"
import {
  getAdminSessionStatus,
  isNotAdminError,
} from "@/lib/data/admin-session"
import { getCurrentHouse } from "@/lib/data/house"
import type { WriteError } from "@/lib/data/write-result"
import type { Database } from "@/lib/supabase/database.types"

// Turns a failed catalog write into a result for the UI. `error` is null when
// an update matched 0 rows: RLS hides rows the caller may not write, and
// Postgres reports that as success with nothing changed.
//
// An admin whose login session is no longer the claimed one (another device
// took over, BACKEND_PLAN.md §2) is signed out here and sent to the
// "session replaced" notice. The sign-out comes first because proxy.ts sends
// signed-in users away from /login.
export async function rejectWrite(
  supabase: SupabaseClient<Database>,
  error: { code?: string; message?: string } | null
): Promise<{ ok: false; error: WriteError }> {
  const house = await getCurrentHouse()
  if (house?.role !== "admin") return { ok: false, error: "read_only" }

  if (error && !isNotAdminError(error)) {
    console.error("catalog write failed", error)
    return { ok: false, error: "failed" }
  }

  if ((await getAdminSessionStatus(supabase)) !== "mine") {
    await supabase.auth.signOut({ scope: "local" })
    redirect(SESSION_REPLACED_PATH)
  }
  return { ok: false, error: error ? "failed" : "not_found" }
}
