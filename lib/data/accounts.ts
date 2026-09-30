import type { SupabaseClient } from "@supabase/supabase-js"
import { cache } from "react"

import { isBalanceStatus, type PlayerAccount } from "@/lib/accounts"
import { getCurrentHouse } from "@/lib/data/house"
import type { Database } from "@/lib/supabase/database.types"
import { createClient } from "@/lib/supabase/server"

// Every player account of a house. A player in the active game session has
// their live balance there (game_session_players.balance); the account row
// catches up when the game session ends.
export async function fetchPlayerAccounts(
  supabase: SupabaseClient<Database>,
  houseId: number
): Promise<Map<number, PlayerAccount>> {
  const [accounts, inGame] = await Promise.all([
    supabase
      .from("player_accounts")
      .select("player_id, balance, balance_status, balance_note")
      .eq("house_id", houseId),
    supabase
      .from("game_session_players")
      .select("player_id, balance, game_sessions!inner(status)")
      .eq("house_id", houseId)
      .eq("game_sessions.status", "active"),
  ])
  if (accounts.error) throw accounts.error
  if (inGame.error) throw inGame.error

  const liveBalance = new Map(inGame.data.map((row) => [row.player_id, Number(row.balance)]))
  return new Map(
    accounts.data.map((row) => [
      row.player_id,
      {
        playerId: row.player_id,
        balance: liveBalance.get(row.player_id) ?? Number(row.balance),
        status: isBalanceStatus(row.balance_status) ? row.balance_status : null,
        note: row.balance_note,
        inGame: liveBalance.has(row.player_id),
      },
    ])
  )
}

/** The current house's player accounts, cached per request. */
export const listPlayerAccounts = cache(async (): Promise<Map<number, PlayerAccount>> => {
  const house = await getCurrentHouse()
  if (!house) return new Map()
  return fetchPlayerAccounts(await createClient(), house.houseId)
})

/** A player with no account row yet (added after Phase 4d1) has $0. */
export function accountFor(accounts: Map<number, PlayerAccount>, playerId: number): PlayerAccount {
  return (
    accounts.get(playerId) ?? { playerId, balance: 0, status: null, note: null, inGame: false }
  )
}
