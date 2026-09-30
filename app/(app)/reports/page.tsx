import { LiveRefresh } from "@/components/live-refresh"
import { ReportsPage } from "@/components/reports-page"
import { listGameSessions } from "@/lib/data/game-sessions"

export default async function Page() {
  const games = await listGameSessions()
  return (
    <>
      <ReportsPage games={games} />
      <LiveRefresh />
    </>
  )
}
