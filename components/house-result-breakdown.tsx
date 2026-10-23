import { signedMoney } from "@/lib/round-draft/balance"
import type { HouseResult } from "@/lib/game-report/ledger"
import { cn } from "@/lib/utils"

// The house result of a round or a game session, line by line. Since
// 2026-10-23 it is cash only: sales - prizes paid. The three margin lines only
// show for rounds closed before that, which kept their old margin.
export function HouseResultBreakdown({
  house,
  className,
}: {
  house: HouseResult
  className?: string
}) {
  const lines: { label: string; value: number }[] = [
    { label: "Ventas de números", value: house.sales },
    { label: "Premios pagados", value: -house.prizes },
    { label: "Regalados que no ganaron", value: house.gifts },
    { label: "Sin vender que no ganaron", value: house.unsoldLosing },
    { label: "Sin vender que ganaron (premio para la casa)", value: house.unsoldWinning },
  ].filter((line, i) => i < 2 || line.value !== 0)

  return (
    <dl className={cn("flex flex-col gap-1.5 text-sm", className)}>
      {lines.map((line) => (
        <div key={line.label} className="flex items-center justify-between gap-4">
          <dt className="text-muted-foreground">{line.label}</dt>
          <dd className="font-medium tabular-nums">{signedMoney(line.value)}</dd>
        </div>
      ))}
      <div className="mt-1 flex items-center justify-between gap-4 border-t pt-2">
        <dt className="font-semibold">Resultado de la casa</dt>
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
  )
}
