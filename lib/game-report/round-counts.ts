import type { RoundReport } from "./types"

/** Numbers on each ticket (1-15). */
export const NUMBERS_PER_TICKET = 15

export interface RoundCounts {
  /** Numbers charged in the round (sales / line price). */
  sold: number
  /** Numbers nobody had that didn't win: they stay with the house. */
  unsold: number
  /** Numbers nobody had that won: no prize is paid there. */
  unsoldWon: number
  /** Numbers gifted in the round that are still gifts. */
  gifted: number
  /** Winning tickets paid. */
  prizes: number
}

/** What the round's numbers were worth, for the summaries. Informational:
 *  only sales and prizes paid move money (the house result is cash). */
export interface NumbersInfo extends RoundCounts {
  tickets: number
  /** Numbers that stayed with the house (unsold + unsold that won). */
  houseNumbers: number
  /** Value of the gifted numbers (count × line price); never charged. */
  giftedValue: number
  /** Value of the numbers that stayed with the house (count × line price). */
  houseValue: number
  /** Prizes at their full value, per winning ticket. */
  grossPrizes: number
  /** What a gifted winner is paid less (the line price): grossPrizes - prizes paid. */
  giftDiscount: number
}

/** How many numbers are behind a round's result, derived from its ledger
 *  sales, gifts, winners and the tickets it had: every ticket has each number
 *  once, so what nobody held is `tickets × 15 - sold - gifted`. */
export function roundCounts(round: RoundReport): RoundCounts {
  const price = round.linePrice
  const sold = price > 0 ? Math.max(0, Math.round(round.house.sales / price)) : 0
  const gifted = round.gifts.length

  let unsoldWon = 0
  round.winningNumbers.forEach((number, slot) => {
    if (number === null) return
    const owners = round.winners.filter((w) => w.slot === slot).length
    unsoldWon += Math.max(0, round.ticketsCount - owners)
  })

  const free = Math.max(0, round.ticketsCount * NUMBERS_PER_TICKET - sold - gifted)
  return {
    sold,
    unsold: Math.max(0, free - unsoldWon),
    unsoldWon,
    gifted,
    prizes: round.winners.length,
  }
}

export function roundNumbers(round: RoundReport): NumbersInfo {
  const counts = roundCounts(round)
  const houseNumbers = counts.unsold + counts.unsoldWon
  const grossPrizes = round.winners.reduce((sum, w) => sum + (round.prizes[w.slot] ?? w.prize), 0)
  return {
    ...counts,
    tickets: round.ticketsCount,
    houseNumbers,
    giftedValue: counts.gifted * round.linePrice,
    houseValue: houseNumbers * round.linePrice,
    grossPrizes,
    giftDiscount: Math.max(0, grossPrizes - round.house.prizes),
  }
}

/** The numbers of several played rounds added up; `tickets` is the highest
 *  count of any round (tickets only grow during a game session). */
export function sumNumbers(rounds: RoundReport[]): NumbersInfo {
  const total: NumbersInfo = {
    sold: 0,
    unsold: 0,
    unsoldWon: 0,
    gifted: 0,
    prizes: 0,
    tickets: 0,
    houseNumbers: 0,
    giftedValue: 0,
    houseValue: 0,
    grossPrizes: 0,
    giftDiscount: 0,
  }
  for (const round of rounds) {
    if (!round.played) continue
    const info = roundNumbers(round)
    total.sold += info.sold
    total.unsold += info.unsold
    total.unsoldWon += info.unsoldWon
    total.gifted += info.gifted
    total.prizes += info.prizes
    total.tickets = Math.max(total.tickets, info.tickets)
    total.houseNumbers += info.houseNumbers
    total.giftedValue += info.giftedValue
    total.houseValue += info.houseValue
    total.grossPrizes += info.grossPrizes
    total.giftDiscount += info.giftDiscount
  }
  return total
}
