import { cache } from "react"

import { needsAttention } from "@/lib/accounts"
import { accountFor, listPlayerAccounts } from "@/lib/data/accounts"
import { getCurrentHouse } from "@/lib/data/house"
import {
  fetchGameSessionList,
  fetchGameSessionReport,
  fetchRoundsOfDay,
} from "@/lib/game-report/fetch"
import { houseToday, isDayString } from "@/lib/game-report/format"
import type { GameSessionListItem, GameSessionReport, RoundsOfDay } from "@/lib/game-report/types"
import { createClient } from "@/lib/supabase/server"

// Server reads of the house's game sessions (Reportes → Jornadas, the game
// session report, home). RLS limits every row to the user's house.

export const listGameSessions = cache(async (): Promise<GameSessionListItem[]> => {
  const house = await getCurrentHouse()
  if (!house) return []
  return fetchGameSessionList(await createClient(), house.houseId, house.timezone)
})

export const loadGameSessionReport = cache(
  async (gameSessionId: number): Promise<GameSessionReport | null> => {
    const house = await getCurrentHouse()
    if (!house) return null
    return fetchGameSessionReport(await createClient(), gameSessionId, house.timezone)
  }
)

/** Reportes → Rondas for `day` ("2026-09-29"); today in the house's time
 *  zone when the day is missing or invalid. */
export async function loadRoundsOfDay(day: string | undefined): Promise<RoundsOfDay | null> {
  const house = await getCurrentHouse()
  if (!house) return null
  const date = isDayString(day) ? day : houseToday(house.timezone)
  return fetchRoundsOfDay(await createClient(), house.houseId, date, house.timezone)
}

export interface HomeSummary {
  /** The active game session's number, or the next one to start. */
  gameNumber: number
  hasActiveGameSession: boolean
  lastEnded: Pick<
    GameSessionListItem,
    "id" | "number" | "startedAtLabel" | "playersCount" | "houseTotal"
  > | null
  /** Players who owe, are pending a payout or have a positive balance nobody
   *  decided on (what "Iniciar jornada" warns about). */
  pendingPlayers: number
}

export async function loadHomeSummary(): Promise<HomeSummary> {
  const house = await getCurrentHouse()
  if (!house) return { gameNumber: 1, hasActiveGameSession: false, lastEnded: null, pendingPlayers: 0 }
  const supabase = await createClient()
  const [sessions, accounts, players] = await Promise.all([
    listGameSessions(),
    listPlayerAccounts(),
    supabase.from("players").select("id").eq("house_id", house.houseId).eq("active", true),
  ])
  if (players.error) throw players.error

  const active = sessions.find((s) => s.status === "active") ?? null
  const lastEnded = sessions.find((s) => s.status === "ended") ?? null
  return {
    gameNumber: active?.number ?? (sessions[0]?.number ?? 0) + 1,
    hasActiveGameSession: active !== null,
    lastEnded,
    pendingPlayers: players.data.filter((p) => {
      const account = accountFor(accounts, p.id)
      return !account.inGame && needsAttention(account)
    }).length,
  }
}
