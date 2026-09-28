import { paymentMethodLabel } from "@/lib/payment-methods"
import { formatMoney } from "@/lib/rounds"

import type { ActivityEntry, ActivityEntryType, RoundDraftState } from "./types"

// activity_log rows carry structured data only (BACKEND_PLAN.md §3); the
// Spanish text is built here. Positions are always "Cartón N · #X", so a
// player with the same number on several tickets sees each one.

export const ACTIVITY_LABELS: Record<ActivityEntryType, string> = {
  game_session_started: "Jornada",
  game_session_ended: "Jornada",
  player_added: "Jugador",
  player_removed: "Retiro",
  ticket_added: "Cartón",
  number_purchased: "Compra",
  number_released: "Liberación",
  number_reassigned: "Cambio",
  number_gifted: "Regalo",
  number_ungifted: "Regalo",
  recharge: "Recarga",
  check_in: "Check-in",
  check_in_undone: "Check-in",
  round_started: "Ronda",
  round_closed: "Cierre de ronda",
  prize_won: "Premio",
  margin_adjustment: "Casa",
  carryover_kept: "Jugada mantenida",
  carryover_released: "Liberación",
  payout: "Pago",
  adjustment: "Ajuste",
}

export function describeActivity(entry: ActivityEntry, state: RoundDraftState): string {
  const player = state.players.find((p) => p.id === entry.playerId)?.name ?? "Jugador"
  const ticketIndex = state.tickets.find((t) => t.id === entry.ticketId)?.index
  const position = `Cartón ${ticketIndex ?? "?"} · #${entry.number ?? "?"}`
  const round = state.rounds.find((r) => r.id === entry.roundId)
  const roundLabel = round ? `ronda ${round.seq} (${round.name})` : "la ronda"
  const amount = formatMoney(Math.abs(entry.amount ?? 0))
  const method = entry.paymentMethod ? ` · ${paymentMethodLabel(entry.paymentMethod)}` : ""
  const note = entry.note && entry.note !== "unplayed_round_refund" ? ` · ${entry.note}` : ""

  switch (entry.type) {
    case "game_session_started":
      return "Comenzó la jornada"
    case "game_session_ended":
      return "Terminó la jornada"
    case "player_added":
      return `${player} entró a la jornada`
    case "player_removed":
      return `${player} fue retirado de la jornada`
    case "ticket_added":
      return `Se agregó el cartón ${ticketIndex ?? ""}`.trim()
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
    case "number_gifted":
      return `${position} regalado a ${player}`
    case "number_ungifted":
      return `${position} de ${player} dejó de ser regalo (${amount})`
    case "recharge":
      return `${player} recargó ${amount}${method}${note}`
    case "check_in":
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
        : `${player} mantiene su jugada`
    case "carryover_released":
      return `${player} liberó ${position} para la siguiente ronda`
    case "payout":
      return `Pago a ${player}: ${amount}${method}${note}`
    case "adjustment":
      return entry.note === "unplayed_round_refund"
        ? `Devolución a ${player}: ${amount} (ronda no jugada)`
        : `Ajuste a ${player}: ${amount}${note}`
  }
}
