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
