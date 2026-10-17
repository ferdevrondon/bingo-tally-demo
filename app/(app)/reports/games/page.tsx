import GamePage from "@/components/game-page"
import { LiveRefresh } from "@/components/live-refresh"
import { listGameSessions } from "@/lib/data/game-sessions"
import { pageTitle } from "@/lib/page-titles"

export const metadata = { title: pageTitle("/reports/games") }

export default async function Page() {
  const games = await listGameSessions()
  return (
    <>
      <GamePage games={games} />
      <LiveRefresh />
    </>
  )
}
