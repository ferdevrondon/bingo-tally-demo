import type { HouseResult } from "./ledger"

// The house result as a waterfall (/reports/games/[id]): each line moves the
// running total from where the previous one left it, the last bar goes from
// $0 to the result. Positions are percentages of the range the totals cover.

export interface WaterfallStep {
  label: string
  value: number
  /** Left edge and width of the bar, in % of the chart. */
  left: number
  width: number
  total?: boolean
}

export interface Waterfall {
  steps: WaterfallStep[]
  /** Where $0 sits, in % of the chart. */
  zero: number
}

export function houseWaterfall(house: HouseResult): Waterfall {
  const lines = [
    { label: "Ventas de números", value: house.sales },
    { label: "Premios pagados", value: -house.prizes },
    { label: "Regalados que no ganaron", value: house.gifts },
    { label: "Sin vender que no ganaron", value: house.unsoldLosing },
    {
      label: "Sin vender que ganaron (premio para la casa)",
      value: house.unsoldWinning,
    },
  ]
  const spans: [number, number][] = []
  let running = 0
  for (const line of lines) {
    spans.push([running, running + line.value])
    running += line.value
  }
  spans.push([0, house.total])

  const ends = spans.flat()
  const low = Math.min(0, ...ends)
  const range = Math.max(0, ...ends) - low
  const percent = (value: number) =>
    range === 0 ? 0 : ((value - low) / range) * 100

  const steps = [
    ...lines,
    { label: "Resultado de la casa", value: house.total },
  ].map((line, i): WaterfallStep => {
    const [from, to] = spans[i]
    return {
      label: line.label,
      value: line.value,
      left: percent(Math.min(from, to)),
      width: percent(Math.max(from, to)) - percent(Math.min(from, to)),
      ...(i === lines.length && { total: true }),
    }
  })
  return { steps, zero: percent(0) }
}
