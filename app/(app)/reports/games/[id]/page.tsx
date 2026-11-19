import { GameDetailPage } from "@/components/game-detail-page"
import { LiveRefresh } from "@/components/live-refresh"
import { loadGameSessionReport } from "@/lib/data/game-sessions"
import { pageTitle } from "@/lib/page-titles"

export const metadata = { title: pageTitle("/reports/games/1") }

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const gameSessionId = Number(id)
  const report =
    Number.isInteger(gameSessionId) && gameSessionId > 0
      ? await loadGameSessionReport(gameSessionId)
      : null

  return (
    <>
      <GameDetailPage report={report} />
      <LiveRefresh />
    </>
  )
}
