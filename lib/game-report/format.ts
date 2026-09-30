// Dates are shown in the house's time zone (houses.timezone), not the
// device's, so everyone in the house reads the same time.

export function formatHouseDateTime(value: string, timeZone: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(value))
}

export function formatHouseDate(value: string | number, timeZone: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone,
  }).format(new Date(value))
}

/** "1 h 25 min", "12 min". */
export function formatDuration(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60_000))
  const hours = Math.floor(minutes / 60)
  return hours > 0 ? `${hours} h ${minutes % 60} min` : `${minutes} min`
}

// Minutes the time zone is ahead of UTC at `instant` (negative west of UTC).
function zoneOffsetMinutes(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"))
  return Math.round((asUtc - Math.floor(instant / 1000) * 1000) / 60_000)
}

/** A calendar day ("2026-09-29") of the house as a UTC range [start, end). */
export function houseDayRange(day: string, timeZone: string): { start: string; end: string } {
  const [y, m, d] = day.split("-").map(Number)
  const at = (dayOffset: number) => {
    const guess = Date.UTC(y, m - 1, d + dayOffset)
    // Two passes so a DST change on that day still lands on local midnight.
    const first = guess - zoneOffsetMinutes(guess, timeZone) * 60_000
    return guess - zoneOffsetMinutes(first, timeZone) * 60_000
  }
  return { start: new Date(at(0)).toISOString(), end: new Date(at(1)).toISOString() }
}

/** Today in the house's time zone, as "2026-09-29". */
export function houseToday(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date())
}

/** Whether a "2026-09-29" string is a real calendar day. */
export function isDayString(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [y, m, d] = value.split("-").map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}
