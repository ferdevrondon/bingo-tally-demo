import GamePage from "@/components/game-page"
import { LiveRefresh } from "@/components/live-refresh"
import { listGameSessions } from "@/lib/data/game-sessions"

export default async function Page() {
  const games = await listGameSessions()
  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <GamePage games={games} />
      </div>
      <LiveRefresh />
    </div>
  )
}
