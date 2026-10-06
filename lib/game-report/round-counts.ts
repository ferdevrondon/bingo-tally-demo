import type { RoundReport } from "./types"

export interface RoundCounts {
  /** Numbers charged in the round (sales / line price). */
  sold: number
  /** Unsold numbers that didn't win and stayed with the house. */
  unsold: number
  /** Unsold numbers that won; null when the amounts can't tell how many. */
  unsoldWon: number | null
  /** Numbers gifted in the round that are still gifts. */
  gifted: number
  /** Winning tickets paid. */
  prizes: number
}

/** How many numbers are behind each amount of a round's result. Only the
 *  amounts are stored, so the counts are derived: every sold or unsold
 *  number weighs the line price, and an unsold winning number weighs
 *  prize - line price. */
export function roundCounts(round: RoundReport): RoundCounts {
  const price = round.linePrice
  const { house } = round
  const perNumber = (amount: number) => (price > 0 ? Math.round(Math.abs(amount) / price) : 0)

  let unsoldWon: number | null = 0
  if (house.unsoldWinning !== 0) {
    const deltas = new Set(
      round.winningNumbers
        .map((n, slot) => (n === null ? 0 : (round.prizes[slot] ?? 0) - price))
        .filter((d) => d > 0)
    )
    unsoldWon = deltas.size === 1 ? Math.round(house.unsoldWinning / [...deltas][0]) : null
  }

  return {
    sold: perNumber(house.sales),
    unsold: perNumber(house.unsoldLosing),
    unsoldWon,
    gifted: round.gifts.length,
    prizes: round.winners.length,
  }
}
