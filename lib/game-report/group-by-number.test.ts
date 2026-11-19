import { describe, expect, it } from "vitest"

import { groupByNumber, withoutReleased } from "./group-by-number"

describe("groupByNumber", () => {
  it("joins plays of the same number across tickets, sorted by number", () => {
    expect(
      groupByNumber([
        { ticketIndex: 2, number: 5 },
        { ticketIndex: 1, number: 3 },
        { ticketIndex: 1, number: 5 },
      ])
    ).toEqual([
      { number: 3, count: 1, tickets: [1] },
      { number: 5, count: 2, tickets: [2, 1] },
    ])
  })
})

describe("withoutReleased", () => {
  it("takes a released purchase away, the same ticket first", () => {
    const bought = [
      { ticketIndex: 1, number: 3 },
      { ticketIndex: 2, number: 3 },
      { ticketIndex: 1, number: 8 },
    ]
    expect(withoutReleased(bought, [{ ticketIndex: 2, number: 3 }])).toEqual([
      { ticketIndex: 1, number: 3 },
      { ticketIndex: 1, number: 8 },
    ])
    expect(withoutReleased(bought, [{ ticketIndex: 9, number: 8 }])).toHaveLength(2)
  })
})
