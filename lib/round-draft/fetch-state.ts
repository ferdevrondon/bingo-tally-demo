import type { SupabaseClient } from "@supabase/supabase-js"

import { isPaymentMethod } from "@/lib/payment-methods"
import type { Database } from "@/lib/supabase/database.types"

import {
  MAX_ACTIVITY_ENTRIES,
  type ActivityEntry,
  type ActivityEntryType,
  type DraftPlayer,
  type RoundDraftState,
  type Ticket,
} from "./types"

// The house's active game session as the live game's state, or null when
// there is none. Takes the Supabase client so the same read runs on the
// server (app/(app)/(game)/layout.tsx via lib/data/load-game-session.ts) and
// in the browser (the provider's background re-sync). RLS limits it to houses
// the user belongs to.
export async function fetchGameSessionState(
  supabase: SupabaseClient<Database>,
  houseId: number
): Promise<RoundDraftState | null> {
  const { data: gameSession, error } = await supabase
    .from("game_sessions")
    .select("id, house_balance, started_at")
    .eq("house_id", houseId)
    .eq("status", "active")
    .maybeSingle()
  if (error) throw error
  if (!gameSession) return null

  const id = gameSession.id
  const [catalog, sessionPlayers, tickets, numbers, rounds, activity] = await Promise.all([
    supabase
      .from("players")
      .select("id, name, payment_method")
      .eq("house_id", houseId)
      .eq("active", true)
      .order("id"),
    supabase
      .from("game_session_players")
      .select(
        "player_id, positive_balance, negative_balance, checked_in, pending_carryover, removed_at, players(name, payment_method)"
      )
      .eq("game_session_id", id),
    supabase.from("tickets").select("id, index").eq("game_session_id", id).order("index"),
    supabase
      .from("ticket_numbers")
      .select("ticket_id, number, player_id, is_gift")
      .eq("game_session_id", id),
    supabase
      .from("game_session_rounds")
      .select("id, seq, name, kind, line_price, status, winning_numbers, round_template_id")
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
  for (const result of [catalog, sessionPlayers, tickets, numbers, rounds, activity]) {
    if (result.error) throw result.error
  }

  // Catalog players (balances 0 until they join) plus every player of this
  // game session, including ones deactivated in the catalog since.
  const playersById = new Map<number, DraftPlayer>(
    (catalog.data ?? []).map((p) => [
      p.id,
      {
        id: p.id,
        name: p.name,
        paymentMethod: isPaymentMethod(p.payment_method) ? p.payment_method : null,
        positiveBalance: 0,
        negativeBalance: 0,
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
      positiveBalance: Number(row.positive_balance),
      negativeBalance: Number(row.negative_balance),
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
  const winnerCount = open?.kind === "special" ? 2 : 1

  return {
    gameSessionId: id,
    tickets: (tickets.data ?? []).map((t) => ({
      id: t.id,
      index: t.index,
      numbers: (numbersByTicket.get(t.id) ?? []).sort((a, b) => a.number - b.number),
    })),
    players: [...playersById.values()],
    activePlayerId: null,
    activity: (activity.data ?? []).map(
      (a): ActivityEntry => ({
        id: a.id,
        timestamp: Date.parse(a.created_at),
        type: a.type as ActivityEntryType,
        playerId: a.player_id,
        roundId: a.round_id,
        ticketId: a.ticket_id,
        number: a.number,
        amount: a.amount === null ? null : Number(a.amount),
        paymentMethod: isPaymentMethod(a.payment_method) ? a.payment_method : null,
        note: a.note,
      })
    ),
    round: open
      ? {
          roundId: open.id,
          templateId: open.round_template_id,
          seq: open.seq,
          name: open.name,
          kind: open.kind === "special" ? "special" : "regular",
          linePrice: Number(open.line_price),
        }
      : null,
    rounds: roundRows.map((r) => ({ id: r.id, seq: r.seq, name: r.name })),
    winningNumbers: open
      ? Array.from({ length: winnerCount }, (_, i) => open.winning_numbers[i] ?? null)
      : [],
    roundsPlayed: roundRows.filter((r) => r.status === "closed").length,
    houseBalance: Number(gameSession.house_balance),
    gameStartedAt: Date.parse(gameSession.started_at),
  }
}
