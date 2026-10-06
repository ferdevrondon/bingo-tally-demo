import type { NumberPosition } from "./types"

export interface NumberCount {
  number: number
  /** Plays of the number (one per ticket). */
  count: number
  /** The tickets they were on, for a tooltip. */
  tickets: number[]
}

/** "Cartón 1 · #4" + "Cartón 2 · #4" become one chip, 4×2, by number. */
export function groupByNumber(positions: NumberPosition[]): NumberCount[] {
  const byNumber = new Map<number, NumberCount>()
  for (const p of positions) {
    const entry = byNumber.get(p.number) ?? { number: p.number, count: 0, tickets: [] }
    entry.count += 1
    entry.tickets.push(p.ticketIndex)
    byNumber.set(p.number, entry)
  }
  return [...byNumber.values()].sort((a, b) => a.number - b.number)
}

/** The purchases the player still holds: each release takes one purchase of
 *  its number away (the same ticket first). */
export function withoutReleased(
  bought: NumberPosition[],
  released: NumberPosition[]
): NumberPosition[] {
  const remaining = [...bought]
  for (const r of released) {
    const same = remaining.findIndex((p) => p.number === r.number && p.ticketIndex === r.ticketIndex)
    const index = same >= 0 ? same : remaining.findIndex((p) => p.number === r.number)
    if (index >= 0) remaining.splice(index, 1)
  }
  return remaining
}
