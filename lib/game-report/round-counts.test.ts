import { describe, expect, it } from "vitest"

import { roundCounts, roundNumbers, sumNumbers } from "./round-counts"
import type { RoundReport } from "./types"

function round(partial: Partial<RoundReport>, house: Partial<RoundReport["house"]> = {}): RoundReport {
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
    ticketsCount: 1,
    winners: [],
    gifts: [],
    house: { sales: 0, prizes: 0, gifts: 0, unsoldLosing: 0, unsoldWinning: 0, total: 0, ...house },
    ...partial,
  }
}

const winner = (slot: number, prize: number, isGift = false) => ({
  playerId: 1,
  playerName: "Ana",
  ticketIndex: 1,
  number: 4,
  slot,
  prize,
  isGift,
})

describe("roundCounts", () => {
  it("derives sold, gifted and unsold numbers from sales, gifts and tickets", () => {
    // 1 ticket of 15: 10 sold ($100), 2 gifted, 3 left; nobody holds the winning 4.
    const counts = roundCounts(
      round(
        { gifts: [{ value: 10 }, { value: 10 }] as RoundReport["gifts"] },
        { sales: 100 }
      )
    )
    expect(counts).toEqual({ sold: 10, unsold: 2, unsoldWon: 1, gifted: 2, prizes: 0 })
  })

  it("counts a winning number a player held as paid, not as the house's", () => {
    const counts = roundCounts(round({ winners: [winner(0, 100)] }, { sales: 140, prizes: 100 }))
    expect(counts).toMatchObject({ sold: 14, unsoldWon: 0, unsold: 1, prizes: 1 })
  })

  it("counts every ticket where a winning number was free", () => {
    const counts = roundCounts(round({ ticketsCount: 3, winners: [winner(0, 100)] }, { sales: 0 }))
    expect(counts.unsoldWon).toBe(2)
  })
})

describe("roundNumbers", () => {
  it("shows the gross prize and the gift discount (140 - 100 + 10 = 50)", () => {
    const info = roundNumbers(
      round(
        {
          winners: [winner(0, 90, true)],
          gifts: [{ value: 10, paid: 90, won: true }] as RoundReport["gifts"],
        },
        { sales: 140, prizes: 90, total: 50 }
      )
    )
    expect(info).toMatchObject({
      sold: 14,
      gifted: 1,
      giftedValue: 10,
      grossPrizes: 100,
      giftDiscount: 10,
      houseNumbers: 0,
    })
  })

  it("adds up played rounds only", () => {
    const a = round({ winners: [winner(0, 100)] }, { sales: 140, prizes: 100 })
    const b = round({ played: false }, { sales: 999 })
    expect(sumNumbers([a, b]).sold).toBe(14)
  })
})
