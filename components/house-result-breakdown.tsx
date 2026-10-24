import { signedMoney } from "@/lib/round-draft/balance"
import type { HouseResult } from "@/lib/game-report/ledger"
import type { NumbersInfo } from "@/lib/game-report/round-counts"
import { formatMoney } from "@/lib/rounds"
import { cn } from "@/lib/utils"

/** What happened to the numbers: cards sold, numbers sold, gifted and the
 *  house's. A dashed box of its own, muted and without signs, so it isn't read
 *  as part of the sum below it (`HouseResultBreakdown`). */
export function NumbersInfoList({
  numbers,
  className,
}: {
  numbers: NumbersInfo
  className?: string
}) {
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
  const rows: { label: string; note?: string }[] = [
    { label: plural(numbers.tickets, "cartón vendido", "cartones vendidos") },
    { label: plural(numbers.sold, "número vendido", "números vendidos") },
    {
      label: plural(numbers.gifted, "número regalado", "números regalados"),
      note: `valor ${formatMoney(numbers.giftedValue)}`,
    },
    {
      label: plural(numbers.houseNumbers, "número se quedó la casa", "números se quedó la casa"),
      note: `valor ${formatMoney(numbers.houseValue)}`,
    },
  ]
  return (
    <section
      className={cn(
        "rounded-md border border-dashed bg-muted/30 px-3 py-2 text-sm text-muted-foreground",
        className
      )}
    >
      <dl className="flex flex-col gap-1">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4">
            <dt>{row.label}</dt>
            <dd className="text-xs italic tabular-nums">{row.note}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

// The house result of a round or a game session, line by line. Since
// 2026-10-23 it is cash only: sales - prizes paid. The three margin lines only
// show for rounds closed before that, which kept their old margin.
export function HouseResultBreakdown({
  house,
  numbers,
  className,
}: {
  house: HouseResult
  /** What happened to the numbers: shown first, for reference (no sums). */
  numbers?: NumbersInfo | null
  className?: string
}) {
  const lines: { label: string; value: number }[] = [
    { label: numbers ? "Venta de números" : "Ventas de números", value: house.sales },
    numbers
      ? { label: "Premios (valor completo)", value: -numbers.grossPrizes }
      : { label: "Premios pagados", value: -house.prizes },
    ...(numbers && numbers.giftDiscount !== 0
      ? [{ label: "Número regalado ganador (descuento)", value: numbers.giftDiscount }]
      : []),
    { label: "Regalados que no ganaron", value: house.gifts },
    { label: "Sin vender que no ganaron", value: house.unsoldLosing },
    { label: "Sin vender que ganaron (premio para la casa)", value: house.unsoldWinning },
  ].filter((line, i) => i < 2 || line.value !== 0)

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {numbers && <NumbersInfoList numbers={numbers} />}
      <section className="rounded-md border bg-background/60 px-3 py-2 text-sm">
        <h4 className="mb-1.5 text-[11px] font-bold tracking-wide text-foreground uppercase">
          Caja de la ronda
        </h4>
        <dl className="flex flex-col gap-1.5">
          {lines.map((line) => (
            <div key={line.label} className="flex items-center justify-between gap-4">
              <dt>{line.label}</dt>
              <dd className="font-medium tabular-nums">{signedMoney(line.value)}</dd>
            </div>
          ))}
          <div className="mt-1 flex items-center justify-between gap-4 border-t-2 border-double pt-2">
            <dt className="font-semibold">= Resultado de la casa</dt>
            <dd
              className={cn(
                "text-base font-bold tabular-nums",
                house.total >= 0 ? "text-success" : "text-destructive"
              )}
            >
              {signedMoney(house.total)}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  )
}
