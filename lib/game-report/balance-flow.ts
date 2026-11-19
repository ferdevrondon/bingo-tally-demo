import { saleAmount } from "./ledger"

// The signed balance of one player through a game session, round by round
// ("Ver rondas"). Negative = the player owes the house; positive = the house
// owes the player. Same rule as the SQL functions (see ledger.ts): every sale
// moves the balance by -amount, prizes, recharges and transfers by +amount.

/** One activity_log row of a player, in ledger order (oldest first). */
export interface BalanceRow {
  id: number
  /** ISO timestamp of the row. */
  createdAt: string
  type: string
  amount: number | string | null
  roundId: number | null
  number: number | null
  counterpartyPlayerId: number | null
}

/** One money movement of the player, as it happened. */
export interface BalanceMovement {
  id: number
  /** ISO timestamp. */
  createdAt: string
  type: string
  number: number | null
  counterpartyPlayerId: number | null
  /** The amount logged on the row (a sale is positive when charged). */
  amount: number
  /** How much the movement moved the balance (+ credits the player). */
  effect: number
  /** Balance right after this movement. */
  balanceAfter: number
}

/** What happened to a player's balance inside one round (null round = outside any round). */
export interface RoundBalanceFlow {
  /** Balance before the round's first movement. */
  enteredBalance: number
  /** Balance after the round's last movement so far. */
  exitBalance: number
  /** Recharges received in the round (positive). */
  recharged: number
  /** Prizes won in the round (positive). */
  won: number
  /** Payouts made to the player in the round (positive). */
  paid: number
  /** Balance transfers in the round, signed: + received, − sent. */
  transferred: number
  /** Every money movement of the round, in the order it happened. */
  movements: BalanceMovement[]
}

const MONEY_TYPES: ReadonlySet<string> = new Set([
  "recharge",
  "prize_won",
  "payout",
  "balance_transfer",
])

/** How much a ledger row moves the player's balance (0 for non-money rows). */
export function balanceEffect(type: string, amount: number | string | null): number {
  const value = Number(amount ?? 0)
  if (MONEY_TYPES.has(type)) return value
  // Sales and unplayed-round refunds: saleAmount is the amount the player was
  // charged (a refund is negative), so the balance moves by its opposite.
  return 0 - saleAmount(type, amount)
}

/** Walks the rows in order from the opening balance and groups the movements
 *  by round. The entered balance of a round is the balance before its first
 *  row; the exit balance is the balance after its last row. */
export function roundBalanceFlow(
  openingBalance: number,
  rows: BalanceRow[]
): Map<number | null, RoundBalanceFlow> {
  const flows = new Map<number | null, RoundBalanceFlow>()
  let balance = openingBalance

  for (const row of rows) {
    const effect = balanceEffect(row.type, row.amount)
    if (effect === 0) continue

    let flow = flows.get(row.roundId)
    if (!flow) {
      flow = {
        enteredBalance: balance,
        exitBalance: balance,
        recharged: 0,
        won: 0,
        paid: 0,
        transferred: 0,
        movements: [],
      }
      flows.set(row.roundId, flow)
    }

    const amount = Number(row.amount ?? 0)
    if (row.type === "recharge") flow.recharged += amount
    else if (row.type === "prize_won") flow.won += amount
    else if (row.type === "payout") flow.paid += -amount
    else if (row.type === "balance_transfer") flow.transferred += amount

    balance += effect
    flow.exitBalance = balance
    flow.movements.push({
      id: row.id,
      createdAt: row.createdAt,
      type: row.type,
      number: row.number,
      counterpartyPlayerId: row.counterpartyPlayerId,
      amount,
      effect,
      balanceAfter: balance,
    })
  }

  return flows
}
