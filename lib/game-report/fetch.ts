import type { SupabaseClient } from "@supabase/supabase-js"

import { isPaymentMethod, type PaymentMethod } from "@/lib/payment-methods"
import type { Database } from "@/lib/supabase/database.types"
import type { ActivityEntry, ActivityEntryType } from "@/lib/round-draft/types"

import { formatHouseDateTime } from "./format"
import { houseResult, saleAmount } from "./ledger"
import type {
  CashLine,
  GameSessionListItem,
  GameSessionReport,
  GameSessionStatus,
  NumberPosition,
  PlayerReport,
  PlayerRoundReport,
  RoundReport,
  RoundWinnerReport,
} from "./types"

// Reads for the game session report (BACKEND_PLAN.md Phase 6a). They take
// the Supabase client, like lib/round-draft/fetch-state.ts, so the same code
// runs on the server (/games, /games/[id]) and in the browser (the live
// game's round history and "Ver rondas"). RLS limits every row to the user's
// house.

type Client = SupabaseClient<Database>

const PAGE_SIZE = 1000

const LEDGER_COLUMNS =
  "id, created_at, type, player_id, round_id, ticket_id, number, amount, payment_method, note"

type LedgerRow = Pick<
  Database["public"]["Tables"]["activity_log"]["Row"],
  | "id"
  | "created_at"
  | "type"
  | "player_id"
  | "round_id"
  | "ticket_id"
  | "number"
  | "amount"
  | "payment_method"
  | "note"
>

export function toActivityEntry(row: LedgerRow): ActivityEntry {
  return {
    id: row.id,
    timestamp: Date.parse(row.created_at),
    type: row.type as ActivityEntryType,
    playerId: row.player_id,
    roundId: row.round_id,
    ticketId: row.ticket_id,
    number: row.number,
    amount: row.amount === null ? null : Number(row.amount),
    paymentMethod: isPaymentMethod(row.payment_method) ? row.payment_method : null,
    note: row.note,
  }
}

// The API returns at most 1000 rows per request: read the ledger page by page.
async function readLedger(
  supabase: Client,
  gameSessionId: number,
  playerId: number | null = null
): Promise<LedgerRow[]> {
  const rows: LedgerRow[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase.from("activity_log").select(LEDGER_COLUMNS).eq("game_session_id", gameSessionId)
    if (playerId !== null) query = query.eq("player_id", playerId)
    const { data, error } = await query.order("id").range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    rows.push(...data)
    if (data.length < PAGE_SIZE) return rows
  }
}

function toStatus(value: string): GameSessionStatus {
  return value === "active" ? "active" : "ended"
}

/** A round closed without winning numbers was never played (unplayed round refund). */
function wasPlayed(round: { status: string; winning_numbers: (number | null)[] }) {
  return round.status === "closed" && round.winning_numbers.some((n) => n !== null)
}

/** Every game session of the house, newest first. */
export async function fetchGameSessionList(
  supabase: Client,
  houseId: number,
  timeZone: string
): Promise<GameSessionListItem[]> {
  const { data, error } = await supabase
    .from("game_sessions")
    .select(
      "id, number, status, started_at, house_balance, game_session_rounds(status, winning_numbers), game_session_players(removed_at), tickets(count), settlements(status, settlement_players(resolution))"
    )
    .eq("house_id", houseId)
    .order("number", { ascending: false })
  if (error) throw error

  return data.map((g) => {
    // One settlement per ended game session; the generated types see a list.
    const settlement = [g.settlements].flat()[0] ?? null
    return {
      id: g.id,
      number: g.number,
      status: toStatus(g.status),
      startedAtLabel: formatHouseDateTime(g.started_at, timeZone),
      roundsPlayed: g.game_session_rounds.filter(wasPlayed).length,
      playersCount: g.game_session_players.filter((p) => p.removed_at === null).length,
      ticketsCount: g.tickets[0]?.count ?? 0,
      houseTotal: Number(g.house_balance),
      settlement: settlement
        ? {
            status: settlement.status === "closed" ? "closed" : "open",
            unresolved: settlement.settlement_players.filter((p) => p.resolution === null).length,
          }
        : null,
    }
  })
}

/** Everything that happened in one game session, or null if it doesn't exist. */
export async function fetchGameSessionReport(
  supabase: Client,
  gameSessionId: number,
  timeZone: string
): Promise<GameSessionReport | null> {
  const [session, rounds, winners, sessionPlayers, tickets, settlement, ledger] = await Promise.all([
    supabase
      .from("game_sessions")
      .select("id, number, status, started_at, ended_at, house_balance")
      .eq("id", gameSessionId)
      .maybeSingle(),
    supabase
      .from("game_session_rounds")
      .select(
        "id, seq, name, status, closed_at, line_price, prizes, winning_numbers, margin_gifts, margin_unsold_losing, margin_unsold_winning"
      )
      .eq("game_session_id", gameSessionId)
      .order("seq"),
    supabase
      .from("round_winners")
      .select("round_id, player_id, ticket_id, number, slot, prize")
      .eq("game_session_id", gameSessionId)
      .order("slot")
      .order("id"),
    supabase
      .from("game_session_players")
      .select("player_id, opening_balance, balance, removed_at, players(name)")
      .eq("game_session_id", gameSessionId),
    supabase.from("tickets").select("id, index").eq("game_session_id", gameSessionId),
    supabase
      .from("settlements")
      .select("status, settlement_players(resolution, received, paid)")
      .eq("game_session_id", gameSessionId)
      .maybeSingle(),
    readLedger(supabase, gameSessionId),
  ])
  for (const result of [session, rounds, winners, sessionPlayers, tickets, settlement]) {
    if (result.error) throw result.error
  }
  if (!session.data) return null
  const g = session.data

  const playerNames = new Map(
    (sessionPlayers.data ?? []).map((p) => [p.player_id, p.players?.name ?? "Jugador"])
  )
  const ticketIndex = new Map((tickets.data ?? []).map((t) => [t.id, t.index]))

  // Per player and per round, what the ledger moved.
  const totals = new Map<number, Omit<PlayerReport, "id" | "name" | "removed" | "opening" | "closing">>()
  const salesByRound = new Map<number, number>()
  const cash = new Map<PaymentMethod | null, CashLine>()
  for (const row of ledger) {
    const sale = saleAmount(row.type, row.amount)
    if (row.round_id !== null && sale !== 0) {
      salesByRound.set(row.round_id, (salesByRound.get(row.round_id) ?? 0) + sale)
    }
    if (row.type === "recharge" || row.type === "payout") {
      const method = isPaymentMethod(row.payment_method) ? row.payment_method : null
      const line = cash.get(method) ?? { method, recharges: 0, payouts: 0 }
      if (row.type === "recharge") line.recharges += Number(row.amount ?? 0)
      else line.payouts += -Number(row.amount ?? 0)
      cash.set(method, line)
    }
    if (row.player_id === null) continue
    const t = totals.get(row.player_id) ?? { played: 0, prizes: 0, recharges: 0, payouts: 0 }
    t.played += sale
    if (row.type === "prize_won") t.prizes += Number(row.amount ?? 0)
    else if (row.type === "recharge") t.recharges += Number(row.amount ?? 0)
    else if (row.type === "payout") t.payouts += -Number(row.amount ?? 0)
    totals.set(row.player_id, t)
  }

  const winnersByRound = new Map<number, RoundWinnerReport[]>()
  for (const w of winners.data ?? []) {
    const list = winnersByRound.get(w.round_id) ?? []
    list.push({
      playerId: w.player_id,
      playerName: playerNames.get(w.player_id) ?? "Jugador",
      ticketIndex: ticketIndex.get(w.ticket_id) ?? 0,
      number: w.number,
      slot: w.slot,
      prize: Number(w.prize),
    })
    winnersByRound.set(w.round_id, list)
  }

  const roundReports: RoundReport[] = (rounds.data ?? []).map((r) => {
    const roundWinners = winnersByRound.get(r.id) ?? []
    return {
      id: r.id,
      seq: r.seq,
      name: r.name,
      status: r.status === "open" ? "open" : "closed",
      played: wasPlayed(r),
      closedAtLabel: r.closed_at ? formatHouseDateTime(r.closed_at, timeZone) : null,
      linePrice: Number(r.line_price),
      prizes: r.prizes.map(Number),
      winningNumbers: r.prizes.map((_, i) => r.winning_numbers[i] ?? null),
      winners: roundWinners,
      house: houseResult({
        sales: salesByRound.get(r.id) ?? 0,
        prizes: roundWinners.reduce((sum, w) => sum + w.prize, 0),
        gifts: Number(r.margin_gifts ?? 0),
        unsoldLosing: Number(r.margin_unsold_losing ?? 0),
        unsoldWinning: Number(r.margin_unsold_winning ?? 0),
      }),
    }
  })

  const sumOf = (pick: (h: RoundReport["house"]) => number) =>
    roundReports.reduce((sum, r) => sum + pick(r.house), 0)

  const players: PlayerReport[] = (sessionPlayers.data ?? [])
    .map((p) => ({
      id: p.player_id,
      name: playerNames.get(p.player_id) ?? "Jugador",
      removed: p.removed_at !== null,
      opening: Number(p.opening_balance),
      ...(totals.get(p.player_id) ?? { played: 0, prizes: 0, recharges: 0, payouts: 0 }),
      closing: Number(p.balance),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"))

  const settlementPlayers = settlement.data?.settlement_players ?? []
  const endedAt = g.ended_at ? Date.parse(g.ended_at) : Date.now()

  return {
    id: g.id,
    number: g.number,
    status: toStatus(g.status),
    startedAtLabel: formatHouseDateTime(g.started_at, timeZone),
    endedAtLabel: g.ended_at ? formatHouseDateTime(g.ended_at, timeZone) : null,
    durationMs: endedAt - Date.parse(g.started_at),
    // Summed from the rounds; it equals game_sessions.house_balance (checked
    // in the Phase 6a acceptance).
    house: houseResult({
      sales: sumOf((h) => h.sales),
      prizes: sumOf((h) => h.prizes),
      gifts: sumOf((h) => h.gifts),
      unsoldLosing: sumOf((h) => h.unsoldLosing),
      unsoldWinning: sumOf((h) => h.unsoldWinning),
    }),
    roundsPlayed: roundReports.filter((r) => r.played).length,
    ticketsCount: tickets.data?.length ?? 0,
    rounds: roundReports,
    players,
    cash: [...cash.values()],
    settlement: settlement.data
      ? {
          status: settlement.data.status === "closed" ? "closed" : "open",
          unresolved: settlementPlayers.filter((p) => p.resolution === null).length,
          received: settlementPlayers.reduce((sum, p) => sum + Number(p.received), 0),
          paid: settlementPlayers.reduce((sum, p) => sum + Number(p.paid), 0),
        }
      : null,
    activity: ledger.map(toActivityEntry).reverse(),
    labels: {
      players: [...playerNames].map(([id, name]) => ({ id, name })),
      tickets: (tickets.data ?? []).map((t) => ({ id: t.id, index: t.index })),
      rounds: roundReports.map((r) => ({ id: r.id, seq: r.seq, name: r.name })),
    },
  }
}

/** Closed rounds of a game session, newest first (the live game's history). */
export async function fetchClosedRounds(
  supabase: Client,
  gameSessionId: number,
  timeZone: string
): Promise<RoundReport[]> {
  const report = await fetchGameSessionReport(supabase, gameSessionId, timeZone)
  return (report?.rounds ?? []).filter((r) => r.status === "closed").reverse()
}

/** What one player did in each round of a game session ("Ver rondas"). */
export async function fetchPlayerRounds(
  supabase: Client,
  gameSessionId: number,
  playerId: number
): Promise<PlayerRoundReport[]> {
  const [rounds, tickets, ledger] = await Promise.all([
    supabase
      .from("game_session_rounds")
      .select("id, seq, name, line_price, prizes, winning_numbers")
      .eq("game_session_id", gameSessionId)
      .order("seq"),
    supabase.from("tickets").select("id, index").eq("game_session_id", gameSessionId),
    readLedger(supabase, gameSessionId, playerId),
  ])
  if (rounds.error) throw rounds.error
  if (tickets.error) throw tickets.error

  const ticketIndex = new Map(tickets.data.map((t) => [t.id, t.index]))
  const position = (row: LedgerRow): NumberPosition => ({
    ticketIndex: row.ticket_id !== null ? (ticketIndex.get(row.ticket_id) ?? 0) : 0,
    number: row.number ?? 0,
  })

  const byRound = new Map<number | null, PlayerRoundReport>()
  const entryFor = (roundId: number | null): PlayerRoundReport => {
    const existing = byRound.get(roundId)
    if (existing) return existing
    const round = rounds.data.find((r) => r.id === roundId)
    const entry: PlayerRoundReport = {
      roundId,
      seq: round?.seq ?? 0,
      name: round?.name ?? "Fuera de ronda",
      winningNumbers: round ? round.prizes.map((_, i) => round.winning_numbers[i] ?? null) : [],
      played: 0,
      bought: [],
      gifted: [],
      keptCount: 0,
      wins: [],
      recharges: 0,
      payouts: 0,
    }
    byRound.set(roundId, entry)
    return entry
  }

  for (const row of ledger) {
    const amount = Number(row.amount ?? 0)
    const sale = saleAmount(row.type, row.amount)
    const touches =
      sale !== 0 || ["prize_won", "recharge", "payout", "number_gifted"].includes(row.type)
    if (!touches) continue
    const entry = entryFor(row.round_id)
    entry.played += sale
    if (row.type === "number_purchased" || (row.type === "number_reassigned" && amount > 0)) {
      entry.bought.push(position(row))
    } else if (row.type === "number_gifted") {
      entry.gifted.push(position(row))
    } else if (row.type === "carryover_kept") {
      const linePrice = Number(rounds.data.find((r) => r.id === row.round_id)?.line_price ?? 0)
      if (linePrice > 0) entry.keptCount += Math.round(amount / linePrice)
    } else if (row.type === "prize_won") {
      entry.wins.push({ ...position(row), prize: amount })
    } else if (row.type === "recharge") {
      entry.recharges += amount
    } else if (row.type === "payout") {
      entry.payouts += -amount
    }
  }

  return [...byRound.values()].sort((a, b) => b.seq - a.seq)
}
