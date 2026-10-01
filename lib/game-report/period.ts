import type { SupabaseClient } from "@supabase/supabase-js"

import { isRecordedPaymentMethod, type RecordedPaymentMethod } from "@/lib/payment-methods"
import type { Database } from "@/lib/supabase/database.types"

import {
  formatDayShort,
  formatHouseDateTime,
  formatPeriod,
  houseDayOf,
  houseDayRange,
  nextDay,
} from "./format"
import { houseResult, saleAmount } from "./ledger"
import type { PeriodCashLine, PeriodDay, PeriodReport } from "./types"

// Reportes → Diario / Mensual (BACKEND_PLAN.md Phase 6b2): what happened in a
// period of the house, computed in TypeScript from the ledger. A game session
// counts on the day it started; a cash move on the day it was registered,
// both in the house's time zone. Cash has two origins: in a game session
// (the row has a game_session_id) and outside one (settlement and /players).

type Client = SupabaseClient<Database>

const PAGE_SIZE = 1000
const TOP = 5

// The API returns at most 1000 rows per request.
async function readPaged<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1)
    if (error) throw error
    rows.push(...(data ?? []))
    if ((data ?? []).length < PAGE_SIZE) return rows
  }
}

function daysBetween(from: string, to: string): string[] {
  const days: string[] = []
  for (let day = from; day <= to; day = nextDay(day)) days.push(day)
  return days
}

function top(totals: Map<number, number>, names: Map<number, string>) {
  return [...totals]
    .filter(([, amount]) => amount > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP)
    .map(([playerId, amount]) => ({ playerId, name: names.get(playerId) ?? "Jugador", amount }))
}

/** The report of the house's days `from`..`to` (inclusive, "YYYY-MM-DD"). */
export async function fetchPeriodReport(
  supabase: Client,
  houseId: number,
  from: string,
  to: string,
  timeZone: string
): Promise<PeriodReport> {
  const start = houseDayRange(from, timeZone).start
  const end = houseDayRange(to, timeZone).end

  const [sessions, cashRows, players] = await Promise.all([
    supabase
      .from("game_sessions")
      .select(
        "id, number, started_at, house_balance, game_session_rounds(status, winning_numbers, margin_gifts, margin_unsold_losing, margin_unsold_winning), round_winners(player_id, prize), tickets(count), game_session_players(player_id, removed_at)"
      )
      .eq("house_id", houseId)
      .gte("started_at", start)
      .lt("started_at", end)
      .order("number"),
    readPaged((a, b) =>
      supabase
        .from("activity_log")
        .select("id, created_at, type, amount, payment_method, game_session_id")
        .eq("house_id", houseId)
        .in("type", ["recharge", "payout"])
        .gte("created_at", start)
        .lt("created_at", end)
        .order("id")
        .range(a, b)
    ),
    supabase.from("players").select("id, name").eq("house_id", houseId),
  ])
  if (sessions.error) throw sessions.error
  if (players.error) throw players.error
  const names = new Map(players.data.map((p) => [p.id, p.name]))

  const sessionIds = sessions.data.map((g) => g.id)
  const ledger =
    sessionIds.length === 0
      ? []
      : await readPaged((a, b) =>
          supabase
            .from("activity_log")
            .select("id, player_id, type, amount")
            .in("game_session_id", sessionIds)
            .not("player_id", "is", null)
            .not("amount", "is", null)
            .order("id")
            .range(a, b)
        )

  // House result and who played the most (net sales per player).
  let sales = 0
  const played = new Map<number, number>()
  for (const row of ledger) {
    const sale = saleAmount(row.type, row.amount)
    if (sale === 0 || row.player_id === null) continue
    sales += sale
    played.set(row.player_id, (played.get(row.player_id) ?? 0) + sale)
  }
  let prizes = 0
  let gifts = 0
  let unsoldLosing = 0
  let unsoldWinning = 0
  let roundsPlayed = 0
  let tickets = 0
  const won = new Map<number, number>()
  const activePlayers = new Set<number>()
  const houseByDay = new Map<string, { total: number; count: number }>()
  for (const g of sessions.data) {
    for (const w of g.round_winners) {
      prizes += Number(w.prize)
      won.set(w.player_id, (won.get(w.player_id) ?? 0) + Number(w.prize))
    }
    for (const r of g.game_session_rounds) {
      if (r.status !== "closed") continue
      gifts += Number(r.margin_gifts ?? 0)
      unsoldLosing += Number(r.margin_unsold_losing ?? 0)
      unsoldWinning += Number(r.margin_unsold_winning ?? 0)
      if (r.winning_numbers.some((n) => n !== null)) roundsPlayed += 1
    }
    tickets += g.tickets[0]?.count ?? 0
    for (const p of g.game_session_players) if (p.removed_at === null) activePlayers.add(p.player_id)
    const day = houseDayOf(g.started_at, timeZone)
    const entry = houseByDay.get(day) ?? { total: 0, count: 0 }
    entry.total += Number(g.house_balance)
    entry.count += 1
    houseByDay.set(day, entry)
  }

  // Cash by payment method and origin, and the net cash of each day.
  const cash = new Map<RecordedPaymentMethod | null, PeriodCashLine>()
  const cashByDay = new Map<string, number>()
  for (const row of cashRows) {
    const method = isRecordedPaymentMethod(row.payment_method) ? row.payment_method : null
    const line = cash.get(method) ?? {
      method,
      inGame: { recharges: 0, payouts: 0 },
      outside: { recharges: 0, payouts: 0 },
    }
    const bucket = row.game_session_id !== null ? line.inGame : line.outside
    const amount = Number(row.amount ?? 0)
    // A payout's amount is negative in the ledger.
    if (row.type === "recharge") bucket.recharges += amount
    else bucket.payouts += -amount
    cash.set(method, line)
    const day = houseDayOf(row.created_at, timeZone)
    cashByDay.set(day, (cashByDay.get(day) ?? 0) + amount)
  }

  const days: PeriodDay[] = daysBetween(from, to).map((day) => ({
    day,
    label: formatDayShort(day),
    gameSessions: houseByDay.get(day)?.count ?? 0,
    houseTotal: houseByDay.get(day)?.total ?? 0,
    netCash: cashByDay.get(day) ?? 0,
  }))

  return {
    from,
    to,
    label: formatPeriod(from, to),
    house: houseResult({ sales, prizes, gifts, unsoldLosing, unsoldWinning }),
    cash: [...cash.values()],
    activity: {
      gameSessions: sessions.data.length,
      roundsPlayed,
      players: activePlayers.size,
      tickets,
    },
    topPlayers: { played: top(played, names), won: top(won, names) },
    days,
    gameSessions: sessions.data.map((g) => ({
      id: g.id,
      number: g.number,
      startedAtLabel: formatHouseDateTime(g.started_at, timeZone),
    })),
  }
}
