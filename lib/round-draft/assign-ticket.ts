// Mirrors private.first_free_ticket in the auto-assign-ticket migration. The
// database decides the ticket; this only drives the optimistic UI.
//
// Each number (line) has its own row of tickets: a purchase of number N goes
// to the ticket with the lowest `index` where N is still free, whichever
// ticket the host tapped.

import type { Ticket } from "./types"

export const LINE_COUNT = 15

export function isValidLineNumber(lineNumber: number): boolean {
  return Number.isInteger(lineNumber) && lineNumber >= 1 && lineNumber <= LINE_COUNT
}

/** The one place that walks the tickets in priority order (ascending index).
 *  A future "compact the row of N" should reuse it. */
export function ticketsByIndex(tickets: Ticket[]): Ticket[] {
  return [...tickets].sort((a, b) => a.index - b.index)
}

/** Id of the lowest-index ticket where `lineNumber` is free, or null when it is
 *  taken on every ticket. Throws RangeError for a number outside 1-15.
 *  TODO(decision): with null the purchase is blocked; the product owner still
 *  has to choose between opening a new ticket, blocking, or only warning. */
export function assignTicket(lineNumber: number, tickets: Ticket[]): number | null {
  if (!isValidLineNumber(lineNumber)) {
    throw new RangeError(`Line number must be an integer between 1 and ${LINE_COUNT}`)
  }
  const free = ticketsByIndex(tickets).find(
    (ticket) => ticket.numbers.find((n) => n.number === lineNumber)?.playerId === null
  )
  return free?.id ?? null
}

/** Mirrors private.compact_line (compact-ticket-rows migration): the plays of
 *  one number move to the lowest tickets, keeping their order, so freeing a
 *  play leaves no hole in front of later ones. Only the ticket changes: the
 *  number, the player and the gift flag travel together. `hasAwards`: the open
 *  round already has winning numbers, so nothing moves (the hole stays).
 *  Returns the tickets in the order they came in. */
export function compactLine(lineNumber: number, tickets: Ticket[], hasAwards: boolean): Ticket[] {
  if (!isValidLineNumber(lineNumber)) {
    throw new RangeError(`Line number must be an integer between 1 and ${LINE_COUNT}`)
  }
  if (hasAwards) return tickets
  const ordered = ticketsByIndex(tickets)
  const plays = ordered.flatMap((ticket) => {
    const entry = ticket.numbers.find((n) => n.number === lineNumber)
    return entry && entry.playerId !== null
      ? [{ playerId: entry.playerId, isGift: entry.isGift }]
      : []
  })
  const slotOf = new Map(ordered.map((ticket, i) => [ticket.id, plays[i] ?? null]))
  return tickets.map((ticket) => ({
    ...ticket,
    numbers: ticket.numbers.map((n) => {
      if (n.number !== lineNumber) return n
      const play = slotOf.get(ticket.id) ?? null
      return { ...n, playerId: play?.playerId ?? null, isGift: play?.isGift ?? false }
    }),
  }))
}
