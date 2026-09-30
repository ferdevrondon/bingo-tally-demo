import { LiveRefresh } from "@/components/live-refresh"
import { RoundsReport } from "@/components/rounds-report"
import { loadRoundsOfDay } from "@/lib/data/game-sessions"

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
