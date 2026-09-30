import type { PaymentMethod } from "@/lib/payment-methods"
import type { ActivityContext } from "@/lib/round-draft/activity-text"
import type { ActivityEntry } from "@/lib/round-draft/types"
import type { Settlement } from "@/lib/settlement"

import type { HouseResult } from "./ledger"

// Domain types of the game session report (BACKEND_PLAN.md Phase 6a): what
// happened in one game session, read from its ledger. Dates come as labels
// already formatted in the house's time zone.

export type GameSessionStatus = "active" | "ended"

export interface SettlementOverview {
  status: Settlement["status"]
  /** Players not resolved yet (open settlements). */
  unresolved: number
  /** Collected and paid out from the settlement. */
  received: number
  paid: number
}

/** A row of Reportes → Jornadas (and /games). */
export interface GameSessionListItem {
  id: number
  number: number
  status: GameSessionStatus
  startedAtLabel: string
  roundsPlayed: number
  playersCount: number
  ticketsCount: number
  /** The house result (game_sessions.house_balance). */
  houseTotal: number
  settlement: Pick<SettlementOverview, "status" | "unresolved"> | null
}

export interface RoundWinnerReport {
  playerId: number
  playerName: string
  ticketIndex: number
  number: number
  slot: number
  prize: number
}

export interface RoundReport {
  id: number
  seq: number
  name: string
  status: "open" | "closed"
  /** Closed with winning numbers (a round closed without them was never played). */
  played: boolean
  closedAtLabel: string | null
  linePrice: number
  /** Prize per winning ticket for each winning number, as configured. */
  prizes: number[]
  winningNumbers: (number | null)[]
  /** One per winning ticket ("Cartón N · #X"). A winning number nobody had
   *  has no winner: its prize stays with the house. */
  winners: RoundWinnerReport[]
  /** The house result of this round (an open round: sales and prizes so far). */
  house: HouseResult
}

/** A player in the game session: opening balance + movements = closing. */
export interface PlayerReport {
  id: number
  name: string
  removed: boolean
  opening: number
  /** Numbers bought net of refunds (what they spent playing). */
  played: number
  prizes: number
  recharges: number
  /** Paid to the player (positive amount). */
  payouts: number
  closing: number
}

export interface CashLine {
  method: PaymentMethod | null
  recharges: number
  payouts: number
}

export interface GameSessionReport {
  id: number
  number: number
  status: GameSessionStatus
  startedAtLabel: string
  endedAtLabel: string | null
  durationMs: number
  house: HouseResult
  roundsPlayed: number
  ticketsCount: number
  rounds: RoundReport[]
  players: PlayerReport[]
  /** Recharges and payouts during the game session, by payment method. */
  cash: CashLine[]
  settlement: SettlementOverview | null
  /** Every ledger row, newest first. */
  activity: ActivityEntry[]
  /** Names for the timeline sentences. */
  labels: ActivityContext
}

export interface NumberPosition {
  ticketIndex: number
  number: number
}

/** What one player did in one round ("Ver rondas"). */
export interface PlayerRoundReport {
  roundId: number | null
  /** 0 for movements outside any round. */
  seq: number
  name: string
  winningNumbers: (number | null)[]
  /** Net charges in the round (numbers bought and kept, minus refunds). */
  played: number
  bought: NumberPosition[]
  gifted: NumberPosition[]
  /** Numbers kept from the previous round (charged again). */
  keptCount: number
  wins: (NumberPosition & { prize: number })[]
  recharges: number
  payouts: number
}
