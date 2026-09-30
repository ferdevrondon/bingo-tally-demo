import MainPageSplit from "@/components/main-page-split"
import { LiveRefresh } from "@/components/live-refresh"
import { loadHomeSummary } from "@/lib/data/game-sessions"

export default async function Page() {
  const summary = await loadHomeSummary()
  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <MainPageSplit summary={summary} />
      </div>
      <LiveRefresh />
    </div>
  )
}
