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

export interface DraftRoundConfig {
  id: number
  name: string
  /** Determina la fórmula de premios (ver lib/round-draft/prize-rules.ts). Reglamento: rondas
   *  impares son "regular", rondas pares son "especial". */
  kind: "regular" | "especial"
  /** Solo informativo — el reducer nunca lo usa para calcular premios, siempre deriva de `kind`. */
  winnerCount: number
  /** Solo informativo/referencia — el premio real se calcula a partir de `kind` y el precio de línea. */
  prizes: number[]
}

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
