import { LiveRefresh } from "@/components/live-refresh"
import PlayerPage from "@/components/player-page"
import { listPlayerAccounts } from "@/lib/data/accounts"
import { listPlayers } from "@/lib/data/players"

export default async function Page() {
  const [players, accounts] = await Promise.all([listPlayers(), listPlayerAccounts()])

  return (
    <div className="flex flex-1 flex-col px-6">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <PlayerPage players={players} accounts={[...accounts.values()]} />
      </div>
      <LiveRefresh />
    </div>
  )
}
