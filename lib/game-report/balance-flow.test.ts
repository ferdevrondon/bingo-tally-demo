import { describe, expect, it } from "vitest"

import { balanceEffect, roundBalanceFlow, type BalanceRow } from "./balance-flow"

let nextId = 1
// A ledger row of the player; the time is the row order (one minute apart).
function row(type: string, amount: number | null, roundId: number | null): BalanceRow {
  const id = nextId++
  return {
    id,
    createdAt: new Date(Date.UTC(2026, 10, 5, 0, id)).toISOString(),
    type,
    amount,
    roundId,
    number: null,
    counterpartyPlayerId: null,
  }
}

// SOLECITO, game session #6 (Thursday 5 Nov, CASA DEMO DAIRY). Opening 0.
const solecito: BalanceRow[] = [
  // Round 1: 14 purchases and one reassignment, $10 each; recharge $300.
  ...Array.from({ length: 14 }, () => row("number_purchased", 10, 1)),
  row("number_reassigned", 10, 1),
  row("recharge", 300, 1),
  // Round 2: keeps 15 numbers ($150), wins $100 twice.
  row("carryover_kept", 150, 2),
  row("prize_won", 100, 2),
  row("prize_won", 100, 2),
  // Round 3: keeps 15 numbers.
  row("carryover_kept", 150, 3),
  // Round 4: keeps 15, gives away 2 numbers 4 (refund $20), recharge $80.
  row("carryover_kept", 150, 4),
  row("number_gifted", -10, 4),
  row("number_gifted", -10, 4),
  row("recharge", 80, 4),
  // Round 5: keeps 15, recharge $240.
  row("carryover_kept", 150, 5),
  row("recharge", 240, 5),
  // Round 6: keeps 15, gives one number away, releases 5 numbers (refund $50).
  row("carryover_kept", 150, 6),
  row("number_gifted", -10, 6),
  ...Array.from({ length: 5 }, () => row("number_released", -10, 6)),
  // Round 7: keeps 10, gives one number away, releases 9 (refund $90).
  row("carryover_kept", 100, 7),
  row("number_gifted", -10, 7),
  ...Array.from({ length: 9 }, () => row("number_released", -10, 7)),
]

describe("balanceEffect", () => {
  it("charges sales and credits refunds, gifts and prizes", () => {
    expect(balanceEffect("number_purchased", 10)).toBe(-10)
    expect(balanceEffect("carryover_kept", 150)).toBe(-150)
    expect(balanceEffect("number_released", -10)).toBe(10)
    expect(balanceEffect("number_gifted", -10)).toBe(10)
    expect(balanceEffect("number_ungifted", 10)).toBe(-10)
    expect(balanceEffect("recharge", 300)).toBe(300)
    expect(balanceEffect("prize_won", 100)).toBe(100)
    expect(balanceEffect("number_moved", 0)).toBe(0)
  })
})

describe("roundBalanceFlow", () => {
  const flows = roundBalanceFlow(0, solecito)

  it("tracks the balance a player enters and leaves each round with", () => {
    expect(flows.get(1)).toMatchObject({ enteredBalance: 0, exitBalance: 150, recharged: 300 })
    expect(flows.get(2)).toMatchObject({ enteredBalance: 150, exitBalance: 200, won: 200 })
    expect(flows.get(3)).toMatchObject({ enteredBalance: 200, exitBalance: 50 })
    expect(flows.get(4)).toMatchObject({ enteredBalance: 50, exitBalance: 0, recharged: 80 })
    expect(flows.get(5)).toMatchObject({ enteredBalance: 0, exitBalance: 90, recharged: 240 })
    expect(flows.get(6)).toMatchObject({ enteredBalance: 90, exitBalance: 0 })
    expect(flows.get(7)).toMatchObject({ enteredBalance: 0, exitBalance: 0 })
  })

  it("ends where the player closed the session", () => {
    const last = [...flows.values()].at(-1)
    expect(last?.exitBalance).toBe(0)
  })

  it("is the same whatever the opening balance, shifted by it", () => {
    const shifted = roundBalanceFlow(-20, solecito)
    expect(shifted.get(1)).toMatchObject({ enteredBalance: -20, exitBalance: 130 })
    expect(shifted.get(7)?.exitBalance).toBe(-20)
  })

  it("sums transfers signed: received positive, sent negative", () => {
    const transfers = roundBalanceFlow(0, [
      row("recharge", 100, 1),
      row("balance_transfer", -20, 1),
      row("balance_transfer", 30, 1),
    ])
    expect(transfers.get(1)).toMatchObject({ transferred: 10, exitBalance: 110 })
  })

  it("lists each movement in order, with the balance after it", () => {
    const first = flows.get(1)?.movements
    expect(first?.length).toBe(16)
    expect(first?.[0]).toMatchObject({ type: "number_purchased", effect: -10, balanceAfter: -10 })
    expect(first?.at(-2)).toMatchObject({ type: "number_reassigned", balanceAfter: -150 })
    expect(first?.at(-1)).toMatchObject({ type: "recharge", effect: 300, balanceAfter: 150 })
  })

  it("matches the client's example: 0, play 150, recharge 100, win 200 closes at 150", () => {
    const example = roundBalanceFlow(0, [
      row("number_purchased", 150, 1),
      row("recharge", 100, 1),
      row("prize_won", 200, 1),
    ])
    const movements = example.get(1)?.movements ?? []
    expect(movements.map((m) => m.balanceAfter)).toEqual([-150, -50, 150])
    expect(example.get(1)?.exitBalance).toBe(movements.at(-1)?.balanceAfter)
    expect(example.get(1)?.exitBalance).toBe(150)
  })
})
