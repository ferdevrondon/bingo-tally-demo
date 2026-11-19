"use client"

import { useRouter } from "next/navigation"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { MonthCalendar } from "@/components/month-calendar"
import { PeriodReportView } from "@/components/period-report"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { PeriodReport } from "@/lib/game-report/types"

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number)
  const date = new Date(Date.UTC(y, m - 1 + delta, 1))
  return date.toISOString().slice(0, 7)
}

// Reportes → Mensual: one month of the house (?month=YYYY-MM) and its
// calendar; each day opens its Diario.
export function MonthlyReport({
  report,
  today,
}: {
  report: PeriodReport
  /** The house's today ("YYYY-MM-DD"); the picker doesn't go past its month. */
  today: string
}) {
  const router = useRouter()
  const month = report.from.slice(0, 7)
  const isCurrent = month === today.slice(0, 7)
  const daysPlayed = report.days.filter((d) => d.gameSessions > 0).length
  const go = (delta: number) =>
    router.push(`/reports/monthly?month=${shiftMonth(month, delta)}`)

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-3xl font-bold tracking-tight first-letter:uppercase">
            {report.label}
          </h2>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {isCurrent && (
              <Badge className="bg-success/15 text-success">Mes en curso</Badge>
            )}
            <span>
              {isCurrent && (
                <>
                  Día{" "}
                  <span className="tabular-nums">{Number(today.slice(8))}</span>{" "}
                  de <span className="tabular-nums">{report.days.length}</span>{" "}
                  ·{" "}
                </>
              )}
              <span className="tabular-nums">{daysPlayed}</span>{" "}
              {daysPlayed === 1 ? "día con juego" : "días con juego"}
            </span>
          </div>
        </div>
        <div
          role="group"
          aria-label="Cambiar de mes"
          className="flex items-center gap-1 rounded-full p-1 ring-1 ring-border"
        >
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={() => go(-1)}
            aria-label="Mes anterior"
          >
            <ChevronLeftIcon />
          </Button>
          <span className="min-w-28 text-center text-sm font-medium first-letter:uppercase">
            {report.label}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={() => go(1)}
            disabled={isCurrent || month > today.slice(0, 7)}
            aria-label="Mes siguiente"
          >
            <ChevronRightIcon />
          </Button>
        </div>
      </div>

      <PeriodReportView
        report={report}
        calendar={<MonthCalendar report={report} today={today} />}
      />
    </div>
  )
}
