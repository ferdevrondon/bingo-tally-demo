import { cache } from "react"

import { isBank } from "@/lib/banks"
import { accountFor, listPlayerAccounts } from "@/lib/data/accounts"
import { getCurrentHouse } from "@/lib/data/house"
import { SALE_TYPES } from "@/lib/game-report/ledger"
import { isPaymentMethod } from "@/lib/payment-methods"
import {
  isSettlementResolution,
  type Settlement,
  type SettlementListItem,
  type SettlementPlayer,
} from "@/lib/settlement"
import { createClient } from "@/lib/supabase/server"

// Reads for the settlement screens. RLS limits every row to the user's house.

const PAGE_SIZE = 1000

function formatDate(value: string | null, timeZone: string): string {
  if (!value) return ""
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(value))
}

type Totals = Pick<SettlementPlayer, "played" | "prizes" | "recharges" | "payouts">

// Per player, what moved in the game session. The API returns at most 1000
// rows per request, so the ledger is read page by page.
async function sessionTotals(gameSessionId: number): Promise<Map<number, Totals>> {
  const supabase = await createClient()
  const totals = new Map<number, Totals>()
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("activity_log")
      .select("player_id, type, amount")
      .eq("game_session_id", gameSessionId)
      .not("player_id", "is", null)
      .not("amount", "is", null)
      .order("id")
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    for (const row of data) {
      const t = totals.get(row.player_id!) ?? { played: 0, prizes: 0, recharges: 0, payouts: 0 }
      const amount = Number(row.amount)
      if (SALE_TYPES.has(row.type)) t.played -= amount
      else if (row.type === "adjustment") t.played += amount
      else if (row.type === "prize_won") t.prizes += amount
      else if (row.type === "recharge") t.recharges += amount
      else if (row.type === "payout") t.payouts += -amount
      totals.set(row.player_id!, t)
    }
    if (data.length < PAGE_SIZE) return totals
  }
}

/** The settlement of an ended game session, or null if it doesn't exist. */
export const loadSettlement = cache(async (gameSessionId: number): Promise<Settlement | null> => {
  const house = await getCurrentHouse()
  if (!house) return null
  const supabase = await createClient()

  const [settlement, rows, sessionPlayers] = await Promise.all([
    supabase
      .from("settlements")
      .select("status, closed_at, game_sessions(number, ended_at)")
      .eq("game_session_id", gameSessionId)
      .maybeSingle(),
    supabase
      .from("settlement_players")
      .select(
        "player_id, closing_balance, received, paid, resolution, note, resolved_at, final_balance, players(name, payment_method, bank)"
      )
      .eq("game_session_id", gameSessionId),
    supabase
      .from("game_session_players")
      .select("player_id, opening_balance")
      .eq("game_session_id", gameSessionId),
  ])
  if (settlement.error) throw settlement.error
  if (rows.error) throw rows.error
  if (sessionPlayers.error) throw sessionPlayers.error
  if (!settlement.data) return null

  const [totals, accounts] = await Promise.all([sessionTotals(gameSessionId), listPlayerAccounts()])
  const opening = new Map(sessionPlayers.data.map((p) => [p.player_id, Number(p.opening_balance)]))

  const players = rows.data
    .map((row): SettlementPlayer => {
      const account = accountFor(accounts, row.player_id)
      const t = totals.get(row.player_id) ?? { played: 0, prizes: 0, recharges: 0, payouts: 0 }
      return {
        playerId: row.player_id,
        name: row.players?.name ?? "Jugador",
        paymentMethod: isPaymentMethod(row.players?.payment_method)
          ? row.players.payment_method
          : null,
        bank: isBank(row.players?.bank) ? row.players.bank : null,
        openingBalance: opening.get(row.player_id) ?? 0,
        ...t,
        closingBalance: Number(row.closing_balance),
        received: Number(row.received),
        paid: Number(row.paid),
        resolution: isSettlementResolution(row.resolution) ? row.resolution : null,
        note: row.note,
        resolvedAt: row.resolved_at,
        finalBalance: row.final_balance === null ? null : Number(row.final_balance),
        currentBalance: account.balance,
        inGame: account.inGame,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name, "es"))

  return {
    gameSessionId,
    number: settlement.data.game_sessions?.number ?? 0,
    endedAtLabel: formatDate(settlement.data.game_sessions?.ended_at ?? null, house.timezone),
    status: settlement.data.status === "closed" ? "closed" : "open",
    closedAtLabel: settlement.data.closed_at
      ? formatDate(settlement.data.closed_at, house.timezone)
      : null,
    players,
  }
})

/** Every settlement of the house, newest first. */
export const listSettlements = cache(async (): Promise<SettlementListItem[]> => {
  const house = await getCurrentHouse()
  if (!house) return []
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("settlements")
    .select("game_session_id, status, game_sessions(number, ended_at), settlement_players(resolution)")
    .eq("house_id", house.houseId)
    .order("game_session_id", { ascending: false })
  if (error) throw error
  return data.map((s) => ({
    gameSessionId: s.game_session_id,
    number: s.game_sessions?.number ?? 0,
    endedAtLabel: formatDate(s.game_sessions?.ended_at ?? null, house.timezone),
    status: s.status === "closed" ? "closed" : "open",
    players: s.settlement_players.length,
    unresolved: s.settlement_players.filter((p) => p.resolution === null).length,
  }))
})
