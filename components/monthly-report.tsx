"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { PeriodReportView } from "@/components/period-report"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { PeriodReport } from "@/lib/game-report/types"
import { signedMoney } from "@/lib/round-draft/balance"
import { cn } from "@/lib/utils"

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number)
  const date = new Date(Date.UTC(y, m - 1 + delta, 1))
  return date.toISOString().slice(0, 7)
}

// Reportes → Mensual: one month of the house (?month=YYYY-MM) and a
// day-by-day table; each day opens its Diario.
export function MonthlyReport({
  report,
  currentMonth,
}: {
  report: PeriodReport
  /** The house's current month; the picker doesn't go past it. */
  currentMonth: string
}) {
  const router = useRouter()
  const month = report.from.slice(0, 7)
  const go = (delta: number) => router.push(`/reports/monthly?month=${shiftMonth(month, delta)}`)

  return (
    <div className="flex flex-col gap-4 px-4 lg:px-6">
      <div className="flex items-center justify-end gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          className="rounded-full"
          onClick={() => go(-1)}
          aria-label="Mes anterior"
        >
          <ChevronLeftIcon />
        </Button>
        <span className="min-w-40 text-center text-sm font-medium first-letter:uppercase">
          {report.label}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          className="rounded-full"
          onClick={() => go(1)}
          disabled={month >= currentMonth}
          aria-label="Mes siguiente"
        >
          <ChevronRightIcon />
        </Button>
      </div>

      <PeriodReportView report={report} />

      <Card>
        <CardHeader>
          <CardTitle>Día por día</CardTitle>
          <CardDescription>Abre un día para ver su reporte diario.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 pr-3 font-medium">Día</th>
                  <th className="px-3 py-2 text-right font-medium">Jornadas</th>
                  <th className="px-3 py-2 text-right font-medium">Resultado de la casa</th>
                  <th className="px-3 py-2 text-right font-medium">Caja neta</th>
                </tr>
              </thead>
              <tbody>
                {report.days.map((d) => {
                  const quiet = d.gameSessions === 0 && d.netCash === 0
                  return (
                    <tr
                      key={d.day}
                      className={cn("border-b last:border-b-0", quiet && "text-muted-foreground/60")}
                    >
                      <td className="py-1.5 pr-3">
                        <Link
                          href={`/reports/daily?date=${d.day}`}
                          className="underline-offset-4 hover:underline"
                        >
                          {d.label}
                        </Link>
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{d.gameSessions || "—"}</td>
                      <td
                        className={cn(
                          "px-3 py-1.5 text-right tabular-nums",
                          !quiet && d.houseTotal < 0 && "text-destructive",
                          !quiet && d.houseTotal > 0 && "text-green-600"
                        )}
                      >
                        {d.gameSessions ? signedMoney(d.houseTotal) : "—"}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums">
                        {d.netCash ? signedMoney(d.netCash) : "—"}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
