import { LiveRefresh } from "@/components/live-refresh"
import { StartGameSessionButton } from "@/components/start-game-session-button"
import { getCurrentHouse } from "@/lib/data/house"
import { loadActiveGameSession } from "@/lib/data/load-game-session"
import { listRoundTemplates } from "@/lib/data/rounds"
import { RoundDraftProvider } from "@/lib/round-draft/context"

// Shared by /new-game and /active-round, the two routes of the live game.
// Loads the house's active game session from the database (BACKEND_PLAN.md
// §5) and hands it to the provider, which keeps it in sync from the browser
// (after each action and on every Realtime activity row). Observers see it
// read-only.
export default async function GameLayout({ children }: { children: React.ReactNode }) {
  const [gameSession, roundTemplates, house] = await Promise.all([
    loadActiveGameSession(),
    listRoundTemplates(),
    getCurrentHouse(),
  ])
  const isAdmin = house?.role === "admin"

  if (!gameSession) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-sm text-muted-foreground">No hay una jornada activa.</p>
        {isAdmin && <StartGameSessionButton />}
        {/* Enters the game session as soon as the admin starts one. */}
        <LiveRefresh />
      </div>
    )
  }

  return (
    <RoundDraftProvider initialState={gameSession} roundTemplates={roundTemplates}>
      {children}
    </RoundDraftProvider>
  )
}
