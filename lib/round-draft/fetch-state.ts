import type { SupabaseClient } from "@supabase/supabase-js"

import { isBank } from "@/lib/banks"
import { toActivityEntry } from "@/lib/game-report/fetch"
import { isPaymentMethod } from "@/lib/payment-methods"
import type { Database } from "@/lib/supabase/database.types"

import {
  MAX_ACTIVITY_ENTRIES,
  type DraftPlayer,
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
        "player_id, balance, checked_in, pending_carryover, removed_at, players(name, payment_method, bank)"
      )
      .eq("game_session_id", id),
    supabase.from("tickets").select("id, index").eq("game_session_id", id).order("index"),
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
      .select("id, created_at, type, player_id, round_id, ticket_id, number, amount, payment_method, note")
      .eq("game_session_id", id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(MAX_ACTIVITY_ENTRIES),
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
      .select("id, number, house_balance, started_at")
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
  const [catalog, accounts, sessionPlayers, tickets, numbers, rounds, activity] =
    knownRows !== null && knownGameSessionId === id
      ? knownRows
      : await readGameSessionRows(supabase, houseId, id)
  for (const result of [catalog, accounts, sessionPlayers, tickets, numbers, rounds, activity]) {
    if (result.error) throw result.error
  }

  // Catalog players (with their account balance, which becomes their opening
  // balance when they join) plus every player of this game session,
  // including ones deactivated in the catalog since.
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
    tickets: (tickets.data ?? []).map((t) => ({
      id: t.id,
      index: t.index,
      numbers: (numbersByTicket.get(t.id) ?? []).sort((a, b) => a.number - b.number),
    })),
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
    houseBalance: Number(gameSession.house_balance),
    gameStartedAt: Date.parse(gameSession.started_at),
  }
}
