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
