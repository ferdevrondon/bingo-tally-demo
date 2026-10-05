import { HomePage } from "@/components/home-page"
import { LiveRefresh } from "@/components/live-refresh"
import { loadHome } from "@/lib/data/game-sessions"

export default async function Page() {
  const home = await loadHome()
  return (
    <div className="@container/main flex flex-1 flex-col">
      {home ? (
        <HomePage home={home} />
      ) : (
        <p className="p-6 text-sm text-muted-foreground">
          Tu usuario todavía no pertenece a ninguna casa.
        </p>
      )}
      <LiveRefresh />
    </div>
  )
}
