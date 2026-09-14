"use client"

import { RoundHistoryCard } from "@/components/round-history-card"

export function ReportsPage() {
  return (
    <div className="@container/main flex flex-1 flex-col gap-6 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Historial</h1>
        <p className="text-sm text-muted-foreground">Reporte de rondas y resultados por jornada.</p>
      </div>
      <RoundHistoryCard />
    </div>
  )
}
