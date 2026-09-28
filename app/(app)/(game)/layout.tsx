import { StartGameSessionButton } from "@/components/start-game-session-button"
import { loadActiveGameSession } from "@/lib/data/load-game-session"
import { listRoundTemplates } from "@/lib/data/rounds"
import { RoundDraftProvider } from "@/lib/round-draft/context"

// Shared by /new-game and /active-round, the two routes of the live game.
// Loads the house's active game session from the database (BACKEND_PLAN.md
// §5) and hands it to the provider; every action refreshes the router, so
// this layout reloads the saved state after each one.
export default async function GameLayout({ children }: { children: React.ReactNode }) {
  const [gameSession, roundTemplates] = await Promise.all([
    loadActiveGameSession(),
    listRoundTemplates(),
  ])

  if (!gameSession) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-sm text-muted-foreground">No hay una jornada activa.</p>
        <StartGameSessionButton />
      </div>
    )
  }

  return (
    <RoundDraftProvider initialState={gameSession} roundTemplates={roundTemplates}>
      {children}
    </RoundDraftProvider>
  )
}
