import { describe, expect, it } from "vitest"

import { monthGrid, monthHighlights } from "./calendar"
import { monthDays } from "./format"
import type { PeriodDay } from "./types"

const played: Record<string, [number, number]> = {
  "2026-10-01": [1, -190],
  "2026-10-04": [1, -710],
  "2026-10-06": [3, -410],
  "2026-10-07": [3, -540],
  "2026-10-16": [1, 30],
}
const days: PeriodDay[] = monthDays("2026-10").map((day) => ({
  day,
  label: day,
  gameSessions: played[day]?.[0] ?? 0,
  houseTotal: played[day]?.[1] ?? 0,
  netCash: 0,
}))
const sessions = [
  { id: 1, number: 5, day: "2026-10-01", active: false, startedAtLabel: "" },
  { id: 2, number: 13, day: "2026-10-16", active: true, startedAtLabel: "" },
]

describe("monthGrid", () => {
  it("starts the weeks on Monday", () => {
    // October 1st, 2026 is a Thursday.
    expect(monthGrid(days, sessions, "2026-10-16").leading).toBe(3)
  })

  it("tints each day by its result and marks today and the future", () => {
    const { cells } = monthGrid(days, sessions, "2026-10-16")
    expect(cells[3].strength).toBe(1)
    expect(cells[1].strength).toBe(0)
    expect(cells[15]).toMatchObject({
      date: 16,
      isToday: true,
      isFuture: false,
    })
    expect(cells[15].sessions.map((s) => s.number)).toEqual([13])
    expect(cells[16].isFuture).toBe(true)
  })
})

describe("monthHighlights", () => {
  it("finds the worst, best and busiest days", () => {
    const h = monthHighlights(days, "2026-10-16")
    expect(h.worst?.day).toBe("2026-10-04")
    expect(h.best?.day).toBe("2026-10-16")
    expect(h.busiest.map((d) => d.day)).toEqual(["2026-10-06", "2026-10-07"])
    expect(h).toMatchObject({ daysPlayed: 5, daysElapsed: 16 })
  })
})
