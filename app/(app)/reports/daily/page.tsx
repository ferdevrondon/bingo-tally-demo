import { DailyReport } from "@/components/daily-report"
import { LiveRefresh } from "@/components/live-refresh"
import { loadDailyReport } from "@/lib/data/game-sessions"

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ date?: string | string[] }>
}) {
  const { date } = await searchParams
  const report = await loadDailyReport(typeof date === "string" ? date : undefined)
  return (
    <>
      {report && <DailyReport report={report} />}
      <LiveRefresh />
    </>
  )
}
