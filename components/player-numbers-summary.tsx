"use client"

import type * as React from "react"
import { GiftIcon } from "lucide-react"

import type { PlayerNumberSummary } from "@/lib/round-draft/selectors"
import { formatMoney } from "@/lib/rounds"
import { cn } from "@/lib/utils"

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`
}

// What a player holds without looking at the tickets: each number once
// ("4 ×2" when it is on more than one ticket), its gifts, the total of plays
// and, with `linePrice`, what each number cost ("5 – $10", gifts aren't
// charged) and the total, followed by
// `trailing` (the balance on /new-game and "Ver cartones").
export function PlayerNumbersSummary({
  numbers,
  colorClass,
  linePrice,
  trailing,
}: {
  numbers: PlayerNumberSummary[]
  /** The player's color on the tickets (getPlayerColorClass). */
  colorClass: string
  /** The open round's line price: adds "Total $X" for the paid plays. */
  linePrice?: number
  /** Shown after the total, e.g. the player's balance ("Debe $10"). */
  trailing?: React.ReactNode
}) {
  if (numbers.length === 0 && !trailing) return null
  const plays = numbers.reduce((total, n) => total + n.count, 0)
  const gifts = numbers.reduce((total, n) => total + n.gifts, 0)

  return (
    // Under the name on narrow screens, between the name and the check-in on
    // wide ones (the row in tickets-assignment-page orders the three).
    <div className="order-3 flex min-w-0 basis-full flex-wrap items-center gap-1.5 @2xl/main:order-2 @2xl/main:flex-1 @2xl/main:basis-0">
      {numbers.map(({ number, count, gifts }) => (
        <span
          key={number}
          title={[
            `Número ${number}`,
            plural(count, "jugada", "jugadas"),
            linePrice !== undefined && `Cobrado ${formatMoney((count - gifts) * linePrice)}`,
            gifts > 0 && plural(gifts, "regalo", "regalos"),
          ]
            .filter(Boolean)
            .join(" · ")}
          className={cn(
            "inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs font-semibold text-white tabular-nums",
            colorClass
          )}
        >
          {number}
          {count > 1 && (
            <span className="font-medium opacity-80">×{count}</span>
          )}
          {linePrice !== undefined && (
            <span className="font-medium opacity-80">
              – {formatMoney((count - gifts) * linePrice)}
            </span>
          )}
          {gifts > 0 && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-background px-1 text-destructive">
              <GiftIcon className="size-3" />
              {gifts < count && <span className="text-[10px]">{gifts}</span>}
            </span>
          )}
        </span>
      ))}
      {plays > 0 && (
        <span className="ml-1 text-xs whitespace-nowrap text-muted-foreground">
          {plural(plays, "jugada", "jugadas")}
          {gifts > 0 && ` · ${plural(gifts, "regalo", "regalos")}`}
          {linePrice !== undefined && (
            <>
              {" · "}
              <span className="font-semibold text-foreground">
                Total {formatMoney((plays - gifts) * linePrice)}
              </span>
            </>
          )}
        </span>
      )}
      {trailing && <span className="ml-1 whitespace-nowrap">{trailing}</span>}
    </div>
  )
}

/** "Números de NAME" and their summary in a box, over the tickets of
 *  "Editar jugada" and "Ver cartones". */
export function PlayerPlayBox({
  playerName,
  className,
  ...summary
}: React.ComponentProps<typeof PlayerNumbersSummary> & {
  playerName: string
  className?: string
}) {
  return (
    <section
      className={cn(
        "flex shrink-0 flex-col gap-2 rounded-xl border bg-muted/40 px-4 py-3",
        className
      )}
    >
      <h3 className="text-sm font-semibold">Números de {playerName}</h3>
      <PlayerNumbersSummary {...summary} />
      {summary.numbers.length === 0 && (
        <p className="text-sm text-muted-foreground">Todavía no tiene números.</p>
      )}
    </section>
  )
}
