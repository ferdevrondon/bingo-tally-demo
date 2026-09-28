import { signedMoney } from "@/lib/round-draft/balance"
import type { HouseResult } from "@/lib/round-draft/game-api"
import { cn } from "@/lib/utils"

// The house result of a round or a game session, line by line (decided with
// the product owner on 2026-09-28): sales - prizes paid + what the house
// "plays" with gifted and unsold numbers.
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
  ]

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
            house.total >= 0 ? "text-green-600" : "text-destructive"
          )}
        >
          {signedMoney(house.total)}
        </dd>
      </div>
    </dl>
  )
}
