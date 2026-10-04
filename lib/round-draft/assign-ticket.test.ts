import { describe, expect, it } from "vitest"

import { assignTicket } from "./assign-ticket"
import type { Ticket } from "./types"

// Ticket ids are 100 + index so they can't be confused with the index.
function makeTickets(count: number, taken: Record<number, number[]> = {}): Ticket[] {
  return Array.from({ length: count }, (_, i) => {
    const index = i + 1
    return {
      id: 100 + index,
      index,
      numbers: Array.from({ length: 15 }, (_, j) => ({
        number: j + 1,
        playerId: taken[index]?.includes(j + 1) ? 1 : null,
        isGift: false,
      })),
    }
  })
}

describe("assignTicket", () => {
  it("assigns ticket 1 when everything is free", () => {
    expect(assignTicket(6, makeTickets(6))).toBe(101)
  })

  it("skips tickets where line 6 is taken, whichever ticket was tapped", () => {
    const tickets = makeTickets(6, { 1: [6], 2: [6], 3: [6] })
    expect(assignTicket(6, tickets)).toBe(104)
  })

  it("fills a gap before a higher ticket", () => {
    const tickets = makeTickets(4, { 1: [6], 3: [6] })
    expect(assignTicket(6, tickets)).toBe(102)
  })

  it("keeps each line independent", () => {
    const tickets = makeTickets(3, { 1: [6] })
    expect(assignTicket(2, tickets)).toBe(101)
  })

  it("puts four plays of line 2 on tickets 1 to 4", () => {
    let tickets = makeTickets(4)
    const assigned: number[] = []
    for (let i = 0; i < 4; i++) {
      const id = assignTicket(2, tickets)!
      assigned.push(id)
      tickets = tickets.map((t) =>
        t.id !== id
          ? t
          : { ...t, numbers: t.numbers.map((n) => (n.number === 2 ? { ...n, playerId: 1 } : n)) }
      )
    }
    expect(assigned).toEqual([101, 102, 103, 104])
  })

  it.each([0, 16, -1, 1.5, NaN])("rejects line %s", (lineNumber) => {
    expect(() => assignTicket(lineNumber, makeTickets(2))).toThrow(RangeError)
  })

  it("returns null when the line is taken on every ticket", () => {
    expect(assignTicket(6, makeTickets(2, { 1: [6], 2: [6] }))).toBeNull()
  })

  it("uses the index, not the array order", () => {
    const tickets = makeTickets(3).reverse()
    expect(assignTicket(5, tickets)).toBe(101)
  })
})
