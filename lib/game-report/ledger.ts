// How activity_log amounts become money (BACKEND_PLAN.md "Ledger mapping v2").
// Shared by the live game summaries (lib/round-draft/game-api.ts), the
// settlement (lib/data/settlement.ts) and the game session report.

/** The house result on a cash basis (since 2026-10-23): sales - prizes paid.
 *  The three margins below are 0 for new rounds (unsold and gifted numbers
 *  move no money) and only carry the old margin of rounds closed before that.
 *  Recharges and payouts are cash, not part of it. */
export interface HouseResult {
  /** Numbers sold, net of refunds (unplayed round refunds included). */
  sales: number
  /** Prizes paid to players (positive amount). */
  prizes: number
  /** Historic only: -P per gifted number that didn't win. */
  gifts: number
  /** Historic only: -P per unsold number that didn't win. */
  unsoldLosing: number
  /** Historic only: prize - P per unsold number that won. */
  unsoldWinning: number
  total: number
}

/** activity_log rows that move game money between a player and the house.
 *  Their `amount` is what the player was charged (a refund is negative). */
export const SALE_TYPES: ReadonlySet<string> = new Set([
  "number_purchased",
  "number_released",
  "number_reassigned",
  "number_gifted",
  "number_ungifted",
  "carryover_kept",
])

/** What a ledger row adds to sales: charges count, refunds and unplayed
 *  round refunds (`adjustment`, credited to the player) subtract. */
export function saleAmount(type: string, amount: number | string | null): number {
  const value = Number(amount ?? 0)
  if (SALE_TYPES.has(type)) return value
  if (type === "adjustment") return -value
  return 0
}

export function houseResult(parts: Omit<HouseResult, "total">): HouseResult {
  return {
    ...parts,
    total: parts.sales - parts.prizes + parts.gifts + parts.unsoldLosing + parts.unsoldWinning,
  }
}
