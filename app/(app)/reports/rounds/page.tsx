import { LiveRefresh } from "@/components/live-refresh"
import { RoundsReport } from "@/components/rounds-report"
import { loadRoundsOfDay } from "@/lib/data/game-sessions"
import { pageTitle } from "@/lib/page-titles"

export const metadata = { title: pageTitle("/reports/rounds") }

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ date?: string | string[] }>
}) {
  const { date } = await searchParams
  const report = await loadRoundsOfDay(typeof date === "string" ? date : undefined)
  return (
    <>
      {report && <RoundsReport report={report} />}
      <LiveRefresh />
    </>
  )
}
