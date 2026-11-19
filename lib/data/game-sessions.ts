import { cache } from "react"

import { needsAttention } from "@/lib/accounts"
import { listDebts } from "@/lib/data/debts"
import { getCurrentHouse, getCurrentUser } from "@/lib/data/house"
import { loadActiveGameSession } from "@/lib/data/load-game-session"
import { listSettlements } from "@/lib/data/settlement"
import {
  fetchGameSessionList,
  fetchGameSessionReport,
  fetchRoundsOfDay,
} from "@/lib/game-report/fetch"
import { houseToday, isDayString, isMonthString, monthDays } from "@/lib/game-report/format"
import { fetchPeriodReport } from "@/lib/game-report/period"
import type {
  GameSessionListItem,
  GameSessionReport,
  PeriodReport,
  RoundsOfDay,
} from "@/lib/game-report/types"
import { getActivePlayers } from "@/lib/round-draft/selectors"
import { createClient } from "@/lib/supabase/server"
import { toAppUser } from "@/lib/supabase/types"

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

/** Reportes → Diario: one day of the house (today when missing or invalid). */
export async function loadDailyReport(day: string | undefined): Promise<PeriodReport | null> {
  const house = await getCurrentHouse()
  if (!house) return null
  const date = isDayString(day) ? day : houseToday(house.timezone)
  return fetchPeriodReport(await createClient(), house.houseId, date, date, house.timezone)
}

/** Reportes → Mensual: one month of the house ("2026-09"; the current one
 *  when missing or invalid). */
export async function loadMonthlyReport(month: string | undefined): Promise<PeriodReport | null> {
  const house = await getCurrentHouse()
  if (!house) return null
  const current = houseToday(house.timezone).slice(0, 7)
  // A future month (typed in the URL) shows the current one.
  const value = isMonthString(month) && month <= current ? month : current
  const days = monthDays(value)
  return fetchPeriodReport(
    await createClient(),
    house.houseId,
    days[0],
    days[days.length - 1],
    house.timezone
  )
}

/** Inicio (/): the house, the active game session and what needs attention,
 *  for admins and observers alike. */
export interface HomeData {
  houseName: string
  role: "admin" | "observer"
  /** The signed-in person (their name, or their email). */
  userName: string
  /** The active game session, or null with the number the next one gets. */
  game:
    | {
        active: true
        number: number
        /** The open round, or null while it is being picked. */
        round: { name: string; linePrice: number } | null
        roundsPlayed: number
        players: number
        tickets: number
        houseBalance: number
      }
    | { active: false; nextNumber: number }
  /** Reportes → Diario of today; null without a house. */
  today: {
    house: number
    gameSessions: number
    roundsPlayed: number
    /** Recharges minus payouts, every origin. */
    netCash: number
  } | null
  pending: {
    owe: { players: number; total: number }
    owed: { players: number; total: number }
    /** Open settlements with someone still unresolved. */
    openSettlements: number
  }
}

export async function loadHome(): Promise<HomeData | null> {
  const [house, user] = await Promise.all([getCurrentHouse(), getCurrentUser()])
  if (!house || !user) return null
  const [game, sessions, daily, debts, settlements] = await Promise.all([
    loadActiveGameSession(),
    listGameSessions(),
    loadDailyReport(undefined),
    listDebts(),
    listSettlements(),
  ])

  // During a game session every balance counts as it is right now; before
  // one, only what "Iniciar jornada" warns about (a positive balance kept
  // "Para jugar" is not pending).
  const pending = game ? debts : debts.filter(needsAttention)
  const owe = pending.filter((d) => d.balance < 0)
  const owed = pending.filter((d) => d.balance > 0)
  const sum = (rows: typeof debts) =>
    rows.reduce((total, d) => total + Math.abs(d.balance), 0)

  return {
    houseName: house.houseName,
    role: house.role,
    userName: toAppUser(user).name,
    game: game
      ? {
          active: true,
          number: game.gameNumber,
          round: game.round
            ? { name: game.round.name, linePrice: game.round.linePrice }
            : null,
          roundsPlayed: game.roundsPlayed,
          players: getActivePlayers(game).length,
          tickets: game.tickets.length,
          houseBalance: game.houseBalance,
        }
      : // Sessions are newest first.
        { active: false, nextNumber: (sessions[0]?.number ?? 0) + 1 },
    today: daily && {
      house: daily.house.total,
      gameSessions: daily.activity.gameSessions,
      roundsPlayed: daily.activity.roundsPlayed,
      netCash: daily.cash.reduce(
        (total, line) =>
          total +
          line.inGame.recharges +
          line.outside.recharges -
          line.inGame.payouts -
          line.outside.payouts,
        0
      ),
    },
    pending: {
      owe: { players: owe.length, total: sum(owe) },
      owed: { players: owed.length, total: sum(owed) },
      openSettlements: settlements.filter(
        (s) => s.status === "open" && s.unresolved > 0
      ).length,
    },
  }
}
