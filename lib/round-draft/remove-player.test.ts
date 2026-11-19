import { describe, expect, it } from "vitest"

import { removalPreview, removalRefund } from "./remove-player"
import type { RoundDraftState } from "./types"

function makeState(pending: boolean, withRound = true): RoundDraftState {
  const entry = (number: number, playerId: number | null, isGift = false) => ({
    number,
    playerId,
    isGift,
  })
  return {
    round: withRound ? { linePrice: 10 } : null,
    players: [{ id: 1, pendingCarryOverDecision: pending, balance: -40, openingBalance: -20, totals: { recharges: 30, prizes: 50, payouts: -10, transfers: 0 } }],
    tickets: [
      { id: 101, index: 1, numbers: [entry(6, 1), entry(7, 1, true), entry(8, 2)] },
      { id: 102, index: 2, numbers: [entry(6, 1)] },
    ],
  } as unknown as RoundDraftState
}

describe("removalRefund", () => {
  it("gives back the paid plays of the open round, not the gifts", () => {
    expect(removalRefund(makeState(false), 1)).toBe(20)
  })

  it("is 0 while the player still decides their carry-over", () => {
    expect(removalRefund(makeState(true), 1)).toBe(0)
  })

  it("is 0 with no open round or for a player with no plays", () => {
    expect(removalRefund(makeState(false, false), 1)).toBe(0)
    expect(removalRefund(makeState(false), 9)).toBe(0)
  })
})

describe("removalPreview", () => {
  it("explains the closing balance: opening + recharges - played + prizes + payouts", () => {
    // -20 + 30 - played + 50 - 10 = -20 (balance -40, refund 20) -> played 70
    expect(removalPreview(makeState(false), 1)).toEqual({
      openingBalance: -20,
      recharges: 30,
      played: 70,
      prizes: 50,
      payouts: -10,
      transfers: 0,
      refund: 20,
      closingBalance: -20,
    })
  })

  it("keeps the balance as is when nothing is given back", () => {
    const preview = removalPreview(makeState(true), 1)
    expect(preview.refund).toBe(0)
    expect(preview.closingBalance).toBe(-40)
    expect(preview.played).toBe(90)
  })
})
