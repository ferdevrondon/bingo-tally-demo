// The header title of each route (components/site-header.tsx), in Spanish.
// Dynamic segments are matched by pattern; the first match wins.

const TITLES: [pattern: RegExp, title: string][] = [
  [/^\/$/, "Inicio"],
  [/^\/new-game$/, "Cartones y jugadores"],
  [/^\/active-round$/, "Ronda activa"],
  [/^\/players$/, "Jugadores"],
  [/^\/rounds$/, "Rondas"],
  [/^\/settlement$/, "Liquidación"],
  [/^\/games\/[^/]+\/settlement$/, "Liquidación"],
  [/^\/reports\/games(\/[^/]+)?$/, "Reportes · Jornadas"],
  [/^\/reports\/rounds$/, "Reportes · Rondas"],
  [/^\/reports\/debts$/, "Reportes · Deudas"],
  [/^\/reports\/daily$/, "Reportes · Diario"],
  [/^\/reports\/monthly$/, "Reportes · Mensual"],
  [/^\/settings$/, "Configuración"],
]

export function pageTitle(pathname: string): string {
  return TITLES.find(([pattern]) => pattern.test(pathname))?.[1] ?? "Bingo Tally"
}
