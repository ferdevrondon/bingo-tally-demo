"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ArrowRightIcon, PlusIcon } from "lucide-react"

import { CartonCard } from "@/components/carton-card"
import { PlayerForm, type NewPlayer } from "@/components/player-form"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useRoundDraft } from "@/lib/round-draft/context"

function parseMoney(value: string): number {
  const parsed = Number.parseFloat(value.replace(/[^0-9.-]/g, ""))
  return Number.isFinite(parsed) ? parsed : 0
}

export function CartonesAssignmentPage() {
  const router = useRouter()
  const { state, addCarton, addPlayer, setActivePlayer, assignNumber, toggleGift } =
    useRoundDraft()
  const [isAddPlayerOpen, setIsAddPlayerOpen] = React.useState(false)

  const activePlayersCount = new Set(
    state.cartones
      .flatMap((c) => c.numbers)
      .filter((n) => n.playerId !== null)
      .map((n) => n.playerId)
  ).size

  function handleAddPlayer(player: NewPlayer) {
    addPlayer({
      name: player.name,
      positiveBalance: parseMoney(player.positiveBalance),
      negativeBalance: parseMoney(player.negativeBalance),
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
            <span className="text-2xl font-bold">{state.cartones.length}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Jugadores activos
            </span>
            <span className="text-2xl font-bold">{activePlayersCount}</span>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-4">
        {state.cartones.map((carton) => (
          <CartonCard
            key={carton.id}
            carton={carton}
            players={state.players}
            activePlayerId={state.activePlayerId}
            onAssign={(number) => assignNumber(carton.id, number)}
            onToggleGift={(number) => toggleGift(carton.id, number)}
          />
        ))}

        <button
          type="button"
          onClick={addCarton}
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
          onClick={() => router.push("/cartones/resumen")}
        >
          Empezar ronda
          <ArrowRightIcon className="size-4" />
        </Button>
      </div>
    </div>
  )
}
