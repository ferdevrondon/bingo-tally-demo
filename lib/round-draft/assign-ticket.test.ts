import { describe, expect, it } from "vitest"

import { assignTicket, compactLine } from "./assign-ticket"
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

// Players are numbered per ticket so the order is visible: line 6 holders.
function lineHolders(tickets: Ticket[], lineNumber: number) {
  return [...tickets]
    .sort((a, b) => a.index - b.index)
    .map((t) => t.numbers.find((n) => n.number === lineNumber)!.playerId)
}

function withLine(tickets: Ticket[], lineNumber: number, holders: (number | null)[], gifts: number[] = []) {
  return tickets.map((t, i) => ({
    ...t,
    numbers: t.numbers.map((n) =>
      n.number === lineNumber
        ? { ...n, playerId: holders[i] ?? null, isGift: gifts.includes(holders[i] ?? -1) }
        : n
    ),
  }))
}

describe("compactLine", () => {
  it("moves later plays one ticket down when the first is freed", () => {
    // Ana freed: [free, Beto, Caro, Dani]
    const tickets = withLine(makeTickets(4), 6, [null, 2, 3, 4])
    expect(lineHolders(compactLine(6, tickets, false), 6)).toEqual([2, 3, 4, null])
  })

  it("does nothing when the last play is freed", () => {
    const tickets = withLine(makeTickets(4), 6, [1, 2, 3, null])
    expect(compactLine(6, tickets, false)).toEqual(tickets)
  })

  it("closes a gap in the middle", () => {
    const tickets = withLine(makeTickets(4), 6, [1, null, 3, 4])
    expect(lineHolders(compactLine(6, tickets, false), 6)).toEqual([1, 3, 4, null])
  })

  it("leaves other lines untouched", () => {
    const tickets = withLine(withLine(makeTickets(3), 6, [null, 2, 3]), 2, [null, 5, null])
    const result = compactLine(6, tickets, false)
    expect(lineHolders(result, 2)).toEqual([null, 5, null])
    expect(lineHolders(result, 6)).toEqual([2, 3, null])
  })

  it("moves the gift flag with the play", () => {
    const tickets = withLine(makeTickets(3), 6, [null, 2, 3], [3])
    const result = compactLine(6, tickets, false)
    expect(result[1].numbers.find((n) => n.number === 6)).toMatchObject({ playerId: 3, isGift: true })
    expect(result[2].numbers.find((n) => n.number === 6)).toMatchObject({ playerId: null, isGift: false })
  })

  it("does not move anything once the round has winning numbers", () => {
    const tickets = withLine(makeTickets(3), 6, [null, 2, 3])
    expect(compactLine(6, tickets, true)).toBe(tickets)
  })

  it("rejects a line outside 1-15", () => {
    expect(() => compactLine(0, makeTickets(2), false)).toThrow(RangeError)
  })
})
