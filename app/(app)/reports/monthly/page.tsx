import { LiveRefresh } from "@/components/live-refresh"
import { MonthlyReport } from "@/components/monthly-report"
import { loadMonthlyReport } from "@/lib/data/game-sessions"
import { getCurrentHouse } from "@/lib/data/house"
import { houseToday } from "@/lib/game-report/format"

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ month?: string | string[] }>
}) {
  const { month } = await searchParams
  const [report, house] = await Promise.all([
    loadMonthlyReport(typeof month === "string" ? month : undefined),
    getCurrentHouse(),
  ])
  return (
    <>
      {report && house && (
        <MonthlyReport report={report} currentMonth={houseToday(house.timezone).slice(0, 7)} />
      )}
      <LiveRefresh />
    </>
  )
}
