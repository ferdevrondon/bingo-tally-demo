import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js"

import { toGameActionError, type GameActionError } from "@/lib/data/game-action-result"
import { rejectWrite } from "@/lib/data/reject-write"
import type { Database } from "@/lib/supabase/database.types"

// Turns a failed call to a game / account / settlement SQL function made from
// a Server Action into a result for the UI. The functions raise their error
// code as the message (`number_taken`, `settlement_closed`, ...).
export async function rejectGameAction(
  supabase: SupabaseClient<Database>,
  error: PostgrestError
): Promise<{ ok: false; error: GameActionError }> {
  if (error.code === "42501") {
    // not_admin: a replaced admin session is signed out and redirected.
    const result = await rejectWrite(supabase, error)
    return { ok: false, error: result.error === "read_only" ? "read_only" : "failed" }
  }
  const code = toGameActionError(error.message)
  if (code === "failed") console.error("game action failed", error)
  return { ok: false, error: code }
}
