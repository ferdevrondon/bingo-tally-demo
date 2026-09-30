import { GameDetailPage } from "@/components/game-detail-page"
import { LiveRefresh } from "@/components/live-refresh"
import { loadGameSessionReport } from "@/lib/data/game-sessions"

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const gameSessionId = Number(id)
  const report =
    Number.isInteger(gameSessionId) && gameSessionId > 0
      ? await loadGameSessionReport(gameSessionId)
      : null

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <GameDetailPage report={report} />
      </div>
      <LiveRefresh />
    </div>
  )
}
