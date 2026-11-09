import { cache } from "react"

import { getCurrentHouse } from "@/lib/data/house"
import { fetchGiftHistory } from "@/lib/game-report/player-gifts"
import { createClient } from "@/lib/supabase/server"

// Server read for /players: who received gifts in the active game session
// (lib/game-report/player-gifts.ts), the players who show the gift box button.

export interface ActiveGiftedPlayers {
  gameSessionId: number
  gameNumber: number
  /** An array, so it can go to a Client Component as a prop. */
  playerIds: number[]
}

/** null when the house has no active game session. */
export const loadActiveGiftedPlayers = cache(async (): Promise<ActiveGiftedPlayers | null> => {
  const house = await getCurrentHouse()
  if (!house) return null
  const supabase = await createClient()
  const { data: session, error } = await supabase
    .from("game_sessions")
    .select("id, number")
    .eq("house_id", house.houseId)
    .eq("status", "active")
    .maybeSingle()
  if (error) throw error
  if (!session) return null
  const entries = await fetchGiftHistory(supabase, { gameSessionId: session.id })
  return {
    gameSessionId: session.id,
    gameNumber: session.number,
    playerIds: [...new Set(entries.map((e) => e.playerId))],
  }
})
