"use client"

import Link from "next/link"

import { ActivityLogCard } from "@/components/activity-log-card"
import { CheckInBalanceAlert } from "@/components/check-in-balance-alert"
import { OpenNumbersCard } from "@/components/open-numbers-card"
import { PlayerActiveCard } from "@/components/player-active-card"
import { RoundHistoryCard } from "@/components/round-history-card"
import { WinningNumbersCard } from "@/components/winning-numbers-card"
import { Button } from "@/components/ui/button"
import { useRoundDraft } from "@/lib/round-draft/context"
import { getActivePlayers, hasDraftProgress } from "@/lib/round-draft/selectors"
import PageHeadingWithActions from "./page-heading"

export function ActiveRoundPage() {
  const { state } = useRoundDraft()
  const activePlayers = getActivePlayers(state)

  if (!hasDraftProgress(state)) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Todavía no has empezado a asignar cartones.
        </p>
        <Button nativeButton={false} render={<Link href="/nueva-jornada" />}>
          Ir a cartones y jugadores
        </Button>
      </div>
    )
  }

  return (
    <div className="@container/main flex flex-1 flex-col gap-6 p-4 lg:p-6">
      <PageHeadingWithActions />
      <OpenNumbersCard />
      <WinningNumbersCard />
      <CheckInBalanceAlert />
      {activePlayers.length > 0 && (
        <div className="grid grid-cols-3 gap-4 @4xl/main:grid-cols-4">
          {activePlayers.map((player) => (
            <PlayerActiveCard key={player.id} player={player} className="w-full" />
          ))}
        </div>
      )}
      <RoundHistoryCard />
      <ActivityLogCard />
    </div>
  )
}
