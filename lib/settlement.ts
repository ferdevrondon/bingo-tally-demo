import { formatMoney } from "@/lib/rounds"
import type { PaymentMethod } from "@/lib/payment-methods"

// The settlement of an ended game session (public.settlements /
// settlement_players, BACKEND_PLAN.md §5b as redesigned in Phase 4d2): a task
// list, one row per player, worked until nobody is left to resolve.

export type SettlementResolution =
  | "paid_in"
  | "paid_out"
  | "play"
  | "pending_payout"
  | "owes"
  | "settled"

/** What the admin can mark by hand (the rest comes from collecting or paying). */
export type SettlementMark = "play" | "pending_payout" | "owes"

const RESOLUTIONS: SettlementResolution[] = [
  "paid_in",
  "paid_out",
  "play",
  "pending_payout",
  "owes",
  "settled",
]

export function isSettlementResolution(value: unknown): value is SettlementResolution {
  return RESOLUTIONS.includes(value as SettlementResolution)
}

export interface SettlementPlayer {
  playerId: number
  name: string
  paymentMethod: PaymentMethod | null
  /** How the game session went for the player. */
  openingBalance: number
  /** Numbers bought, net of refunds (negative). */
  played: number
  prizes: number
  /** Money in and out during the game session. */
  recharges: number
  payouts: number
  closingBalance: number
  /** Collected and paid from this settlement. */
  received: number
  paid: number
  resolution: SettlementResolution | null
  note: string | null
  resolvedAt: string | null
  /** Balance kept when the settlement was closed. */
  finalBalance: number | null
  /** Live balance (account, or the active game session when playing). */
  currentBalance: number
  inGame: boolean
}

export interface Settlement {
  gameSessionId: number
  number: number
  endedAtLabel: string
  status: "open" | "closed"
  closedAtLabel: string | null
  players: SettlementPlayer[]
}

export interface SettlementListItem {
  gameSessionId: number
  number: number
  endedAtLabel: string
  status: "open" | "closed"
  players: number
  unresolved: number
}

export type SettlementGroup = "collect" | "pay" | "done"

/** Balance shown for a player: live while open, as kept once closed. */
export function shownBalance(player: SettlementPlayer, status: Settlement["status"]): number {
  return status === "closed" ? (player.finalBalance ?? player.closingBalance) : player.currentBalance
}

export function settlementGroup(player: SettlementPlayer): SettlementGroup {
  if (player.resolution !== null) return "done"
  return player.currentBalance < 0 ? "collect" : "pay"
}

/** What was done with a resolved player, e.g. "Pagó $60" or
 *  "Pendiente de pago · no localizado". */
export function resolutionText(player: SettlementPlayer): string {
  const note = player.note ? ` · ${player.note}` : ""
  switch (player.resolution) {
    case "paid_in":
      return `Pagó ${formatMoney(player.received)}`
    case "paid_out":
      return `Se le pagó ${formatMoney(player.paid)}`
    case "play":
      return `Deja su saldo para jugar${note}`
    case "pending_payout":
      return `Pendiente de pago${note}`
    case "owes":
      return `Queda debiendo${note}`
    case "settled":
      return "Terminó al día"
    default:
      return "Por resolver"
  }
}
