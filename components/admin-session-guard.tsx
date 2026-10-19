"use client"

import * as React from "react"

import { SESSION_REPLACED_PATH } from "@/lib/admin-session-paths"
import { createClient } from "@/lib/supabase/client"
import { isJwtError, refreshExpiredSession } from "@/lib/supabase/expired-session"

const HEARTBEAT_MS = 60_000

// Mounted by app/(app)/layout.tsx for the house admin only. Keeps this
// device's claim fresh (admin_session_status treats a claim unseen for 2 min
// as stale) and signs this device out as soon as another one takes the
// session: instantly via Realtime, or at the next heartbeat if the Realtime
// event was missed. The database already rejects writes from a replaced
// session; this only makes the UI follow.
export function AdminSessionGuard() {
  React.useEffect(() => {
    const supabase = createClient()
    let cancelled = false
    let replaced = false
    let intervalId: ReturnType<typeof setInterval> | undefined
    let channel: ReturnType<typeof supabase.channel> | undefined

    async function leave() {
      if (replaced) return
      replaced = true
      await supabase.auth.signOut({ scope: "local" })
      window.location.replace(SESSION_REPLACED_PATH)
    }

    async function heartbeat() {
      const { error } = await supabase.rpc("admin_heartbeat")
      // Expired access token: refresh it (then claim again), or the refresh
      // token is gone too and this device goes to /login.
      if (isJwtError(error)) {
        if (!(await refreshExpiredSession(supabase))) return
        await supabase.rpc("admin_heartbeat")
      }
      const { data: status } = await supabase.rpc("admin_session_status")
      if (status === "other_active" || status === "other_stale") await leave()
    }

    async function start() {
      const { data } = await supabase.auth.getClaims()
      const claims = data?.claims
      if (cancelled || !claims) return
      const mySessionId = claims.session_id

      channel = supabase
        .channel("admin-session")
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "admin_auth_sessions",
            filter: `user_id=eq.${claims.sub}`,
          },
          (payload) => {
            const next = payload.new as { session_id?: string }
            if (next.session_id && next.session_id !== mySessionId) void leave()
          }
        )
        .subscribe()

      void heartbeat()
      intervalId = setInterval(() => void heartbeat(), HEARTBEAT_MS)
      document.addEventListener("visibilitychange", onVisible)
    }

    // A phone that slept or switched apps paused the timers (supabase-js's
    // token refresh too): check in right away instead of waiting for the next
    // tick, so an expired token is refreshed before the admin's next tap.
    function onVisible() {
      if (document.visibilityState === "visible") void heartbeat()
    }

    void start()

    return () => {
      cancelled = true
      document.removeEventListener("visibilitychange", onVisible)
      if (intervalId) clearInterval(intervalId)
      if (channel) void supabase.removeChannel(channel)
    }
  }, [])

  return null
}
