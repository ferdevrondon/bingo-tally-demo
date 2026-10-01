"use client"

import * as React from "react"

import { useHouse } from "@/components/house-provider"
import { RoundHistoryCard } from "@/components/round-history-card"
import { fetchClosedRounds } from "@/lib/game-report/fetch"
import type { RoundReport } from "@/lib/game-report/types"
import { useRoundDraft } from "@/lib/round-draft/context"
import { createClient } from "@/lib/supabase/client"

// /active-round: the closed rounds of this game session, read again each
// time a round closes (state.roundsPlayed changes, live for every viewer).
export function LiveRoundHistory() {
  const { state } = useRoundDraft()
  const timeZone = useHouse()?.timezone ?? "UTC"
  const [rounds, setRounds] = React.useState<RoundReport[]>([])
  const [failed, setFailed] = React.useState(false)
  const { gameSessionId, roundsPlayed } = state

  React.useEffect(() => {
    let cancelled = false
    fetchClosedRounds(createClient(), gameSessionId, timeZone)
      .then((closed) => {
        if (cancelled) return
        setRounds(closed)
        setFailed(false)
      })
      .catch((error) => {
        console.error("round history read failed", error)
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [gameSessionId, roundsPlayed, timeZone])

  return (
    <RoundHistoryCard
      rounds={rounds}
      description={`Jornada #${state.gameNumber}`}
      emptyText={
        failed
          ? "No se pudo cargar el historial. Recarga la página."
          : "Todavía no se cerró ninguna ronda."
      }
    />
  )
}
