"use client"

import type { GameSessionListItem } from "@/lib/game-report/types"
import ReportsTabs from "./tabs-solid"

export function ReportsPage({ games }: { games: GameSessionListItem[] }) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <ReportsTabs games={games} />
        </div>
      </div>
    </div>
  )
}
