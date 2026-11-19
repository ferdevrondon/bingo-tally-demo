import { describe, expect, it } from "vitest"

import { buildAwardSummary } from "./award-summary"
import type { RoundDraftState } from "./types"

function makeState(plays: [number, number, number, boolean][]): RoundDraftState {
  // [ticketIndex, number, playerId, isGift]
  const tickets = [1, 2].map((index) => ({
    id: 100 + index,
    index,
    numbers: Array.from({ length: 15 }, (_, j) => {
      const play = plays.find(([t, n]) => t === index && n === j + 1)
      return { number: j + 1, playerId: play?.[2] ?? null, isGift: play?.[3] ?? false }
    }),
  }))
  return {
    tickets,
    round: { linePrice: 10, prizes: [200, 100] },
    players: [
      { id: 1, name: "FERNANDA", balance: 80 },
      { id: 2, name: "JUANA", balance: -30 },
    ],
  } as unknown as RoundDraftState
}

describe("buildAwardSummary", () => {
  it("pays per ticket, less the line price on gifts, summed by player", () => {
    const state = makeState([
      [1, 11, 1, false],
      [2, 11, 1, true],
      [1, 5, 2, false],
    ])
    const summary = buildAwardSummary(state, 0, 11)
    expect(summary.winners).toEqual([
      {
        playerId: 1,
        name: "FERNANDA",
        plays: 2,
        gifts: 1,
        amount: 200 + 190,
        balanceBefore: 80,
        balanceAfter: 470,
      },
    ])
  })

  it("lists every winner of the number and is empty when nobody had it", () => {
    const state = makeState([
      [1, 11, 1, false],
      [2, 11, 2, false],
    ])
    expect(buildAwardSummary(state, 1, 11).winners.map((w) => w.amount)).toEqual([100, 100])
    expect(buildAwardSummary(state, 0, 3).winners).toEqual([])
  })
})
