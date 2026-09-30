import type { Bank } from "@/lib/banks"
import type { PaymentMethod, RecordedPaymentMethod } from "@/lib/payment-methods"

/** A player as seen by the live game: catalog data plus their balance in
 *  this game session (game_session_players), or their account balance when
 *  they haven't joined yet. */
export interface DraftPlayer {
  id: number
  name: string
  /** From the catalog; prefills the recharge payment method. */
  paymentMethod: PaymentMethod | null
  /** From the catalog; shown next to the recharge payment method. */
  bank: Bank | null
  /** Signed (business rule B): negative = owes the house, positive = the
   *  house owes them. */
  balance: number
  /** In the open round (rule A). Cleared when a round closes. */
  checkedIn: boolean
  pendingCarryOverDecision: boolean
  /** Has a game_session_players row (joined by a purchase or recharge). */
  inSession: boolean
  /** Removed from this game session (remove_player); keeps its balance. */
  removed: boolean
}

export interface NumberAssignment {
  number: number // 1-15
  playerId: number | null
  isGift: boolean
}

export interface Ticket {
  id: number
  index: number // display order -> "Cartón #{index}"
  numbers: NumberAssignment[] // always 15 entries, 1..15
}

/** activity_log.type values (see the game session functions migration). */
export type ActivityEntryType =
  | "game_session_started"
  | "game_session_ended"
  | "player_added"
  | "player_removed"
  | "ticket_added"
  | "number_purchased"
  | "number_released"
  | "number_reassigned"
  | "number_gifted"
  | "number_ungifted"
  | "recharge"
  | "check_in"
  | "check_in_undone"
  | "round_started"
  | "round_closed"
  | "prize_won"
  | "margin_adjustment"
  | "carryover_kept"
  | "carryover_released"
  | "payout"
  | "adjustment"
  | "balance_opened"
  | "balance_closed"
  | "credit_kept_for_play"
  | "credit_payout_pending"
  | "debt_noted"
  | "settlement_closed"

/** One activity_log row: structured data only. The UI builds the sentence
 *  (components/activity-log-card.tsx). */
export interface ActivityEntry {
  id: number
  timestamp: number
  type: ActivityEntryType
  playerId: number | null
  roundId: number | null
  ticketId: number | null
  number: number | null
  amount: number | null
  paymentMethod: RecordedPaymentMethod | null
  note: string | null
}

/** The open round of the game session (game_session_rounds). */
export interface DraftRound {
  /** game_session_rounds.id */
  roundId: number
  /** The round template it was started from (null if the template is gone). */
  templateId: number | null
  seq: number
  name: string
  /** Copied from the template when the round started (business rule 8). */
  linePrice: number
  /** Prize per winning ticket for each winning number, copied from the
   *  template (rule E). Its length is the number of winning numbers. */
  prizes: number[]
}

/** Rounds of the game session by id, for labels ("Ronda 2 · Especial"). */
export interface RoundSummary {
  id: number
  seq: number
  name: string
}

export interface RoundDraftState {
  gameSessionId: number
  /** "Jornada #N" (game_sessions.number). */
  gameNumber: number
  tickets: Ticket[]
  players: DraftPlayer[]
  /** UI only: the player numbers are assigned to. Not persisted. */
  activePlayerId: number | null
  /** Newest first, at most MAX_ACTIVITY_ENTRIES. */
  activity: ActivityEntry[]
  round: DraftRound | null
  rounds: RoundSummary[]
  winningNumbers: (number | null)[]
  /** Closed rounds of this game session. */
  roundsPlayed: number
  /** House result so far: sales - prizes + the margin of closed rounds. */
  houseBalance: number
  gameStartedAt: number
}

export const MAX_ACTIVITY_ENTRIES = 50
