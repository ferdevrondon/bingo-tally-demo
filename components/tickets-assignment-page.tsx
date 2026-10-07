"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ArrowRightIcon, PlusIcon } from "lucide-react"

import { PlayerForm } from "@/components/player-form"
import { PlayerNumbersSummary } from "@/components/player-numbers-summary"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TicketsGrid, TicketsToolbar } from "@/components/tickets-board"
import { useCheckInToggle } from "@/components/check-in-dialog"
import { useRoundDraft } from "@/lib/round-draft/context"
import { balanceLabel } from "@/lib/round-draft/balance"
import { getCurrentRoundNumber } from "@/lib/round-draft/prize-rules"
import { createPlayer } from "@/lib/data/player-actions"
import type { PlayerInput } from "@/lib/players"
import { getPlayerColorClass } from "@/lib/round-draft/colors"
import {
  getActivePlayers,
  getPlayerNumberSummary,
} from "@/lib/round-draft/selectors"
import { roundOptionLabel } from "@/lib/rounds"
import { writeSucceeded } from "@/lib/write-feedback"

export function TicketsAssignmentPage() {
  const router = useRouter()
  const { state, readOnly, roundTemplates, setActivePlayer, startRound } =
    useRoundDraft()
  const checkInToggle = useCheckInToggle()
  const [isAddPlayerOpen, setIsAddPlayerOpen] = React.useState(false)
  const [isRoundPending, startRoundTransition] = React.useTransition()

  const activePlayers = getActivePlayers(state)
  // start_round only swaps the picked round while nothing has happened in it
  // (sales, kept plays, winning numbers).
  const roundLocked =
    state.round !== null &&
    (state.winningNumbers.some((n) => n !== null) ||
      state.tickets.some((t) => t.numbers.some((n) => n.playerId !== null)) ||
      state.activity.some(
        (a) => a.roundId === state.round?.roundId && a.type !== "round_started"
      ))

  // The player is saved in the catalog first; the refreshed game session
  // brings them in with their database id.
  async function handleAddPlayer(input: PlayerInput) {
    const result = await createPlayer(input)
    if (!writeSucceeded(result)) return
    // Numbers need an open round: the player becomes active once one is picked.
    if (state.round) setActivePlayer(result.data.id)
    setIsAddPlayerOpen(false)
  }

  // Any active round template can start the game session (business rule 9:
  // numbers need an open round). It can be changed until something happens
  // in the round.
  function handleRoundChange(value: string | null) {
    const templateId = Number(value)
    if (!templateId || templateId === state.round?.templateId) return
    startRoundTransition(async () => {
      await startRound(templateId)
    })
  }

  return (
    <div className="@container/main flex min-w-0 flex-1 flex-col gap-6 p-4 lg:p-6">
      <TicketsToolbar
        leading={
          <Select
            value={
              state.round?.templateId != null
                ? String(state.round.templateId)
                : ""
            }
            onValueChange={handleRoundChange}
            disabled={readOnly || isRoundPending || roundLocked}
            items={roundTemplates.map((r) => ({
              label: roundOptionLabel(r),
              value: String(r.id),
            }))}
          >
            <SelectTrigger className="w-56">
              <SelectValue
                placeholder={`Ronda ${getCurrentRoundNumber(state.roundsPlayed)} — elige la ronda`}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {roundTemplates.map((r) => (
                  <SelectItem key={r.id} value={String(r.id)}>
                    {roundOptionLabel(r)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        }
        trailing={
          !readOnly && (
            <Dialog open={isAddPlayerOpen} onOpenChange={setIsAddPlayerOpen}>
              <DialogTrigger render={<Button variant="outline" />}>
                <PlusIcon />
                Agregar jugador
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nuevo jugador</DialogTitle>
                  <DialogDescription>
                    Completa los datos para agregar un jugador a esta ronda.
                  </DialogDescription>
                </DialogHeader>
                <div className="overflow-y-auto p-6">
                  <PlayerForm
                    variant="plain"
                    onSubmit={handleAddPlayer}
                    onCancel={() => setIsAddPlayerOpen(false)}
                  />
                </div>
              </DialogContent>
            </Dialog>
          )
        }
      />

      <div className="grid grid-cols-2 gap-4 @sm/main:grid-cols-4">
        <Card>
          <CardContent className="flex flex-col gap-1">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Cartones abiertos
            </span>
            <span className="text-2xl font-bold">{state.tickets.length}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Jugadores activos
            </span>
            <span className="text-2xl font-bold">{activePlayers.length}</span>
          </CardContent>
        </Card>
      </div>

      {activePlayers.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-base font-medium">Jugadores</h2>
          <Card>
            <CardContent className="flex flex-col gap-3">
              {activePlayers.map((player) => (
                <div
                  key={player.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2"
                >
                  <div className="order-1 flex shrink-0 items-center gap-2">
                    <span className="text-sm font-medium">{player.name}</span>
                  </div>
                  <PlayerNumbersSummary
                    numbers={getPlayerNumberSummary(state, player.id)}
                    colorClass={getPlayerColorClass(
                      state.players.findIndex((p) => p.id === player.id)
                    )}
                    trailing={
                      player.balance !== 0 &&
                      !player.pendingCarryOverDecision && (
                        <span
                          className={
                            player.balance < 0
                              ? "text-xs font-medium text-destructive"
                              : "text-xs font-medium text-green-600"
                          }
                        >
                          {balanceLabel(player.balance)}
                        </span>
                      )
                    }
                  />
                  {player.pendingCarryOverDecision ? (
                    <span className="order-2 ml-auto text-xs text-muted-foreground @2xl/main:order-3">
                      Decide su jugada
                    </span>
                  ) : (
                    <div className="order-2 ml-auto flex items-center gap-2 @2xl/main:order-3">
                      <Checkbox
                        id={`checkin-${player.id}`}
                        checked={player.checkedIn}
                        disabled={readOnly}
                        onCheckedChange={() => checkInToggle.toggle(player)}
                      />
                      <Label htmlFor={`checkin-${player.id}`}>Check-in</Label>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      )}

      <TicketsGrid />

      {checkInToggle.dialog}

      <div className="flex justify-end border-t pt-4">
        <Button
          size="lg"
          className="gap-2"
          disabled={!state.round}
          title={state.round ? undefined : "Primero elige la ronda"}
          onClick={() => router.push("/active-round")}
        >
          {readOnly ? "Ver ronda activa" : "Empezar ronda"}
          <ArrowRightIcon className="size-4" />
        </Button>
      </div>
    </div>
  )
}
