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

export interface Carton {
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
  | "jornada_closed"
  | "prize_won"
  | "round_closed"
  | "jugada_kept"
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

export interface DraftRoundConfig {
  id: number
  name: string
  winnerCount: number
  prizes: number[]
}

export interface RoundDraftState {
  cartones: Carton[]
  players: DraftPlayer[]
  activePlayerId: number | null
  activity: ActivityEntry[]
  round: DraftRoundConfig | null
  winningNumbers: (number | null)[]
}

export const NUMBER_PRICE = 10
export const MAX_ACTIVITY_ENTRIES = 50
