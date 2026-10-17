import type { PeriodDay, PeriodReport } from "./types"

// Reportes → Mensual as a calendar: one cell per day of the month, weeks
// starting on Monday, each day tinted by how much the house won or lost.

export type CalendarSession = Pick<
  PeriodReport["gameSessions"][number],
  "id" | "number" | "active"
>

export interface CalendarCell {
  day: PeriodDay
  /** Day of the month (1–31). */
  date: number
  sessions: CalendarSession[]
  isToday: boolean
  isFuture: boolean
  /** |house result| relative to the month's largest, 0..1 (0 with no game). */
  strength: number
}

export interface MonthGrid {
  /** Empty cells before the 1st (its weekday, Monday = 0). */
  leading: number
  cells: CalendarCell[]
}

export function monthGrid(
  days: PeriodDay[],
  sessions: PeriodReport["gameSessions"],
  today: string
): MonthGrid {
  const first = days[0]?.day
  const [y, m, d] = (first ?? "2000-01-03").split("-").map(Number)
  const leading = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7
  const maxAbs = Math.max(
    0,
    ...days.filter((x) => x.gameSessions > 0).map((x) => Math.abs(x.houseTotal))
  )
  const byDay = new Map<string, CalendarSession[]>()
  for (const s of sessions) byDay.set(s.day, [...(byDay.get(s.day) ?? []), s])
  return {
    leading,
    cells: days.map((day) => ({
      day,
      date: Number(day.day.slice(8)),
      sessions: byDay.get(day.day) ?? [],
      isToday: day.day === today,
      isFuture: day.day > today,
      strength:
        day.gameSessions > 0 && maxAbs > 0
          ? Math.abs(day.houseTotal) / maxAbs
          : 0,
    })),
  }
}

export interface MonthHighlights {
  worst: PeriodDay | null
  best: PeriodDay | null
  /** The days with the most game sessions, when some day had more than one. */
  busiest: PeriodDay[]
  daysPlayed: number
  /** Days of the month up to today (all of them for a past month). */
  daysElapsed: number
}

export function monthHighlights(
  days: PeriodDay[],
  today: string
): MonthHighlights {
  const played = days.filter((d) => d.gameSessions > 0)
  const byResult = [...played].sort((a, b) => a.houseTotal - b.houseTotal)
  const most = Math.max(0, ...played.map((d) => d.gameSessions))
  return {
    worst: byResult[0] ?? null,
    best: byResult.length > 1 ? byResult[byResult.length - 1] : null,
    busiest: most > 1 ? played.filter((d) => d.gameSessions === most) : [],
    daysPlayed: played.length,
    daysElapsed: days.filter((d) => d.day <= today).length,
  }
}
