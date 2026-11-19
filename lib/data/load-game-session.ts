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

// Whether the house has an active game session, without reading it (the
// start screen sends it to /new-game instead).
export const hasActiveGameSession = cache(async (): Promise<boolean> => {
  const house = await getCurrentHouse()
  if (!house) return false
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("game_sessions")
    .select("id")
    .eq("house_id", house.houseId)
    .eq("status", "active")
    .maybeSingle()
  if (error) throw error
  return data !== null
})
