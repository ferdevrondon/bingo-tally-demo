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

describe("compactLine and assignTicket together", () => {
  it("compacting twice is the same as compacting once", () => {
    const tickets = withLine(makeTickets(5), 6, [null, 2, null, 4, 5])
    const once = compactLine(6, tickets, false)
    expect(compactLine(6, once, false)).toEqual(once)
    expect(lineHolders(once, 6)).toEqual([2, 4, 5, null, null])
  })

  it("closes old holes (a free ticket in front of later plays)", () => {
    const tickets = withLine(makeTickets(4), 6, [null, null, 3, 4])
    expect(lineHolders(compactLine(6, tickets, false), 6)).toEqual([3, 4, null, null])
  })

  it("keeps the order of the plays by ticket index, not by array order", () => {
    const tickets = withLine(makeTickets(4), 6, [null, 2, 3, 4]).reverse()
    expect(lineHolders(compactLine(6, tickets, false), 6)).toEqual([2, 3, 4, null])
  })

  it("returns tickets in the same array order and with the same ids", () => {
    const tickets = withLine(makeTickets(3), 6, [null, 2, 3]).reverse()
    expect(compactLine(6, tickets, false).map((t) => t.id)).toEqual(tickets.map((t) => t.id))
  })

  it("never changes the number or other lines of any ticket", () => {
    const base = withLine(withLine(makeTickets(4), 2, [1, null, 3, 4]), 6, [null, 2, 3, 4])
    const result = compactLine(6, base, false)
    for (const line of [1, 2, 3, 4, 5, 7, 15]) expect(lineHolders(result, line)).toEqual(lineHolders(base, line))
    expect(result.every((t) => t.numbers.map((n) => n.number).join() === base[0].numbers.map((n) => n.number).join())).toBe(true)
  })

  it("keeps the number of plays on the line", () => {
    const tickets = withLine(makeTickets(6), 6, [null, 2, null, 4, 5, null])
    const count = (ts: Ticket[]) => lineHolders(ts, 6).filter((p) => p !== null).length
    expect(count(compactLine(6, tickets, false))).toBe(count(tickets))
  })

  it("a purchase after compacting lands in the first free ticket", () => {
    const tickets = withLine(makeTickets(4), 6, [null, 2, 3, null])
    const compacted = compactLine(6, tickets, false)
    expect(assignTicket(6, compacted)).toBe(103)
  })

  it("with awards, the hole stays and a purchase fills it", () => {
    const tickets = withLine(makeTickets(4), 6, [null, 2, 3, 4])
    const same = compactLine(6, tickets, true)
    expect(lineHolders(same, 6)).toEqual([null, 2, 3, 4])
    expect(assignTicket(6, same)).toBe(101)
  })

  it("the Ana/Beto/Caro/Dani example, step by step", () => {
    // Ana (1) frees ticket 1, then Beto (2), now on ticket 1, frees it too.
    let tickets = withLine(makeTickets(4), 6, [1, 2, 3, 4])
    tickets = withLine(tickets, 6, [null, 2, 3, 4])
    tickets = compactLine(6, tickets, false)
    expect(lineHolders(tickets, 6)).toEqual([2, 3, 4, null])
    tickets = withLine(tickets, 6, [null, 3, 4, null])
    tickets = compactLine(6, tickets, false)
    expect(lineHolders(tickets, 6)).toEqual([3, 4, null, null])
  })
})
