"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { useActivityFeed } from "@/hooks/use-activity-feed"

const REFRESH_DELAY_MS = 250

// Mounted by server-rendered pages that must follow the admin live (the
// settlement, /settlement, /players, home): any new activity of the house
// re-renders the page on the server. Client state (an open dialog, a typed
// amount) survives router.refresh().
export function LiveRefresh() {
  const router = useRouter()
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    []
  )

  const schedule = React.useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => router.refresh(), REFRESH_DELAY_MS)
  }, [router])

  useActivityFeed(schedule)
  return null
}
