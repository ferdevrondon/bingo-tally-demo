// Mirrors the SQL rules in the game rules v2 migration (award_prize). The
// database computes the persisted amounts, including the house margin at
// round close; these only drive the optimistic UI.

/** The round number currently being played, 1-indexed (rondas completadas + 1). */
export function getCurrentRoundNumber(roundsPlayed: number): number {
  return roundsPlayed + 1
}

/** What one winning ticket pays: the slot's prize, or prize - line price for
 *  a gifted ticket (business rule C). */
export function ticketPrize(prize: number, isGift: boolean, linePrice: number): number {
  return isGift ? Math.max(prize - linePrice, 0) : prize
}
