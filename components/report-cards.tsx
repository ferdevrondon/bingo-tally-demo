import type * as React from "react"

import { Card, CardContent } from "@/components/ui/card"
import type { HouseResult } from "@/lib/game-report/ledger"
import { houseWaterfall } from "@/lib/game-report/waterfall"
import { signedMoney } from "@/lib/round-draft/balance"
import { cn } from "@/lib/utils"

// Pieces shared by the report dashboards: a game session (/reports/games/[id])
// and a period (Diario, Mensual).

export function signTone(value: number) {
  return value > 0 ? "text-success" : value < 0 ? "text-destructive" : undefined
}

export function KpiCard({
  label,
  children,
  footer,
}: {
  label: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-1">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </span>
        <div className="text-3xl font-bold tracking-tight tabular-nums">
          {children}
        </div>
        {footer && (
          <div className="text-xs text-muted-foreground">{footer}</div>
        )}
      </CardContent>
    </Card>
  )
}

/** The house result as a waterfall: label, bar and amount on one line when
 *  the card is wide, the bar under its label when it is narrow. */
export function HouseResultWaterfall({ house }: { house: HouseResult }) {
  const { steps, zero } = houseWaterfall(house)
  return (
    <div className="@container/waterfall">
      <dl className="flex flex-col">
        {steps.map((step) => (
          <div
            key={step.label}
            className={cn(
              "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 @xl/waterfall:grid-cols-[minmax(10rem,14rem)_minmax(0,1fr)_5rem]",
              step.total ? "mt-1.5 border-t pt-1.5" : ""
            )}
          >
            <dt
              className={cn(
                "py-1 text-sm",
                step.total ? "font-semibold" : "text-muted-foreground"
              )}
            >
              {step.label}
            </dt>
            <div
              aria-hidden="true"
              className="relative col-span-2 row-start-2 mb-1.5 h-4 @xl/waterfall:col-span-1 @xl/waterfall:col-start-2 @xl/waterfall:row-start-1 @xl/waterfall:mb-0 @xl/waterfall:h-10"
            >
              <div
                className="absolute inset-y-0 w-px bg-border"
                style={{ left: `${zero}%` }}
              />
              {step.width > 0 && (
                <div
                  className={cn(
                    "absolute top-1/2 -translate-y-1/2 rounded",
                    step.total ? "h-4" : "h-3",
                    step.total
                      ? step.value >= 0
                        ? "bg-success"
                        : "bg-destructive"
                      : step.value >= 0
                        ? "bg-primary"
                        : "bg-destructive/45"
                  )}
                  style={{
                    left: `${step.left}%`,
                    width: `max(${step.width}%, 4px)`,
                  }}
                />
              )}
            </div>
            <dd
              className={cn(
                "text-right tabular-nums @xl/waterfall:col-start-3",
                step.total
                  ? cn("text-base font-bold", signTone(step.value))
                  : "font-medium"
              )}
            >
              {signedMoney(step.value)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
