"use client"

import { GiftIcon } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getPlayerColorClass } from "@/lib/round-draft/colors"
import type { Carton, DraftPlayer } from "@/lib/round-draft/types"
import { cn } from "@/lib/utils"

export interface CartonCardProps {
  carton: Carton
  players: DraftPlayer[]
  activePlayerId: number | null
  onAssign: (number: number) => void
  onToggleGift: (number: number) => void
}

export function CartonCard({
  carton,
  players,
  activePlayerId,
  onAssign,
  onToggleGift,
}: CartonCardProps) {
  const assignedCount = carton.numbers.filter((n) => n.playerId !== null).length
  const playerIndexById = new Map(players.map((p, i) => [p.id, i]))
  const playerById = new Map(players.map((p) => [p.id, p]))

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Cartón #{carton.index}</CardTitle>
        <span className="text-xs text-muted-foreground">{assignedCount}/15</span>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-5 gap-2">
          {carton.numbers.map((entry) => {
            const owner = entry.playerId !== null ? playerById.get(entry.playerId) : undefined
            const isOwnedByActive =
              entry.playerId !== null && entry.playerId === activePlayerId
            const canAssign = entry.playerId === null && activePlayerId !== null

            return (
              <div key={entry.number} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    if (entry.playerId === null) {
                      if (canAssign) onAssign(entry.number)
                      return
                    }
                    if (isOwnedByActive) onAssign(entry.number)
                  }}
                  disabled={entry.playerId === null && !canAssign}
                  title={
                    entry.playerId === null
                      ? activePlayerId === null
                        ? "Selecciona un jugador activo primero"
                        : undefined
                      : owner?.name
                  }
                  aria-pressed={entry.playerId !== null}
                  className={cn(
                    "aspect-square w-full rounded-lg border text-sm font-medium transition-colors",
                    "flex flex-col items-center justify-center gap-0.5 px-0.5",
                    entry.playerId !== null
                      ? cn(
                          getPlayerColorClass(playerIndexById.get(entry.playerId) ?? -1),
                          "border-transparent text-white",
                          entry.isGift && "border-2 border-dashed border-foreground/40",
                          isOwnedByActive && "cursor-pointer",
                          !isOwnedByActive && "cursor-default"
                        )
                      : cn(
                          "bg-muted/40 text-foreground border-border",
                          canAssign
                            ? "cursor-pointer hover:bg-muted"
                            : "cursor-not-allowed opacity-60"
                        )
                  )}
                >
                  <span>{entry.number}</span>
                  {owner && (
                    <span className="max-w-full truncate text-[10px] leading-none opacity-90">
                      {owner.name.split(" ")[0]}
                    </span>
                  )}
                </button>
                {entry.playerId !== null && (
                  <button
                    type="button"
                    onClick={() => onToggleGift(entry.number)}
                    title={entry.isGift ? "Quitar regalo" : "Marcar como regalo"}
                    className={cn(
                      "absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full border bg-background text-foreground shadow-sm transition-colors",
                      entry.isGift
                        ? "border-amber-500/60 text-amber-500"
                        : "border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <GiftIcon className="size-3" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
