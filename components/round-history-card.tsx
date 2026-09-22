"use client"

import * as React from "react"
import { AwardIcon, ChevronDownIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatFilterDateLabel, isSameDay } from "@/components/rounds-date-filter"

interface RoundHistoryEntry {
  id: number
  roundNumber: number
  winningNumber: number
  date: Date
  winnerName: string
  linesSold: number
  totalPrice: number
  winnerPayout: number
  houseResult: number // negative = house lost money on this round
}

function daysAgo(n: number): Date {
  const date = new Date()
  date.setHours(14, 0, 0, 0)
  date.setDate(date.getDate() - n)
  return date
}

function formatRoundTime(date: Date) {
  return date.toLocaleTimeString("es-ES", { hour: "numeric", minute: "2-digit" })
}

const rounds: RoundHistoryEntry[] = [
  {
    id: 1,
    roundNumber: 1,
    winningNumber: 6,
    date: daysAgo(0),
    winnerName: "Juan Pérez",
    linesSold: 5,
    totalPrice: 500,
    winnerPayout: 450,
    houseResult: -250,
  },
  {
    id: 2,
    roundNumber: 2,
    winningNumber: 8,
    date: daysAgo(1),
    winnerName: "María López",
    linesSold: 6,
    totalPrice: 600,
    winnerPayout: 400,
    houseResult: 90,
  },
  {
    id: 3,
    roundNumber: 3,
    winningNumber: 3,
    date: daysAgo(2),
    winnerName: "Carlos Ruiz",
    linesSold: 4,
    totalPrice: 400,
    winnerPayout: 320,
    houseResult: -70,
  },
]

function formatAmount(amount: number) {
  const sign = amount < 0 ? "-" : ""
  return `${sign}$${Math.abs(amount).toLocaleString("en-US")}`
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="text-xs tracking-wide text-muted-foreground uppercase">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  )
}

function ResultBox({
  label,
  amount,
  variant,
}: {
  label: string
  amount: number
  /** "primary" always uses the brand color (e.g. a payout, always positive for its recipient).
   *  "auto" colors green/destructive based on the amount's sign (e.g. a profit-or-loss result). */
  variant: "primary" | "auto"
}) {
  const isPositive = amount >= 0
  const colorClasses =
    variant === "primary"
      ? { box: "bg-primary/10", text: "text-primary" }
      : isPositive
        ? { box: "bg-green-50 dark:bg-green-950", text: "text-green-700 dark:text-green-400" }
        : { box: "bg-destructive/10", text: "text-destructive" }

  return (
    <div className={cn("flex flex-1 items-center justify-between rounded-lg p-3", colorClasses.box)}>
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={cn("text-lg font-semibold", colorClasses.text)}>
        {isPositive ? "+" : ""}
        {formatAmount(amount)}
      </span>
    </div>
  )
}

export function RoundHistoryCard({ selectedDate }: { selectedDate: Date }) {
  const dayRounds = rounds.filter((round) => isSameDay(round.date, selectedDate))
  const [expandedId, setExpandedId] = React.useState<number | null>(dayRounds[0]?.id ?? null)

  React.useEffect(() => {
    setExpandedId(dayRounds[0]?.id ?? null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate])

  const houseBalance = dayRounds.reduce((sum, r) => sum + r.houseResult, 0)
  const balanceIsPositive = houseBalance >= 0

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Historial de rondas</CardTitle>
          <CardDescription>{formatFilterDateLabel(selectedDate)}</CardDescription>
        </div>
        {dayRounds.length > 0 && (
          <Badge
            variant="outline"
            className={cn(
              balanceIsPositive
                ? "border-green-600/30 text-green-700 dark:text-green-400"
                : "border-destructive/40 text-destructive"
            )}
          >
            Balance casa: {balanceIsPositive ? "+" : ""}
            {formatAmount(houseBalance)}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {dayRounds.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No hay rondas registradas para esta fecha.
          </p>
        )}
        {dayRounds.map((round) => {
          const isExpanded = expandedId === round.id
          return (
            <div
              key={round.id}
              className={cn(
                "rounded-xl border transition-colors pointer",
                isExpanded ? "border-primary/40 bg-primary/5" : "border-border"
              )}
            >
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : round.id)}
                className="flex w-full flex-wrap items-center justify-between gap-3 p-2 text-left"
              >
                <span className="font-medium">Ronda {round.roundNumber}</span>
                <span className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-green-700">
                  <AwardIcon className="size-4" color="green" /># {round.winningNumber}
                </span>
                <span className="text-sm text-muted-foreground">{formatRoundTime(round.date)}</span>
                <ChevronDownIcon
                  className={cn(
                    "size-4 text-muted-foreground transition-transform",
                    isExpanded && "rotate-180"
                  )}
                />
              </button>

              {isExpanded && (
                <div className="flex flex-col gap-3 border-t px-4 pt-3 pb-4">
                  <div className="grid grid-cols-2 gap-3 @sm/main:grid-cols-4">
                    <Stat label="Ganador" value={round.winnerName} />
                    <Stat label="Número ganador" value={`#${round.winningNumber}`} />
                    <Stat label="Líneas vendidas" value={String(round.linesSold)} />
                    <Stat label="Precio total" value={formatAmount(round.totalPrice)} />
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <ResultBox
                      label="Ganancia del ganador"
                      amount={round.winnerPayout}
                      variant="primary"
                    />
                    <ResultBox
                      label="Resultado para la casa"
                      amount={round.houseResult}
                      variant="auto"
                    />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
