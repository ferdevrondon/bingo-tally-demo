"use client"

import * as React from "react"
import Link from "next/link"
import { LayoutGridIcon } from "lucide-react"

import { ActivityLogCard } from "@/components/activity-log-card"
import { AddPlayerControl } from "@/components/add-player-control"
import { CheckInBalanceAlert } from "@/components/check-in-balance-alert"
import { RoundGiftsCard } from "@/components/round-gifts-card"
import { LiveRoundHistory } from "@/components/live-round-history"
import { OpenNumbersCard } from "@/components/open-numbers-card"
import { PlayerActiveCard } from "@/components/player-active-card"
import { TicketsBoardDialog } from "@/components/tickets-board-dialog"
import { Button } from "@/components/ui/button"
import { useRoundDraft } from "@/lib/round-draft/context"
import { getActivePlayers } from "@/lib/round-draft/selectors"
import PageHeadingWithActions from "./page-heading"
import { Separator } from "./ui/separator"
import { WinningNumbersCard } from "./winning-numbers-card"

export function ActiveRoundPage() {
  const { state, readOnly } = useRoundDraft()
  const activePlayers = getActivePlayers(state)
  // "Ver cartones": opened from its button, or from a number of "Números
  // disponibles" (then that number is ringed on the tickets).
  const [ticketsView, setTicketsView] = React.useState<{
    open: boolean
    highlightNumber: number | null
  }>({ open: false, highlightNumber: null })

  if (!state.round) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          {readOnly
            ? "Todavía no se eligió la ronda de esta jornada."
            : "Todavía no has elegido la ronda de esta jornada."}
        </p>
        <Button nativeButton={false} render={<Link href="/new-game" />}>
          {readOnly ? "Ver cartones y jugadores" : "Ir a cartones y jugadores"}
        </Button>
      </div>
    )
  }

  return (
    <div className="@container/main flex flex-1 flex-col gap-6 p-4 lg:p-6">
      <PageHeadingWithActions />
      <Separator className={"border-primary/25 border-2"}/>
      <OpenNumbersCard
        onNumberClick={(number) =>
          setTicketsView({ open: true, highlightNumber: number })
        }
      />

      <div className="flex items-center justify-between">
        <h2 className="text-4xl font-semibold">Jugadores</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setTicketsView({ open: true, highlightNumber: null })}
          >
            <LayoutGridIcon />
            Ver cartones
          </Button>
          {!readOnly && <AddPlayerControl />}
        </div>
      </div>
      <div className="flex items-center justify-between">
        <WinningNumbersCard />
        <CheckInBalanceAlert />
      </div>
      <RoundGiftsCard />

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
      <LiveRoundHistory />
      <ActivityLogCard />

      <TicketsBoardDialog
        open={ticketsView.open}
        onOpenChange={(open) =>
          setTicketsView((current) => ({ ...current, open }))
        }
        highlightNumber={ticketsView.highlightNumber}
      />
    </div>
  )
}
