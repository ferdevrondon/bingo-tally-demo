import { cache } from "react"

import { getCurrentHouse } from "@/lib/data/house"
import { fetchGameSessionState } from "@/lib/round-draft/fetch-state"
import type { RoundDraftState } from "@/lib/round-draft/types"
import { createClient } from "@/lib/supabase/server"

// The house's active game session for the (game) layout, read with the
// signed-in user's client. Cached per request.
export const loadActiveGameSession = cache(async (): Promise<RoundDraftState | null> => {
  const house = await getCurrentHouse()
  if (!house) return null
  return fetchGameSessionState(await createClient(), house.houseId)
})

/** Only the id of the house's active game session (home page), or null. */
export async function getActiveGameSessionId(): Promise<number | null> {
  const house = await getCurrentHouse()
  if (!house) return null
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("game_sessions")
    .select("id")
    .eq("house_id", house.houseId)
    .eq("status", "active")
    .maybeSingle()
  if (error) throw error
  return data?.id ?? null
}
