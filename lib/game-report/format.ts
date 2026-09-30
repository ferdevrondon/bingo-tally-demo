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
