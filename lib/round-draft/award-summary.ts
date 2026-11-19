
import { ticketPrize } from "./prize-rules"
import { getHouseWin, getWinnersForNumber } from "./selectors"
import type { RoundDraftState } from "./types"

export interface AwardWinner {
  playerId: number
  name: string
  /** Winning tickets of the player for this number. */
  plays: number
  /** How many of those plays are gifts (they pay prize - line price). */
  gifts: number
  amount: number
  balanceBefore: number
  balanceAfter: number
}

export interface AwardSummary {
  slotIndex: number
  number: number
  prize: number
  /** Empty when nobody held the number: the prize stays with the house. */
  winners: AwardWinner[]
  /** The tickets where the number was free: no prize is paid there. */
  house: HouseWin
}

export interface HouseWin {
  tickets: number
}

/** "Número de la casa en 3 cartones libres: se queda con lo recaudado". */
export function houseWinText(house: HouseWin): string {
  return `Número de la casa en ${house.tickets} cartón${
    house.tickets === 1 ? "" : "es"
  } libre${house.tickets === 1 ? "" : "s"}: se queda con lo recaudado`
}

/** What declaring `number` as the winner of `slotIndex` pays, per player. Call
 *  it with the state from before the award; it mirrors the AWARD_PRIZE
 *  reducer and only drives the celebration (the database pays). */
export function buildAwardSummary(
  state: RoundDraftState,
  slotIndex: number,
  number: number
): AwardSummary {
  const prize = state.round?.prizes[slotIndex] ?? 0
  const linePrice = state.round?.linePrice ?? 0
  const winners = getWinnersForNumber(state, number).map((winner) => {
    const amount = winner.entries.reduce(
      (total, entry) => total + ticketPrize(prize, entry.isGift, linePrice),
      0
    )
    const balanceBefore = state.players.find((p) => p.id === winner.playerId)?.balance ?? 0
    return {
      playerId: winner.playerId,
      name: winner.playerName,
      plays: winner.entries.length,
      gifts: winner.entries.filter((e) => e.isGift).length,
      amount,
      balanceBefore,
      balanceAfter: balanceBefore + amount,
    }
  })
  return { slotIndex, number, prize, winners, house: getHouseWin(state, number) }
}
