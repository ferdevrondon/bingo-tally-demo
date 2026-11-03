"use client"

import * as React from "react"
import Link from "next/link"
import { LayoutGridIcon } from "lucide-react"

import { ActivityLogCard } from "@/components/activity-log-card"
import { AddPlayerControl } from "@/components/add-player-control"
import { CheckInBalanceAlert } from "@/components/check-in-balance-alert"
import { LiveRoundHistory } from "@/components/live-round-history"
import { OpenNumbersCard } from "@/components/open-numbers-card"
import { PlayerActiveCard } from "@/components/player-active-card"
import { TicketsBoardDialog } from "@/components/tickets-board-dialog"
import { Button } from "@/components/ui/button"
import { useRoundDraft } from "@/lib/round-draft/context"
import { getActivePlayers, getRoundGifts } from "@/lib/round-draft/selectors"
import type { DraftPlayer } from "@/lib/round-draft/types"
import PageHeadingWithActions from "./page-heading"
import { Separator } from "./ui/separator"
import { WinningNumbersCard } from "./winning-numbers-card"

type PlayerFilter = "all" | "no-check-in" | "owes" | "credit" | "gifted"

const PLAYER_FILTERS: { value: PlayerFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "no-check-in", label: "Sin check-in" },
  { value: "owes", label: "Deben" },
  { value: "credit", label: "A favor" },
  { value: "gifted", label: "Regalados" },
]

export function ActiveRoundPage() {
  const { state, readOnly } = useRoundDraft()
  const activePlayers = getActivePlayers(state)
  // "Ver cartones": opened from its button, or from a number of "Números
  // disponibles" (then that number is ringed on the tickets).
  const [ticketsView, setTicketsView] = React.useState<{
    open: boolean
    highlightNumber: number | null
  }>({ open: false, highlightNumber: null })
  const [playerFilter, setPlayerFilter] = React.useState<PlayerFilter>("all")

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

  const giftedIds = new Set(getRoundGifts(state).players.map((p) => p.playerId))
  const matches: Record<PlayerFilter, (p: DraftPlayer) => boolean> = {
    all: () => true,
    // Same rule as the check-in alert: players still deciding aren't asked yet.
    "no-check-in": (p) => !p.checkedIn && !p.pendingCarryOverDecision,
    owes: (p) => p.balance < 0,
    credit: (p) => p.balance > 0,
    gifted: (p) => giftedIds.has(p.id),
  }
  const visiblePlayers = activePlayers.filter(matches[playerFilter])

  return (
    <div className="@container/main flex flex-1 flex-col gap-6 p-4 lg:p-6">
      <PageHeadingWithActions />
      <Separator className="h-1 bg-primary/25" />
      <OpenNumbersCard
        onNumberClick={(number) =>
          setTicketsView({ open: true, highlightNumber: number })
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl font-semibold sm:text-4xl">Jugadores</h2>
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <WinningNumbersCard />
        <CheckInBalanceAlert />
      </div>

      {activePlayers.length > 0 && (
        <>
          <div
            role="group"
            aria-label="Filtrar jugadores"
            className="flex flex-wrap gap-1.5"
          >
            {PLAYER_FILTERS.map(({ value, label }) => (
              <Button
                key={value}
                size="sm"
                variant={playerFilter === value ? "default" : "outline"}
                aria-pressed={playerFilter === value}
                onClick={() => setPlayerFilter(value)}
              >
                {label} {activePlayers.filter(matches[value]).length}
              </Button>
            ))}
          </div>
          {visiblePlayers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ningún jugador coincide con este filtro.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 @xl/main:grid-cols-2 @3xl/main:grid-cols-3">
              {visiblePlayers.map((player) => (
                <PlayerActiveCard
                  key={player.id}
                  player={player}
                  className="w-full"
                />
              ))}
            </div>
          )}
        </>
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
