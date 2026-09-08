const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" })

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31536000],
  ["month", 2592000],
  ["week", 604800],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
  ["second", 1],
]

export function formatRelativeTime(timestamp: number, now = Date.now()): string {
  const diffSeconds = Math.round((timestamp - now) / 1000)
  for (const [unit, secondsInUnit] of UNITS) {
    if (Math.abs(diffSeconds) >= secondsInUnit || unit === "second") {
      return rtf.format(Math.round(diffSeconds / secondsInUnit), unit)
    }
  }
  return rtf.format(0, "second")
}
