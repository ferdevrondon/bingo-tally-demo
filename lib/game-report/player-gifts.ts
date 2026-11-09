import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"

import { buildRoundGifts, type GiftLedgerRow } from "./gifts"
import type { RoundWinnerReport } from "./types"

// A player's gifts in a game session ("Regalos de NAME": the gift box button
// on the live game's player card and, for the active game session, on
// /players).
// Only effective gifts count, as in the round history's "Regalados" tab
// (buildRoundGifts): a number still gifted in a played round, or in the open
// one; a gift taken back, released or handed over doesn't, nor one in a round
// closed with no winning numbers (it was refunded with everything else).
// Takes the Supabase client, like ./fetch.ts; RLS limits rows to the house.

type Client = SupabaseClient<Database>

export interface PlayerGiftEntry {
  playerId: number
  gameSessionId: number
  gameNumber: number
  /** When the game session started (ISO). */
  startedAt: string
  roundId: number
  roundSeq: number
  roundName: string
  ticketIndex: number
  number: number
  /** What the gift is worth: the line price (never money). */
  value: number
  won: boolean
  /** What a winning gift was paid (prize - line price); null otherwise. */
  paid: number | null
  /** In the round still in play. */
  open: boolean
}

export interface GiftSummary {
  count: number
  value: number
  wins: number
  paid: number
}

/** The ledger rows that open or close a gift (a released or handed-over gift
 *  carries no money). */
export const GIFT_ROWS_FILTER =
  "type.in.(number_gifted,number_ungifted),and(type.in.(number_released,number_reassigned),amount.eq.0)"

export interface GiftHistoryRow extends GiftLedgerRow {
  round_id: number | null
}

export interface GiftHistoryRound {
  id: number
  seq: number
  name: string
  status: string
  linePrice: number
  winningNumbers: (number | null)[]
  gameSessionId: number
  gameNumber: number
  startedAt: string
}

export interface GiftHistoryWinner {
  roundId: number
  playerId: number
  ticketId: number
  number: number
  slot: number
  prize: number
}

/** The gifts of the rows (oldest first), newest game session and round
 *  first, then by number. Pure: the reads are in fetchGiftHistory. */
export function assembleGiftHistory(
  rows: GiftHistoryRow[],
  rounds: GiftHistoryRound[],
  winners: GiftHistoryWinner[],
  ticketIndex: Map<number, number>
): PlayerGiftEntry[] {
  const rowsByRound = new Map<number, GiftLedgerRow[]>()
  for (const row of rows) {
    if (row.round_id === null) continue
    const list = rowsByRound.get(row.round_id) ?? []
    list.push(row)
    rowsByRound.set(row.round_id, list)
  }
  const winnersByRound = new Map<number, RoundWinnerReport[]>()
  for (const w of winners) {
    const list = winnersByRound.get(w.roundId) ?? []
    list.push({
      playerId: w.playerId,
      playerName: "",
      ticketIndex: ticketIndex.get(w.ticketId) ?? 0,
      number: w.number,
      slot: w.slot,
      prize: w.prize,
    })
    winnersByRound.set(w.roundId, list)
  }

  const entries: PlayerGiftEntry[] = []
  for (const round of rounds) {
    const open = round.status === "open"
    const played = round.status === "closed" && round.winningNumbers.some((n) => n !== null)
    if (!open && !played) continue
    const gifts = buildRoundGifts(
      rowsByRound.get(round.id) ?? [],
      { linePrice: round.linePrice },
      winnersByRound.get(round.id) ?? [],
      new Map(),
      ticketIndex
    )
    for (const gift of gifts) {
      entries.push({
        playerId: gift.playerId,
        gameSessionId: round.gameSessionId,
        gameNumber: round.gameNumber,
        startedAt: round.startedAt,
        roundId: round.id,
        roundSeq: round.seq,
        roundName: round.name,
        ticketIndex: gift.ticketIndex,
        number: gift.number,
        value: gift.value,
        won: gift.won,
        paid: gift.paid,
        open,
      })
    }
  }
  return entries.sort(
    (a, b) =>
      b.startedAt.localeCompare(a.startedAt) ||
      b.gameSessionId - a.gameSessionId ||
      b.roundSeq - a.roundSeq ||
      a.number - b.number ||
      a.ticketIndex - b.ticketIndex
  )
}

export function summarizeGifts(entries: PlayerGiftEntry[]): GiftSummary {
  return entries.reduce<GiftSummary>(
    (sum, e) => ({
      count: sum.count + 1,
      value: sum.value + e.value,
      wins: sum.wins + (e.won ? 1 : 0),
      paid: sum.paid + (e.paid ?? 0),
    }),
    { count: 0, value: 0, wins: 0, paid: 0 }
  )
}

/** The entries grouped by game session, then by round, keeping their order. */
export function groupGiftHistory(entries: PlayerGiftEntry[]) {
  const sessions: {
    gameSessionId: number
    gameNumber: number
    startedAt: string
    rounds: { roundId: number; roundSeq: number; roundName: string; open: boolean; gifts: PlayerGiftEntry[] }[]
  }[] = []
  for (const entry of entries) {
    let session = sessions.at(-1)
    if (!session || session.gameSessionId !== entry.gameSessionId) {
      session = {
        gameSessionId: entry.gameSessionId,
        gameNumber: entry.gameNumber,
        startedAt: entry.startedAt,
        rounds: [],
      }
      sessions.push(session)
    }
    let round = session.rounds.at(-1)
    if (!round || round.roundId !== entry.roundId) {
      round = {
        roundId: entry.roundId,
        roundSeq: entry.roundSeq,
        roundName: entry.roundName,
        open: entry.open,
        gifts: [],
      }
      session.rounds.push(round)
    }
    round.gifts.push(entry)
  }
  return sessions
}

const PAGE = 1000

/** Every page of a query (PostgREST returns at most 1000 rows at a time). */
async function readAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const all: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1)
    if (error) throw error
    all.push(...(data ?? []))
    if (!data || data.length < PAGE) return all
  }
}

/** The effective gifts of a game session, or of one of its players. */
export async function fetchGiftHistory(
  supabase: Client,
  { gameSessionId, playerId }: { gameSessionId: number; playerId?: number }
): Promise<PlayerGiftEntry[]> {
  const rows = await readAll((from, to) => {
    let query = supabase
      .from("activity_log")
      .select("round_id, player_id, ticket_id, number, type, amount")
      .eq("game_session_id", gameSessionId)
      .not("player_id", "is", null)
      .or(GIFT_ROWS_FILTER)
    if (playerId !== undefined) query = query.eq("player_id", playerId)
    return query.order("created_at").order("id").range(from, to)
  })
  const roundIds = [...new Set(rows.map((r) => r.round_id).filter((id): id is number => id !== null))]
  if (roundIds.length === 0) return []

  const [rounds, winners] = await Promise.all([
    supabase
      .from("game_session_rounds")
      .select(
        "id, seq, name, status, line_price, winning_numbers, game_session_id, game_sessions(number, started_at)"
      )
      .in("id", roundIds),
    supabase
      .from("round_winners")
      .select("round_id, player_id, ticket_id, number, slot, prize")
      .in("round_id", roundIds)
      .order("slot")
      .order("id"),
  ])
  if (rounds.error) throw rounds.error
  if (winners.error) throw winners.error

  const ticketIds = [
    ...new Set([
      ...rows.map((r) => r.ticket_id).filter((id): id is number => id !== null),
      ...(winners.data ?? []).map((w) => w.ticket_id),
    ]),
  ]
  const tickets = await supabase.from("tickets").select("id, index").in("id", ticketIds)
  if (tickets.error) throw tickets.error

  return assembleGiftHistory(
    rows,
    (rounds.data ?? []).map((r) => ({
      id: r.id,
      seq: r.seq,
      name: r.name,
      status: r.status,
      linePrice: Number(r.line_price),
      winningNumbers: r.winning_numbers,
      gameSessionId: r.game_session_id,
      gameNumber: r.game_sessions?.number ?? 0,
      startedAt: r.game_sessions?.started_at ?? "",
    })),
    (winners.data ?? []).map((w) => ({
      roundId: w.round_id,
      playerId: w.player_id,
      ticketId: w.ticket_id,
      number: w.number,
      slot: w.slot,
      prize: Number(w.prize),
    })),
    new Map((tickets.data ?? []).map((t) => [t.id, t.index]))
  )
}
