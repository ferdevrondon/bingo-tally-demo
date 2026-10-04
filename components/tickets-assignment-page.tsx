"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  ArrowRightIcon,
  LayoutGridIcon,
  ListIcon,
  PlusIcon,
} from "lucide-react"

import { TicketCard } from "@/components/ticket-card"
import { TicketListColumn } from "@/components/ticket-list-column"
import { PlayerForm } from "@/components/player-form"
import { PlayerNumbersSummary } from "@/components/player-numbers-summary"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
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
import { cn } from "@/lib/utils"
import { writeSucceeded } from "@/lib/write-feedback"

type TicketsView = "tickets" | "list"

// Cartones (grid) or Lista (columns): a per-browser display preference.
const VIEW_STORAGE_KEY = "new-game-view"

const viewListeners = new Set<() => void>()
// Fallback when storage is blocked: the choice lasts until the page reloads.
let memoryView: TicketsView = "tickets"

function readView(): TicketsView {
  try {
    const saved = localStorage.getItem(VIEW_STORAGE_KEY)
    return saved === "list" || saved === "tickets" ? saved : memoryView
  } catch {
    return memoryView
  }
}

function subscribeView(listener: () => void) {
  viewListeners.add(listener)
  return () => {
    viewListeners.delete(listener)
  }
}

function useTicketsView() {
  // The server (and the first render) shows Cartones; the browser then reads
  // the saved choice.
  const view = React.useSyncExternalStore(
    subscribeView,
    readView,
    () => "tickets" as const
  )
  function change(next: TicketsView) {
    memoryView = next
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, next)
    } catch {}
    viewListeners.forEach((listener) => listener())
  }
  return [view, change] as const
}

export function TicketsAssignmentPage() {
  const router = useRouter()
  const {
    state,
    readOnly,
    roundTemplates,
    addTicket,
    setActivePlayer,
    assignNumber,
    toggleGift,
    startRound,
  } = useRoundDraft()
  const checkInToggle = useCheckInToggle()
  const [isAddPlayerOpen, setIsAddPlayerOpen] = React.useState(false)
  const [isRoundPending, startRoundTransition] = React.useTransition()
  const [isTicketPending, startTicketTransition] = React.useTransition()
  const [view, setView] = useTicketsView()

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

  function handleAddTicket() {
    startTicketTransition(async () => {
      await addTicket()
    })
  }

  const ticketProps = (ticketId: number) => ({
    players: state.players,
    activePlayerId: state.activePlayerId,
    readOnly,
    onAssign: (number: number) => assignNumber(ticketId, number),
    onToggleGift: (number: number) => toggleGift(ticketId, number),
  })

  return (
    <div className="@container/main flex min-w-0 flex-1 flex-col gap-6 p-4 lg:p-6">
      <div className="flex flex-wrap items-center gap-3">
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

        <Select
          value={
            state.activePlayerId != null ? String(state.activePlayerId) : ""
          }
          onValueChange={(value) =>
            setActivePlayer(value ? Number(value) : null)
          }
          disabled={!state.round}
          items={state.players.map((p) => ({
            label: p.name,
            value: String(p.id),
          }))}
        >
          <SelectTrigger className="w-56">
            <SelectValue
              placeholder={
                state.round
                  ? "Selecciona un jugador activo"
                  : "Primero elige la ronda"
              }
            />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {state.players.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        {!readOnly && (
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
        )}

        <ToggleGroup
          variant="outline"
          spacing={0}
          className="ml-auto"
          value={[view]}
          onValueChange={(value: string[]) => {
            const next = value[0]
            if (next === "tickets" || next === "list") setView(next)
          }}
        >
          <ToggleGroupItem value="tickets" aria-label="Ver por cartones">
            <LayoutGridIcon />
            Cartones
          </ToggleGroupItem>
          <ToggleGroupItem value="list" aria-label="Ver por lista">
            <ListIcon />
            Lista
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

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
        <Card>
          <CardHeader>
            <CardTitle>Jugadores</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {activePlayers.map((player) => (
              <div
                key={player.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-2"
              >
                <div className="order-1 flex shrink-0 items-center gap-2">
                  <span className="text-sm font-medium">{player.name}</span>
                  {player.balance !== 0 && !player.pendingCarryOverDecision && (
                    <span
                      className={
                        player.balance < 0
                          ? "text-xs font-medium text-destructive"
                          : "text-xs font-medium text-green-600"
                      }
                    >
                      {balanceLabel(player.balance)}
                    </span>
                  )}
                </div>
                <PlayerNumbersSummary
                  numbers={getPlayerNumberSummary(state, player.id)}
                  colorClass={getPlayerColorClass(
                    state.players.findIndex((p) => p.id === player.id)
                  )}
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
      )}

      {view === "tickets" ? (
        <div className="flex flex-wrap gap-4">
          {state.tickets.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              {...ticketProps(ticket.id)}
            />
          ))}
          {!readOnly && (
            <AddTicketButton
              disabled={isTicketPending}
              onClick={handleAddTicket}
              className="w-full max-w-sm"
            />
          )}
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {state.tickets.map((ticket) => (
            <TicketListColumn
              key={ticket.id}
              ticket={ticket}
              {...ticketProps(ticket.id)}
            />
          ))}
          {!readOnly && (
            <AddTicketButton
              disabled={isTicketPending}
              onClick={handleAddTicket}
              className="mt-7 w-40 shrink-0"
            />
          )}
        </div>
      )}

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

function AddTicketButton({
  disabled,
  onClick,
  className,
}: {
  disabled: boolean
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-50",
        className
      )}
    >
      <PlusIcon className="size-5" />
      Agregar cartón
    </button>
  )
}
