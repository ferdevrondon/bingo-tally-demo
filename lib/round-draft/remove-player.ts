import type { RoundDraftState } from "./types"

/**
 * What removing the player gives back: the paid plays they hold in the open
 * round (gifts were never charged). Mirrors public.remove_player, which voids
 * those plays; a player still deciding their carry-over was not charged in the
 * open round, and without an open round there is nothing to void.
 */
export function removalRefund(state: RoundDraftState, playerId: number): number {
  const player = state.players.find((p) => p.id === playerId)
  if (!state.round || !player || player.pendingCarryOverDecision) return 0
  const paidPlays = state.tickets
    .flatMap((ticket) => ticket.numbers)
    .filter((entry) => entry.playerId === playerId && !entry.isGift).length
  return paidPlays * state.round.linePrice
}
