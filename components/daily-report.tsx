"use client"

import { useRouter } from "next/navigation"

import { PeriodReportView } from "@/components/period-report"
import { RoundsDateFilter } from "@/components/rounds-date-filter"
import { dateToDay, dayToDate } from "@/lib/day-param"
import type { PeriodReport } from "@/lib/game-report/types"

// Reportes → Diario: one day of the house; the day lives in the URL (?date=).
export function DailyReport({ report }: { report: PeriodReport }) {
  const router = useRouter()
  return (
    <div className="flex flex-col gap-4 px-4 lg:px-6">
      <div className="flex justify-end">
        <RoundsDateFilter
          date={dayToDate(report.from)}
          onDateChange={(date) => router.push(`/reports/daily?date=${dateToDay(date)}`)}
        />
      </div>
      <PeriodReportView report={report} />
    </div>
  )
}
