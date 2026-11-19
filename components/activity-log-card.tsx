"use client"

import { ActivityTimelineCard } from "@/components/activity-timeline-card"
import { useRoundDraft } from "@/lib/round-draft/context"

// The Actividad reciente of /active-round: the live game session's activity,
// laid out and filtered like the report's Historial. Closed by default (one
// row with the latest movement) so a long game session doesn't take the
// page; the open / closed choice is remembered per browser.
export function ActivityLogCard() {
  const { state } = useRoundDraft()

  return (
    <ActivityTimelineCard
      activity={state.activity}
      labels={state}
      title="Actividad reciente"
      description="Cada movimiento de la jornada en vivo, del más reciente al primero."
      emptyText="Todavía no hay actividad en esta jornada."
      collapsible={{ storageKey: "active-round-activity" }}
    />
  )
}
