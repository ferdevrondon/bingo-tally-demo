import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js"

import { SESSION_REPLACED_PATH } from "@/lib/admin-session-paths"
import {
  toGameActionError,
  type GameActionError,
  type GameActionResult,
} from "@/lib/data/game-action-result"
import { houseResult, SALE_TYPES, saleAmount, type HouseResult } from "@/lib/game-report/ledger"
import type { PaymentMethod } from "@/lib/payment-methods"
import { createClient } from "@/lib/supabase/client"
import type { Database } from "@/lib/supabase/database.types"

export type { HouseResult }

// Live game writes, straight from the browser to the SQL functions of the
// game session functions migration with supabase.rpc() (BACKEND_PLAN.md
// "Architecture decisions"). The functions are the guard: they check the
// house admin and the claimed login session, compute every amount and are
// idempotent by request_id. Going direct keeps each tap to one request, with
// no Server Action queue or router refresh in between.

type Client = SupabaseClient<Database>
type RpcResponse<T> = PromiseLike<{ data: T | null; error: PostgrestError | null }>

export interface NumberEdit {
  ticketId: number
  number: number
  /** true: the player ends up owning it; false: released. */
  owned: boolean
  isGift: boolean
  /** Owner the screen showed, for numbers taken from another player. */
  expectedOwnerId: number | null
}

export interface GameSessionSummary {
  roundsPlayed: number
  house: HouseResult
  playersCount: number
  /** What players owe the house (sum of negative balances, as a positive amount). */
  owedByPlayers: number
  /** What the house owes players (sum of positive balances). */
  owedToPlayers: number
  durationMs: number
}

export interface RoundWinnerEntry {
  playerId: number
  ticketId: number
  number: number
  slot: number
  prize: number
}

/** A closed round, for the summary shown when it closes (business rule F). */
export interface ClosedRoundSummary {
  seq: number
  name: string
  prizes: number[]
  winningNumbers: (number | null)[]
  winners: RoundWinnerEntry[]
  house: HouseResult
}

type Position = { ticketId: number; number: number }

// The generated RPC types mark every argument as non-null; these SQL
// parameters accept null.
function nullable<T>(value: T | null): T {
  return value as T
}

// not_admin (42501): an admin whose login session was taken by another
// device is signed out here (same as components/admin-session-guard.tsx);
// anyone else is read-only.
async function rejectNotAdmin(supabase: Client, isAdmin: boolean): Promise<GameActionError> {
  if (!isAdmin) return "read_only"
  const { data: status } = await supabase.rpc("admin_session_status")
  if (status === "mine") return "failed"
  await supabase.auth.signOut({ scope: "local" })
  window.location.replace(SESSION_REPLACED_PATH)
  return "session_replaced"
}

export function createGameApi(isAdmin: boolean) {
  const supabase = createClient()

  async function run<T>(call: (s: Client) => RpcResponse<T>): Promise<GameActionResult<T>> {
    const { data, error } = await call(supabase)
    if (!error) return { ok: true, data: data as T }
    if (error.code === "42501") return { ok: false, error: await rejectNotAdmin(supabase, isAdmin) }
    const code = toGameActionError(error.message)
    if (code === "failed") console.error("game session action failed", error)
    return { ok: false, error: code }
  }

  return {
    addTicket: (gameSessionId: number, requestId: string) =>
      run((s) => s.rpc("add_ticket", { p_game_session_id: gameSessionId, p_request_id: requestId })),

    startRound: (gameSessionId: number, roundTemplateId: number, requestId: string) =>
      run((s) =>
        s.rpc("start_round", {
          p_game_session_id: gameSessionId,
          p_round_template_id: roundTemplateId,
          p_request_id: requestId,
        })
      ),

    purchaseNumber: (position: Position, playerId: number, requestId: string) =>
      run((s) =>
        s.rpc("record_purchase", {
          p_ticket_id: position.ticketId,
          p_number: position.number,
          p_player_id: playerId,
          p_request_id: requestId,
        })
      ),

    releaseNumber: (position: Position, playerId: number, requestId: string) =>
      run((s) =>
        s.rpc("release_number", {
          p_ticket_id: position.ticketId,
          p_number: position.number,
          p_player_id: playerId,
          p_request_id: requestId,
        })
      ),

    toggleGift: (position: Position, playerId: number, requestId: string) =>
      run((s) =>
        s.rpc("toggle_gift", {
          p_ticket_id: position.ticketId,
          p_number: position.number,
          p_player_id: playerId,
          p_request_id: requestId,
        })
      ),

    // "Editar jugada": every change of the dialog in one transaction.
    editPlayerNumbers: (
      gameSessionId: number,
      playerId: number,
      changes: NumberEdit[],
      requestId: string
    ) =>
      run((s) =>
        s.rpc("edit_player_numbers", {
          p_game_session_id: gameSessionId,
          p_player_id: playerId,
          p_changes: changes.map((c) => ({
            ticket_id: c.ticketId,
            number: c.number,
            owned: c.owned,
            is_gift: c.isGift,
            expected_owner_id: c.expectedOwnerId,
          })),
          p_request_id: requestId,
        })
      ),

    rechargeBalance: (
      gameSessionId: number,
      playerId: number,
      amount: number,
      paymentMethod: PaymentMethod,
      note: string | null,
      requestId: string
    ) =>
      run((s) =>
        s.rpc("record_recharge", {
          p_game_session_id: gameSessionId,
          p_player_id: playerId,
          p_amount: amount,
          p_payment_method: paymentMethod,
          p_note: nullable(note),
          p_request_id: requestId,
        })
      ),

    // Check-in (rule A): "in this round", no money.
    checkIn: (gameSessionId: number, playerId: number, requestId: string) =>
      run((s) =>
        s.rpc("record_check_in", {
          p_game_session_id: gameSessionId,
          p_player_id: playerId,
          p_request_id: requestId,
        })
      ),

    undoCheckIn: (gameSessionId: number, playerId: number, requestId: string) =>
      run((s) =>
        s.rpc("undo_check_in", {
          p_game_session_id: gameSessionId,
          p_player_id: playerId,
          p_request_id: requestId,
        })
      ),

    awardPrize: (roundId: number, slot: number, number: number, requestId: string) =>
      run((s) =>
        s.rpc("award_prize", {
          p_round_id: roundId,
          p_slot: slot,
          p_number: number,
          p_request_id: requestId,
        })
      ),

    closeRound: (roundId: number, nextRoundTemplateId: number, requestId: string) =>
      run((s) =>
        s.rpc("close_round", {
          p_round_id: roundId,
          p_next_round_template_id: nextRoundTemplateId,
          p_request_id: requestId,
        })
      ),

    resolveCarryover: (
      gameSessionId: number,
      playerId: number,
      release: Position[],
      requestId: string
    ) =>
      run((s) =>
        s.rpc("resolve_carryover", {
          p_game_session_id: gameSessionId,
          p_player_id: playerId,
          p_release: release.map((r) => ({ ticket_id: r.ticketId, number: r.number })),
          p_request_id: requestId,
        })
      ),

    removePlayer: (gameSessionId: number, playerId: number, requestId: string) =>
      run((s) =>
        s.rpc("remove_player", {
          p_game_session_id: gameSessionId,
          p_player_id: playerId,
          p_request_id: requestId,
        })
      ),

    endGameSession: (gameSessionId: number, requestId: string) =>
      run((s) =>
        s.rpc("end_game_session", { p_game_session_id: gameSessionId, p_request_id: requestId })
      ),

    discardGameSession: (gameSessionId: number, requestId: string) =>
      run((s) =>
        s.rpc("discard_game_session", {
          p_game_session_id: gameSessionId,
          p_request_id: requestId,
        })
      ),

    // The summary of a closed round (rule F), read after close_round.
    fetchRoundSummary: async (roundId: number): Promise<ClosedRoundSummary | null> => {
      const [round, winners, sales] = await Promise.all([
        supabase
          .from("game_session_rounds")
          .select(
            "seq, name, prizes, winning_numbers, margin_gifts, margin_unsold_losing, margin_unsold_winning"
          )
          .eq("id", roundId)
          .single(),
        supabase
          .from("round_winners")
          .select("player_id, ticket_id, number, slot, prize")
          .eq("round_id", roundId)
          .order("slot")
          .order("id"),
        supabase
          .from("activity_log")
          .select("type, amount")
          .eq("round_id", roundId)
          .in("type", [...SALE_TYPES, "adjustment"]),
      ])
      if (round.error || winners.error || sales.error) return null
      const winnerRows = winners.data.map(
        (w): RoundWinnerEntry => ({
          playerId: w.player_id,
          ticketId: w.ticket_id,
          number: w.number,
          slot: w.slot,
          prize: Number(w.prize),
        })
      )
      return {
        seq: round.data.seq,
        name: round.data.name,
        prizes: round.data.prizes.map(Number),
        winningNumbers: round.data.winning_numbers,
        winners: winnerRows,
        house: houseResult({
          sales: sales.data.reduce((sum, a) => sum + saleAmount(a.type, a.amount), 0),
          prizes: winnerRows.reduce((sum, w) => sum + w.prize, 0),
          gifts: Number(round.data.margin_gifts ?? 0),
          unsoldLosing: Number(round.data.margin_unsold_losing ?? 0),
          unsoldWinning: Number(round.data.margin_unsold_winning ?? 0),
        }),
      }
    },

    // The end-of-game-session summary, read after end_game_session. Sales are
    // derived from house_balance (sales - prizes + margins), so the ledger
    // doesn't need to be read row by row.
    fetchSummary: async (gameSessionId: number): Promise<GameSessionSummary | null> => {
      const [gameSession, rounds, winners, players] = await Promise.all([
        supabase
          .from("game_sessions")
          .select("house_balance, started_at, ended_at")
          .eq("id", gameSessionId)
          .single(),
        supabase
          .from("game_session_rounds")
          .select("winning_numbers, margin_gifts, margin_unsold_losing, margin_unsold_winning")
          .eq("game_session_id", gameSessionId)
          .eq("status", "closed"),
        supabase.from("round_winners").select("prize").eq("game_session_id", gameSessionId),
        supabase
          .from("game_session_players")
          .select("balance, removed_at")
          .eq("game_session_id", gameSessionId),
      ])
      if (gameSession.error || rounds.error || winners.error || players.error) return null
      const closedRounds = rounds.data
      const sum = (values: (number | null)[]) =>
        values.reduce<number>((total, v) => total + Number(v ?? 0), 0)
      const gifts = sum(closedRounds.map((r) => r.margin_gifts))
      const unsoldLosing = sum(closedRounds.map((r) => r.margin_unsold_losing))
      const unsoldWinning = sum(closedRounds.map((r) => r.margin_unsold_winning))
      const prizes = sum(winners.data.map((w) => w.prize))
      const total = Number(gameSession.data.house_balance)
      const balances = players.data.map((p) => Number(p.balance))
      return {
        // A round closed without winning numbers was never played.
        roundsPlayed: closedRounds.filter((r) => r.winning_numbers.some((n) => n !== null))
          .length,
        house: houseResult({
          sales: total + prizes - gifts - unsoldLosing - unsoldWinning,
          prizes,
          gifts,
          unsoldLosing,
          unsoldWinning,
        }),
        playersCount: players.data.filter((p) => p.removed_at === null).length,
        owedByPlayers: -sum(balances.filter((b) => b < 0)),
        owedToPlayers: sum(balances.filter((b) => b > 0)),
        durationMs:
          Date.parse(gameSession.data.ended_at ?? gameSession.data.started_at) -
          Date.parse(gameSession.data.started_at),
      }
    },
  }
}

export type GameApi = ReturnType<typeof createGameApi>
