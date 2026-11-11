import type { SupabaseClient } from "@supabase/supabase-js"

import { isBank } from "@/lib/banks"
import { toActivityEntry } from "@/lib/game-report/fetch"
import { assembleGiftHistory, GIFT_ROWS_FILTER } from "@/lib/game-report/player-gifts"
import { isPaymentMethod } from "@/lib/payment-methods"
import { toRoundKind } from "@/lib/rounds"
import type { Database } from "@/lib/supabase/database.types"

import {
  EMPTY_SESSION_TOTALS,
  MAX_ACTIVITY_ENTRIES,
  type DraftPlayer,
  type PlayerSessionTotals,
  type RoundDraftState,
  type Ticket,
} from "./types"

// Everything of game session `id` besides its own row, read in parallel.
function readGameSessionRows(supabase: SupabaseClient<Database>, houseId: number, id: number) {
  return Promise.all([
    supabase
      .from("players")
      .select("id, name, payment_method, bank")
      .eq("house_id", houseId)
      .eq("active", true)
      .order("id"),
    supabase.from("player_accounts").select("player_id, balance").eq("house_id", houseId),
    supabase
      .from("game_session_players")
      .select(
        "player_id, balance, opening_balance, checked_in, pending_carryover, removed_at, players(name, payment_method, bank)"
      )
      .eq("game_session_id", id),
    supabase
      .from("tickets")
      .select("id, index, removed_at")
      .eq("game_session_id", id)
      .order("index"),
    supabase
      .from("ticket_numbers")
      .select("ticket_id, number, player_id, is_gift")
      .eq("game_session_id", id),
    supabase
      .from("game_session_rounds")
      .select("id, seq, name, line_price, prizes, status, winning_numbers, round_template_id")
      .eq("game_session_id", id)
      .order("seq"),
    supabase
      .from("activity_log")
      .select("id, created_at, type, player_id, round_id, ticket_id, number, amount, payment_method, note, bank, corrects_id, counterparty_player_id, transfer_id")
      .eq("game_session_id", id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(MAX_ACTIVITY_ENTRIES),
    // The rows that open or close a gift, for who has gifts this game session.
    supabase
      .from("activity_log")
      .select("round_id, player_id, ticket_id, number, type, amount")
      .eq("game_session_id", id)
      .not("player_id", "is", null)
      .or(GIFT_ROWS_FILTER)
      .order("created_at")
      .order("id"),
    // The rows besides the plays that move a player's balance, over the whole
    // game session (the activity above is capped), summed per player for the
    // removal summary.
    supabase
      .from("activity_log")
      .select("player_id, type, amount")
      .eq("game_session_id", id)
      .in("type", ["recharge", "prize_won", "payout", "balance_transfer"])
      .not("player_id", "is", null),
    // The cycle of an automatic game session (none in manual).
    supabase
      .from("game_session_round_pattern")
      .select("position, round_template_id, repeat_count, round_templates(name, kind, active)")
      .eq("game_session_id", id)
      .order("position"),
  ])
}

// The house's active game session as the live game's state, or null when
// there is none. Takes the Supabase client so the same read runs on the
// server (app/(app)/(game)/layout.tsx via lib/data/load-game-session.ts) and
// in the browser (the provider's background re-sync). RLS limits it to houses
// the user belongs to.
export async function fetchGameSessionState(
  supabase: SupabaseClient<Database>,
  houseId: number,
  /** The game session the caller already shows (the browser re-sync): its
   *  rows are read together with the active game session, in one round trip
   *  instead of two. */
  knownGameSessionId: number | null = null
): Promise<RoundDraftState | null> {
  const [{ data: gameSession, error }, knownRows] = await Promise.all([
    supabase
      .from("game_sessions")
      .select("id, number, house_balance, started_at, round_mode")
      .eq("house_id", houseId)
      .eq("status", "active")
      .maybeSingle(),
    knownGameSessionId === null
      ? null
      : readGameSessionRows(supabase, houseId, knownGameSessionId),
  ])
  if (error) throw error
  if (!gameSession) return null

  const id = gameSession.id
  const [
    catalog,
    accounts,
    sessionPlayers,
    tickets,
    numbers,
    rounds,
    activity,
    giftRows,
    totalRows,
    patternRows,
  ] =
    knownRows !== null && knownGameSessionId === id
      ? knownRows
      : await readGameSessionRows(supabase, houseId, id)
  for (const result of [
    catalog,
    accounts,
    sessionPlayers,
    tickets,
    numbers,
    rounds,
    activity,
    giftRows,
    totalRows,
    patternRows,
  ]) {
    if (result.error) throw result.error
  }

  // Catalog players (with their account balance, which becomes their opening
  // balance when they join) plus every player of this game session,
  // including ones deactivated in the catalog since.
  const totalsByPlayer = new Map<number, PlayerSessionTotals>()
  for (const row of totalRows.data ?? []) {
    if (row.player_id === null) continue
    const totals = { ...(totalsByPlayer.get(row.player_id) ?? EMPTY_SESSION_TOTALS) }
    const amount = Number(row.amount ?? 0)
    if (row.type === "recharge") totals.recharges += amount
    else if (row.type === "prize_won") totals.prizes += amount
    else if (row.type === "payout") totals.payouts += amount
    else if (row.type === "balance_transfer") totals.transfers += amount
    totalsByPlayer.set(row.player_id, totals)
  }
  const accountBalance = new Map(
    (accounts.data ?? []).map((a) => [a.player_id, Number(a.balance)])
  )
  const playersById = new Map<number, DraftPlayer>(
    (catalog.data ?? []).map((p) => [
      p.id,
      {
        id: p.id,
        name: p.name,
        paymentMethod: isPaymentMethod(p.payment_method) ? p.payment_method : null,
        bank: isBank(p.bank) ? p.bank : null,
        balance: accountBalance.get(p.id) ?? 0,
        openingBalance: accountBalance.get(p.id) ?? 0,
        totals: EMPTY_SESSION_TOTALS,
        checkedIn: false,
        pendingCarryOverDecision: false,
        inSession: false,
        removed: false,
      },
    ])
  )
  for (const row of sessionPlayers.data ?? []) {
    playersById.set(row.player_id, {
      id: row.player_id,
      name: row.players?.name ?? "Jugador",
      paymentMethod: isPaymentMethod(row.players?.payment_method)
        ? row.players.payment_method
        : null,
      bank: isBank(row.players?.bank) ? row.players.bank : null,
      balance: Number(row.balance),
      openingBalance: Number(row.opening_balance),
      totals: totalsByPlayer.get(row.player_id) ?? EMPTY_SESSION_TOTALS,
      checkedIn: row.checked_in,
      pendingCarryOverDecision: row.pending_carryover,
      inSession: true,
      removed: row.removed_at !== null,
    })
  }

  const numbersByTicket = new Map<number, Ticket["numbers"]>()
  for (const row of numbers.data ?? []) {
    const list = numbersByTicket.get(row.ticket_id) ?? []
    list.push({ number: row.number, playerId: row.player_id, isGift: row.is_gift })
    numbersByTicket.set(row.ticket_id, list)
  }

  const roundRows = rounds.data ?? []
  const open = roundRows.find((r) => r.status === "open") ?? null
  const prizes = open ? open.prizes.map(Number) : []

  return {
    gameSessionId: id,
    gameNumber: gameSession.number,
    tickets: (tickets.data ?? [])
      .filter((t) => t.removed_at === null)
      .map((t) => ({
        id: t.id,
        index: t.index,
        numbers: (numbersByTicket.get(t.id) ?? []).sort((a, b) => a.number - b.number),
      })),
    removedTickets: (tickets.data ?? [])
      .filter((t) => t.removed_at !== null)
      .map((t) => ({ id: t.id, index: t.index })),
    players: [...playersById.values()],
    activePlayerId: null,
    activity: (activity.data ?? []).map(toActivityEntry),
    round: open
      ? {
          roundId: open.id,
          templateId: open.round_template_id,
          seq: open.seq,
          name: open.name,
          linePrice: Number(open.line_price),
          prizes,
        }
      : null,
    rounds: roundRows.map((r) => ({ id: r.id, seq: r.seq, name: r.name })),
    winningNumbers: open
      ? prizes.map((_, i) => open.winning_numbers[i] ?? null)
      : [],
    roundsPlayed: roundRows.filter((r) => r.status === "closed").length,
    giftedPlayerIds: [
      ...new Set(
        assembleGiftHistory(
          giftRows.data ?? [],
          roundRows.map((r) => ({
            id: r.id,
            seq: r.seq,
            name: r.name,
            status: r.status,
            linePrice: Number(r.line_price),
            winningNumbers: r.winning_numbers,
            gameSessionId: id,
            gameNumber: gameSession.number,
            startedAt: gameSession.started_at,
          })),
          [],
          new Map((tickets.data ?? []).map((t) => [t.id, t.index]))
        ).map((gift) => gift.playerId)
      ),
    ],
    houseBalance: Number(gameSession.house_balance),
    gameStartedAt: Date.parse(gameSession.started_at),
    roundMode: gameSession.round_mode === "auto" ? "auto" : "manual",
    pattern: (patternRows.data ?? []).map((row) => ({
      roundTemplateId: row.round_template_id,
      repeatCount: row.repeat_count,
      name: row.round_templates?.name ?? "Ronda",
      kind: toRoundKind(row.round_templates?.kind),
      active: row.round_templates?.active ?? false,
    })),
  }
}
