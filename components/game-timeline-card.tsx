"use client"

import { ActivityTimelineCard } from "@/components/activity-timeline-card"
import type { GameSessionReport } from "@/lib/game-report/types"

// The Historial of /reports/games/[id].
export function GameTimelineCard({ report }: { report: GameSessionReport }) {
  return (
    <ActivityTimelineCard
      activity={report.activity}
      labels={report.labels}
      title="Historial"
      description="Cada movimiento de la jornada, del más reciente al primero."
      emptyText="Todavía no hay movimientos."
    />
  )
}
