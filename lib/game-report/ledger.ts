// How activity_log amounts become money (BACKEND_PLAN.md "Ledger mapping v2").
// Shared by the live game summaries (lib/round-draft/game-api.ts), the
// settlement (lib/data/settlement.ts) and the game session report.

/** The house result (decided with the product owner on 2026-09-28): sales
 *  - prizes paid + the margin of each played round, where the house "plays"
 *  what it didn't sell. Recharges and payouts are cash, not part of it. */
export interface HouseResult {
  /** Numbers sold, net of refunds (unplayed round refunds included). */
  sales: number
  /** Prizes paid to players (positive amount). */
  prizes: number
  /** -P per gifted number that didn't win. */
  gifts: number
  /** -P per unsold number that didn't win. */
  unsoldLosing: number
  /** prize - P per unsold number that won. */
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
