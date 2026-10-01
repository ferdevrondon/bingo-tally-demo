// "2026-09-29" ↔ a local Date, for the date pickers of Reportes whose day
// lives in the URL (?date=). The report itself reads the day in the house's
// time zone on the server.

export function dayToDate(day: string): Date {
  const [y, m, d] = day.split("-").map(Number)
  return new Date(y, m - 1, d)
}

export function dateToDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
