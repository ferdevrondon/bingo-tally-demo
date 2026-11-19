import * as React from "react"

import { useHouse } from "@/components/house-provider"
import { createClient } from "@/lib/supabase/client"
import type { Database } from "@/lib/supabase/database.types"

export type ActivityRow = Database["public"]["Tables"]["activity_log"]["Row"]

let channelCount = 0

/**
 * Calls `onChange` for every new `activity_log` row of the current house
 * (Realtime; RLS decides which rows each user receives), and with `null`
 * when the channel reconnects, since rows written while it was down never
 * arrive: the caller should read again. Every game, account and settlement
 * write adds a row there, so it is the single "something changed" signal.
 * One channel per mounted caller, removed on unmount.
 */
export function useActivityFeed(onChange: (row: ActivityRow | null) => void) {
  const houseId = useHouse()?.houseId ?? null
  const callback = React.useRef(onChange)

  React.useEffect(() => {
    callback.current = onChange
  }, [onChange])

  React.useEffect(() => {
    if (houseId === null) return
    const supabase = createClient()
    let subscribedOnce = false
    channelCount += 1
    const channel = supabase
      .channel(`activity-${houseId}-${channelCount}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "activity_log",
          filter: `house_id=eq.${houseId}`,
        },
        (payload) => callback.current(payload.new as ActivityRow)
      )
      .subscribe((status) => {
        if (status !== "SUBSCRIBED") return
        if (subscribedOnce) callback.current(null)
        subscribedOnce = true
      })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [houseId])
}
