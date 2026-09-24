import { listPlayers } from "@/lib/data/players"
import { listRoundTemplates } from "@/lib/data/rounds"
import { RoundDraftProvider } from "@/lib/round-draft/context"
import { toDraftPlayer } from "@/lib/round-draft/players"

// Shared by /new-game and /active-round, the two routes of the live game
// flow, so the draft survives navigating between them. Loads the house's
// catalog (players and round templates) for the draft. BACKEND_PLAN.md
// Phase 4 also loads the active game session here.
export default async function GameLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [players, roundTemplates] = await Promise.all([
    listPlayers(),
    listRoundTemplates(),
  ])

  return (
    <RoundDraftProvider
      basePlayers={players.map(toDraftPlayer)}
      roundTemplates={roundTemplates}
    >
      {children}
    </RoundDraftProvider>
  )
}
