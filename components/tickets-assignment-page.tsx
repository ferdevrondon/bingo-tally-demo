"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ArrowRightIcon, PlusIcon } from "lucide-react"

import { TicketCard } from "@/components/ticket-card"
import { PlayerForm, type NewPlayer } from "@/components/player-form"
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
import { useRoundDraft } from "@/lib/round-draft/context"
import { getActivePlayers } from "@/lib/round-draft/selectors"
import { getBaseRounds } from "@/lib/rounds"

function parseMoney(value: string): number {
  const parsed = Number.parseFloat(value.replace(/[^0-9.-]/g, ""))
  return Number.isFinite(parsed) ? parsed : 0
}

export function TicketsAssignmentPage() {
  const router = useRouter()
  const {
    state,
    addTicket,
    addPlayer,
    setActivePlayer,
    assignNumber,
    toggleGift,
    toggleCheckIn,
    setRound,
  } = useRoundDraft()
  const [isAddPlayerOpen, setIsAddPlayerOpen] = React.useState(false)
  const rounds = React.useMemo(() => getBaseRounds(), [])

  const activePlayers = getActivePlayers(state)

  function handleAddPlayer(player: NewPlayer) {
    addPlayer({
      name: player.name,
      positiveBalance: parseMoney(player.positiveBalance),
      negativeBalance: parseMoney(player.negativeBalance),
      checkedIn: false,
      pendingCarryOverDecision: false,
    })
    setIsAddPlayerOpen(false)
  }

  return (
    <div className="@container/main flex flex-1 flex-col gap-6 p-4 lg:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={state.activePlayerId != null ? String(state.activePlayerId) : ""}
          onValueChange={(value) => setActivePlayer(value ? Number(value) : null)}
          items={state.players.map((p) => ({ label: p.name, value: String(p.id) }))}
        >
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Selecciona un jugador activo" />
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

        <Select
          value={state.round ? String(state.round.id) : ""}
          onValueChange={(value) => {
            const round = rounds.find((r) => r.id === Number(value))
            if (round) setRound(round)
          }}
          items={rounds.map((r) => ({ label: r.name, value: String(r.id) }))}
        >
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Selecciona una ronda" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {rounds.map((r) => (
                <SelectItem key={r.id} value={String(r.id)}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

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
              <div key={player.id} className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{player.name}</span>
                  {player.negativeBalance > 0 && (
                    <span className="text-xs font-medium text-destructive">
                      Debe ${player.negativeBalance}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`checkin-${player.id}`}
                    checked={player.checkedIn}
                    onCheckedChange={() => toggleCheckIn(player.id)}
                  />
                  <Label htmlFor={`checkin-${player.id}`}>Check-in</Label>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-4">
        {state.tickets.map((ticket) => (
          <TicketCard
            key={ticket.id}
            ticket={ticket}
            players={state.players}
            activePlayerId={state.activePlayerId}
            onAssign={(number) => assignNumber(ticket.id, number)}
            onToggleGift={(number) => toggleGift(ticket.id, number)}
          />
        ))}

        <button
          type="button"
          onClick={addTicket}
          className="flex w-full max-w-sm flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        >
          <PlusIcon className="size-5" />
          Agregar cartón
        </button>
      </div>

      <div className="flex justify-end border-t pt-4">
        <Button
          size="lg"
          className="gap-2"
          onClick={() => router.push("/active-round")}
        >
          Empezar ronda
          <ArrowRightIcon className="size-4" />
        </Button>
      </div>
    </div>
  )
}
