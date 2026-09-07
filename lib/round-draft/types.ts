export interface DraftPlayer {
  id: number
  name: string
  positiveBalance: number
  negativeBalance: number
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

export interface RoundDraftState {
  cartones: Carton[]
  players: DraftPlayer[]
  activePlayerId: number | null
}

export const NUMBER_PRICE = 10
