"use client"

import { useHouse } from "@/components/house-provider"
import { APP_VERSION, BUILD_TIME, COMMIT_SHA } from "@/lib/app-version"

// "v0.0.1 · 8b07ff5" under the user in the sidebar, so it is clear which build
// a deployment is serving; the title has the build date in the house time zone.
export function AppVersion() {
  const timeZone = useHouse()?.timezone
  const built = BUILD_TIME
    ? new Intl.DateTimeFormat("es", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone,
      }).format(new Date(BUILD_TIME))
    : null

  return (
    <p
      title={built ? `Compilado el ${built}` : undefined}
      className="px-2 pb-1 text-center text-[11px] text-muted-foreground tabular-nums group-data-[collapsible=icon]:hidden"
    >
      v{APP_VERSION} · {COMMIT_SHA}
    </p>
  )
}
