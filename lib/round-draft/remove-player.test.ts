import { describe, expect, it } from "vitest"

import { removalRefund } from "./remove-player"
import type { RoundDraftState } from "./types"

function makeState(pending: boolean, withRound = true): RoundDraftState {
  const entry = (number: number, playerId: number | null, isGift = false) => ({
    number,
    playerId,
    isGift,
  })
  return {
    round: withRound ? { linePrice: 10 } : null,
    players: [{ id: 1, pendingCarryOverDecision: pending }],
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
