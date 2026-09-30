import MainPageSplit from "@/components/main-page-split"
import { LiveRefresh } from "@/components/live-refresh"
import { getActiveGameSessionId } from "@/lib/data/load-game-session"

export default async function Page() {
  const activeGameSessionId = await getActiveGameSessionId()
  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <MainPageSplit hasActiveGameSession={activeGameSessionId !== null} />
      </div>
      <LiveRefresh />
    </div>
  )
}
