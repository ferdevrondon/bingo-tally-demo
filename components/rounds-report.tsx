"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"

import { RoundHistoryCard } from "@/components/round-history-card"
import { RoundsDateFilter } from "@/components/rounds-date-filter"
import { Badge } from "@/components/ui/badge"
import type { RoundsOfDay } from "@/lib/game-report/types"
import { signedMoney } from "@/lib/round-draft/balance"
import { cn } from "@/lib/utils"

function toDate(day: string) {
  const [y, m, d] = day.split("-").map(Number)
  return new Date(y, m - 1, d)
}

function toDay(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// Reportes → Rondas: every round played on the chosen day (house time zone),
// grouped by game session. The day lives in the URL (?date=), so reloading
// and "back" keep it.
export function RoundsReport({ report }: { report: RoundsOfDay }) {
  const router = useRouter()
  const roundsCount = report.gameSessions.reduce((sum, g) => sum + g.rounds.length, 0)

  return (
    <div className="flex flex-col gap-4 px-4 lg:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            {roundsCount} ronda{roundsCount === 1 ? "" : "s"} jugada{roundsCount === 1 ? "" : "s"}
          </span>
          {roundsCount > 0 && (
            <Badge
              variant="outline"
              className={cn(
                report.houseTotal >= 0
                  ? "border-green-600/30 text-green-700 dark:text-green-400"
                  : "border-destructive/40 text-destructive"
              )}
            >
              Resultado de la casa del día: {signedMoney(report.houseTotal)}
            </Badge>
          )}
        </div>
        <RoundsDateFilter
          date={toDate(report.day)}
          onDateChange={(date) => router.push(`/reports/rounds?date=${toDay(date)}`)}
        />
      </div>

      {report.gameSessions.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
          No se jugaron rondas este día.
        </p>
      ) : (
        report.gameSessions.map((g) => (
          <div key={g.id} className="flex flex-col gap-2">
            <Link
              href={`/reports/games/${g.id}`}
              className="w-fit text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Jornada #{g.number} · ver reporte
            </Link>
            <RoundHistoryCard rounds={g.rounds} description={`Jornada #${g.number}`} />
          </div>
        ))
      )}
    </div>
  )
}
