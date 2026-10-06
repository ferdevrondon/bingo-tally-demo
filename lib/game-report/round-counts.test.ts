import { describe, expect, it } from "vitest"

import { roundCounts } from "./round-counts"
import type { RoundReport } from "./types"

function round(partial: Partial<RoundReport>, house: Partial<RoundReport["house"]>): RoundReport {
  return {
    id: 1,
    seq: 1,
    name: "Regular",
    status: "closed",
    played: true,
    closedAtLabel: null,
    linePrice: 10,
    prizes: [100],
    winningNumbers: [4],
    winners: [],
    gifts: [],
    house: { sales: 0, prizes: 0, gifts: 0, unsoldLosing: 0, unsoldWinning: 0, total: 0, ...house },
    ...partial,
  }
}

describe("roundCounts", () => {
  it("derives numbers sold and unsold from the line price", () => {
    const counts = roundCounts(round({}, { sales: 50, unsoldLosing: -100 }))
    expect(counts).toMatchObject({ sold: 5, unsold: 10, unsoldWon: 0, gifted: 0, prizes: 0 })
  })

  it("counts unsold winning numbers when one prize explains the amount", () => {
    expect(roundCounts(round({}, { unsoldWinning: 180 })).unsoldWon).toBe(2)
  })

  it("leaves unsold winning numbers unknown when prizes differ", () => {
    const counts = roundCounts(
      round({ prizes: [100, 50], winningNumbers: [4, 9] }, { unsoldWinning: 130 })
    )
    expect(counts.unsoldWon).toBeNull()
  })
})
