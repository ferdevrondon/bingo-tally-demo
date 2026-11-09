import { bankLabel } from "@/lib/banks"
import { paymentMethodLabel } from "@/lib/payment-methods"
import { formatMoney } from "@/lib/rounds"

import { signedMoney } from "./balance"
import { removalSummaryParts } from "./remove-player"
import type { ActivityEntry, RoundDraftState } from "./types"

// activity_log rows carry structured data only (BACKEND_PLAN.md §3); the
// Spanish text is built here. Positions are always "Cartón N · #X", so a
// player with the same number on several tickets sees each one.

/** Names and labels a sentence needs: the live game state, or a game
 *  session report (lib/game-report). */
export type ActivityContext = {
  players: Pick<RoundDraftState["players"][number], "id" | "name">[]
  tickets: Pick<RoundDraftState["tickets"][number], "id" | "index">[]
  /** Removed tickets, still named by the rows that point to them. */
  removedTickets?: RoundDraftState["removedTickets"]
  rounds: RoundDraftState["rounds"]
}

/** The summary in the note of a player_removed row. Since
 *  *_remove_player_summary.sql it is JSON with every line; the earlier
 *  formats had {opening, prizes} (*_remove_player_prizes.sql) or the opening
 *  balance alone (*_remove_player_balances.sql), whose missing lines read as 0
 *  (`complete` false: the sentence then leaves out what it doesn't know).
 *  null on rows written before the removal summary. */
export function parseRemovalNote(note: string | null): {
  opening: number
  recharges: number
  played: number
  prizes: number
  payouts: number
  transfers: number
  complete: boolean
} | null {
  if (note === null || note.trim() === "") return null
  const empty = { recharges: 0, played: 0, prizes: 0, payouts: 0, transfers: 0 }
  const plain = Number(note)
  if (Number.isFinite(plain)) return { opening: plain, ...empty, complete: false }
  let parsed: unknown
  try {
    parsed = JSON.parse(note)
  } catch {
    return null
  }
  if (typeof parsed !== "object" || parsed === null) return null
  const fields = parsed as Record<string, unknown>
  const opening = Number(fields.opening)
  if (!Number.isFinite(opening)) return null
  const read = (key: string) => {
    const value = Number(fields[key] ?? 0)
    return Number.isFinite(value) ? value : 0
  }
  return {
    opening,
    recharges: read("recharges"),
    played: read("played"),
    prizes: read("prizes"),
    payouts: read("payouts"),
    transfers: read("transfers"),
    complete: "played" in fields,
  }
}

export function describeActivity(entry: ActivityEntry, state: ActivityContext): string {
  const player = state.players.find((p) => p.id === entry.playerId)?.name ?? "Jugador"
  const ticketIndex = (
    state.tickets.find((t) => t.id === entry.ticketId) ??
    state.removedTickets?.find((t) => t.id === entry.ticketId)
  )?.index
  const position = `Cartón ${ticketIndex ?? "?"} · #${entry.number ?? "?"}`
  const round = state.rounds.find((r) => r.id === entry.roundId)
  const roundLabel = round ? `ronda ${round.seq} (${round.name})` : "la ronda"
  const amount = formatMoney(Math.abs(entry.amount ?? 0))
  const method =
    (entry.paymentMethod ? ` · ${paymentMethodLabel(entry.paymentMethod)}` : "") +
    (entry.bank ? ` · ${bankLabel(entry.bank)}` : "")
  const note = entry.note && entry.note !== "unplayed_round_refund" ? ` · ${entry.note}` : ""

  if (entry.correctsId !== null && entry.type !== "balance_transfer") {
    // `amount` is what the correction changed in the balance (-$900 for a
    // recharge of 1000 that was 100).
    const kind = entry.type === "payout" ? "del pago a" : "de la recarga de"
    return `Corrección ${kind} ${player}: saldo ${signedMoney(entry.amount ?? 0)}${note}`
  }

  switch (entry.type) {
    case "game_session_started":
      return "Comenzó la jornada"
    case "game_session_ended":
      return "Terminó la jornada"
    case "player_added":
      return `${player} entró a la jornada`
    case "player_removed": {
      // amount = the balance they leave with; the note has the rest of the
      // summary (parseRemovalNote).
      const summary = parseRemovalNote(entry.note)
      if (!summary) return `${player} fue retirado de la jornada`
      const closing = entry.amount ?? 0
      const parts = summary.complete
        ? removalSummaryParts({ ...summary, closing })
        : [
            `entró con ${signedMoney(summary.opening)}`,
            ...(summary.prizes > 0 ? [`ganó ${formatMoney(summary.prizes)} en premios`] : []),
            `sale con ${signedMoney(closing)}`,
          ]
      return [`${player} se retiró de la jornada`, ...parts].join(" · ")
    }
    case "ticket_added":
      return `Se agregó el cartón ${ticketIndex ?? ""}`.trim()
    case "ticket_restored":
      return `Se volvió a agregar el cartón ${ticketIndex ?? ""}`.trim()
    case "ticket_removed":
      return `Se retiró el cartón ${ticketIndex ?? ""}`.trim()
    case "number_purchased":
      return `${player} compró ${position} (${amount})`
    case "number_released":
      return (entry.amount ?? 0) === 0
        ? `${player} liberó ${position} (regalado)`
        : `${player} liberó ${position} (se le devolvió ${amount})`
    case "number_reassigned":
      return (entry.amount ?? 0) > 0
        ? `${position} pasó a ${player} (${amount})`
        : `${player} cedió ${position}`
    case "number_moved":
      // The origin ticket index is in the note; no money moves.
      return `${player}: #${entry.number ?? "?"} pasó del cartón ${entry.note ?? "?"} al cartón ${ticketIndex ?? "?"}`
    case "number_gifted":
      return `${position} regalado a ${player}`
    case "number_ungifted":
      return `${position} de ${player} dejó de ser regalo (${amount})`
    case "recharge":
      return `${player} recargó ${amount}${method}${note}`
    case "check_in":
      if (entry.note === "auto")
        return `${player} quedó en la ronda al decidir su jugada (check-in automático)`
      if (entry.note === "recharge")
        return `${player} quedó en la ronda al recargar (check-in automático)`
      return `${player} hizo check-in (está en la ronda)`
    case "check_in_undone":
      return `Se deshizo el check-in de ${player}`
    case "round_started":
      return `Comenzó la ${roundLabel}`
    case "round_closed":
      return `Cerró la ${roundLabel}`
    case "prize_won":
      return entry.playerId === null
        ? `Salió el #${entry.number}: nadie lo tenía`
        : `${player} ganó ${amount} con ${position}`
    case "margin_adjustment":
      return `La casa por números regalados y sin vender en la ${roundLabel}: ${(entry.amount ?? 0) < 0 ? "-" : "+"}${amount}`
    case "carryover_kept":
      return (entry.amount ?? 0) > 0
        ? `${player} mantiene su jugada (${amount})`
        : `${player} liberó toda su jugada`
    case "carryover_released":
      return `${player} liberó ${position} para la siguiente ronda`
    case "payout":
      return `Pago a ${player}: ${amount}${method}${note}`
    case "balance_opened":
      return `${player} entró con saldo ${signedMoney(entry.amount ?? 0)}`
    case "balance_closed":
      return `${player} terminó con saldo ${signedMoney(entry.amount ?? 0)}`
    case "credit_kept_for_play":
      return `${player} deja su saldo a favor para jugar${note}`
    case "credit_payout_pending":
      return `Pago pendiente a ${player}${note}`
    case "debt_noted":
      return `${player} queda debiendo${note}`
    case "settlement_closed":
      return "Se cerró la liquidación"
    case "balance_transfer": {
      // One row per player: the sender's is negative, the receiver's positive;
      // a voiding row has the opposite sign of the row it voids.
      const other =
        state.players.find((p) => p.id === entry.counterpartyPlayerId)?.name ?? "otro jugador"
      const gains = (entry.amount ?? 0) > 0
      if (entry.correctsId !== null) {
        return gains
          ? `Se anuló la transferencia a ${other}: ${player} recuperó ${amount}${note}`
          : `Se anuló la transferencia de ${other}: ${player} devolvió ${amount}${note}`
      }
      return gains
        ? `${player} recibió ${amount} de ${other}${note}`
        : `${player} transfirió ${amount} a ${other}${note}`
    }
    case "adjustment":
      return entry.note === "unplayed_round_refund"
        ? `Devolución a ${player}: ${amount} (ronda no jugada)`
        : `Ajuste a ${player}: ${amount}${note}`
  }
}
