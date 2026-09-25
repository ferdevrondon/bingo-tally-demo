import type { Round } from "@/lib/rounds"

export interface DraftPlayer {
  id: number
  name: string
  positiveBalance: number
  negativeBalance: number
  checkedIn: boolean
  pendingCarryOverDecision: boolean
}

export interface NumberAssignment {
  number: number // 1-15
  playerId: number | null
  isGift: boolean
}

export interface Ticket {
  id: string
  index: number // display order -> "Cartón #{index}"
  numbers: NumberAssignment[] // always 15 entries, seeded 1..15
}

export type ActivityEntryType =
  | "number_purchased"
  | "number_changed"
  | "number_gifted"
  | "recharge"
  | "check_in"
  | "player_removed"
  | "special_round_won"
  | "round_started"
  | "game_closed"
  | "prize_won"
  | "round_closed"
  | "numbers_kept"
  | "numbers_released"

export interface ActivityEntry {
  id: string
  timestamp: number
  type: ActivityEntryType
  playerId: number | null
  playerName: string | null
  description: string
  synthetic?: boolean
}

/** The round template being played. The reducer derives prizes from `kind`
 *  (lib/round-draft/prize-rules.ts); `winnerCount` and `prizes` are informational. */
export type DraftRoundConfig = Round

export interface RoundDraftState {
  tickets: Ticket[]
  players: DraftPlayer[]
  activePlayerId: number | null
  activity: ActivityEntry[]
  round: DraftRoundConfig | null
  winningNumbers: (number | null)[]
  roundsPlayed: number
  gamePlayerIds: number[]
  houseBalance: number
  gameStartedAt: number
}

export const NUMBER_PRICE = 10
export const MAX_ACTIVITY_ENTRIES = 50
