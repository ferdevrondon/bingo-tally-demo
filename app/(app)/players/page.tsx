import PlayerPage from "@/components/player-page"
import { listPlayers } from "@/lib/data/players"

export default async function Page() {
  const players = await listPlayers()

  return (
    <div className="flex flex-1 flex-col px-6">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <PlayerPage players={players} />
      </div>
    </div>
  )
}
