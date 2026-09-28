import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js"

import { SESSION_REPLACED_PATH } from "@/lib/admin-session-paths"
import {
  toGameActionError,
  type GameActionError,
  type GameActionResult,
} from "@/lib/data/game-action-result"
import type { PaymentMethod } from "@/lib/payment-methods"
import { createClient } from "@/lib/supabase/client"
import type { Database } from "@/lib/supabase/database.types"

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
  houseBalance: number
  playersCount: number
  negativeBalanceTotal: number
  durationMs: number
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

    checkIn: (
      gameSessionId: number,
      playerId: number,
      paymentMethod: PaymentMethod | null,
      requestId: string
    ) =>
      run((s) =>
        s.rpc("record_check_in", {
          p_game_session_id: gameSessionId,
          p_player_id: playerId,
          p_payment_method: nullable(paymentMethod),
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

    // The end-of-game-session summary, read after end_game_session.
    fetchSummary: async (gameSessionId: number): Promise<GameSessionSummary | null> => {
      const [gameSession, rounds, players] = await Promise.all([
        supabase
          .from("game_sessions")
          .select("house_balance, started_at, ended_at")
          .eq("id", gameSessionId)
          .single(),
        supabase
          .from("game_session_rounds")
          .select("winning_numbers")
          .eq("game_session_id", gameSessionId)
          .eq("status", "closed"),
        supabase
          .from("game_session_players")
          .select("negative_balance, removed_at")
          .eq("game_session_id", gameSessionId),
      ])
      if (gameSession.error) return null
      const sessionPlayers = players.data ?? []
      return {
        // A round closed without winning numbers was never played.
        roundsPlayed: (rounds.data ?? []).filter((r) => r.winning_numbers.some((n) => n !== null))
          .length,
        houseBalance: Number(gameSession.data.house_balance),
        playersCount: sessionPlayers.filter((p) => p.removed_at === null).length,
        negativeBalanceTotal: sessionPlayers.reduce((sum, p) => sum + Number(p.negative_balance), 0),
        durationMs:
          Date.parse(gameSession.data.ended_at ?? gameSession.data.started_at) -
          Date.parse(gameSession.data.started_at),
      }
    },
  }
}

export type GameApi = ReturnType<typeof createGameApi>
