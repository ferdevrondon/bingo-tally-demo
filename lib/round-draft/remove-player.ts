import { formatMoney } from "@/lib/rounds"

import { signedMoney } from "./balance"
import { EMPTY_SESSION_TOTALS, type RoundDraftState } from "./types"

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

export interface RemovalPreview {
  /** The balance the player opened the game session with. */
  openingBalance: number
  recharges: number
  /** What their numbers cost in the game session, net of releases, of
   *  unplayed round refunds and of this removal's refund. */
  played: number
  prizes: number
  /** Negative: what the house paid them. */
  payouts: number
  /** Signed: received minus given. */
  transfers: number
  /** What the removal gives back (removalRefund); already out of `played`. */
  refund: number
  /** Their balance once removed: what goes to the settlement. */
  closingBalance: number
}

/** How the player leaves the game session, for the confirmation dialog and
 *  the toast: opening + recharges - played + prizes + payouts + transfers =
 *  closing. public.remove_player logs the same summary. `played` is the rest
 *  of that sum, so it needs no play rows (and matches the ledger, whose
 *  per-player reconciliation always holds). */
export function removalPreview(state: RoundDraftState, playerId: number): RemovalPreview {
  const player = state.players.find((p) => p.id === playerId)
  const refund = removalRefund(state, playerId)
  const openingBalance = player?.openingBalance ?? 0
  const { recharges, prizes, payouts, transfers } = player?.totals ?? EMPTY_SESSION_TOTALS
  const closingBalance = (player?.balance ?? 0) + refund
  return {
    openingBalance,
    recharges,
    played: openingBalance + recharges + prizes + payouts + transfers - closingBalance,
    prizes,
    payouts,
    transfers,
    refund,
    closingBalance,
  }
}

/** The removal summary in words, in order and without the zero lines (the
 *  opening and closing balances always show): the toast and the timeline
 *  sentence of player_removed (activity-text.ts). */
export function removalSummaryParts(summary: {
  opening: number
  recharges: number
  played: number
  prizes: number
  payouts: number
  transfers: number
  closing: number
}): string[] {
  const parts = [`entró con ${signedMoney(summary.opening)}`]
  if (summary.recharges !== 0) parts.push(`recargó ${formatMoney(summary.recharges)}`)
  if (summary.played > 0) parts.push(`jugó ${formatMoney(summary.played)}`)
  else if (summary.played < 0) parts.push(`se le devolvieron ${formatMoney(-summary.played)}`)
  if (summary.prizes !== 0) parts.push(`ganó ${formatMoney(summary.prizes)} en premios`)
  if (summary.payouts !== 0) parts.push(`se le pagaron ${formatMoney(-summary.payouts)}`)
  if (summary.transfers > 0)
    parts.push(`recibió ${formatMoney(summary.transfers)} en transferencias`)
  else if (summary.transfers < 0) parts.push(`transfirió ${formatMoney(-summary.transfers)}`)
  parts.push(`sale con ${signedMoney(summary.closing)}`)
  return parts
}
