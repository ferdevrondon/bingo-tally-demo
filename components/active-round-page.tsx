"use client"

import * as React from "react"
import Link from "next/link"

import { ActivityLogCard } from "@/components/activity-log-card"
import { AddPlayerControl } from "@/components/add-player-control"
import { CheckInBalanceAlert } from "@/components/check-in-balance-alert"
import { OpenNumbersCard } from "@/components/open-numbers-card"
import { PlayerActiveCard } from "@/components/player-active-card"
import { RoundHistoryCard } from "@/components/round-history-card"
import { Button } from "@/components/ui/button"
import { useRoundDraft } from "@/lib/round-draft/context"
import { getActivePlayers, hasDraftProgress } from "@/lib/round-draft/selectors"
import PageHeadingWithActions from "./page-heading"
import { Separator } from "./ui/separator"
import { WinningNumbersCard } from "./winning-numbers-card"

export function ActiveRoundPage() {
  const { state } = useRoundDraft()
  const activePlayers = getActivePlayers(state)

  if (!hasDraftProgress(state)) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Todavía no has empezado a asignar cartones.
        </p>
        <Button nativeButton={false} render={<Link href="/new-game" />}>
          Ir a cartones y jugadores
        </Button>
      </div>
    )
  }

  return (
    <div className="@container/main flex flex-1 flex-col gap-6 p-4 lg:p-6">
      <PageHeadingWithActions />
      <Separator className={"border-primary/25 border-2"}/>
      <OpenNumbersCard />

      <div className="flex items-center justify-between">
        <h2 className="text-4xl font-semibold">Jugadores</h2>
        <AddPlayerControl />
      </div>
      <div className="flex items-center justify-between">
        <WinningNumbersCard />
        <CheckInBalanceAlert />
      </div>

      {activePlayers.length > 0 && (
        <div className="grid grid-cols-3 gap-4 @4xl/main:grid-cols-3">
          {activePlayers.map((player) => (
            <PlayerActiveCard
              key={player.id}
              player={player}
              className="w-full"
            />
          ))}
        </div>
      )}
      <RoundHistoryCard selectedDate={new Date()} />
      <ActivityLogCard />
    </div>
  )
}
