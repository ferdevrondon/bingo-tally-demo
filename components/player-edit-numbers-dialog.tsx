"use client"

import * as React from "react"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useRoundDraft } from "@/lib/round-draft/context"
import { getPlayerColorClass } from "@/lib/round-draft/colors"
import type { Carton, DraftPlayer } from "@/lib/round-draft/types"
import { cn } from "@/lib/utils"

function cloneCartones(cartones: Carton[]): Carton[] {
  return cartones.map((c) => ({ ...c, numbers: c.numbers.map((n) => ({ ...n })) }))
}

function cartonesDiffer(a: Carton[], b: Carton[]): boolean {
  return JSON.stringify(a) !== JSON.stringify(b)
}

export function PlayerEditNumbersDialog({
  player,
  open,
  onOpenChange,
}: {
  player: DraftPlayer
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { state, setNumberOwner, logActivity } = useRoundDraft()
  const [draft, setDraft] = React.useState<Carton[]>(() => cloneCartones(state.cartones))
  const [pageIndex, setPageIndex] = React.useState(0)
  const [showDiscardConfirm, setShowDiscardConfirm] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setDraft(cloneCartones(state.cartones))
      setPageIndex(0)
    }
    // Only reset when the dialog opens, not on every state.cartones change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const isDirty = cartonesDiffer(draft, state.cartones)
  const playerIndexById = new Map(state.players.map((p, i) => [p.id, i]))
  const playerById = new Map(state.players.map((p) => [p.id, p]))
  const currentCarton = draft[pageIndex]

  function handleCellClick(number: number) {
    setDraft((prev) =>
      prev.map((carton) => {
        if (carton.id !== currentCarton.id) return carton
        return {
          ...carton,
          numbers: carton.numbers.map((entry) =>
            entry.number === number
              ? {
                  ...entry,
                  playerId: entry.playerId === player.id ? null : player.id,
                  isGift: false,
                }
              : entry
          ),
        }
      })
    )
  }

  function requestClose(next: boolean) {
    if (!next && isDirty) {
      setShowDiscardConfirm(true)
      return
    }
    onOpenChange(next)
  }

  function handleCancel() {
    setDraft(cloneCartones(state.cartones))
    onOpenChange(false)
  }

  function handleAccept() {
    const added: number[] = []
    const removed: number[] = []

    draft.forEach((carton) => {
      const original = state.cartones.find((c) => c.id === carton.id)
      if (!original) return
      carton.numbers.forEach((entry) => {
        const originalEntry = original.numbers.find((n) => n.number === entry.number)
        if (!originalEntry || originalEntry.playerId === entry.playerId) return
        setNumberOwner(carton.id, entry.number, entry.playerId)
        if (entry.playerId === player.id) added.push(entry.number)
        else if (originalEntry.playerId === player.id) removed.push(entry.number)
      })
    })

    const swapCount = Math.min(added.length, removed.length)
    for (let i = 0; i < swapCount; i++) {
      logActivity({
        type: "number_changed",
        playerId: player.id,
        playerName: player.name,
        description: `${player.name} cambió número ${removed[i]} por ${added[i]}`,
      })
    }
    const leftoverAdded = added.slice(swapCount)
    if (leftoverAdded.length > 0) {
      logActivity({
        type: "number_purchased",
        playerId: player.id,
        playerName: player.name,
        description: `${player.name} compró número${leftoverAdded.length > 1 ? "s" : ""} ${leftoverAdded.join(", ")}`,
      })
    }

    onOpenChange(false)
  }

  if (!currentCarton) return null

  return (
    <>
      <Dialog open={open} onOpenChange={requestClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar jugada de {player.name}</DialogTitle>
            <DialogDescription>
              Selecciona o quita números para este jugador en cada cartón.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 p-6">
            {draft.length > 1 && (
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={pageIndex === 0}
                  onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
                >
                  <ChevronLeftIcon />
                </Button>
                <span className="text-sm text-muted-foreground">
                  Cartón {pageIndex + 1}/{draft.length}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={pageIndex === draft.length - 1}
                  onClick={() => setPageIndex((i) => Math.min(draft.length - 1, i + 1))}
                >
                  <ChevronRightIcon />
                </Button>
              </div>
            )}

            <div className="grid grid-cols-5 gap-2">
              {currentCarton.numbers.map((entry) => {
                const owner = entry.playerId !== null ? playerById.get(entry.playerId) : undefined
                const isThisPlayer = entry.playerId === player.id

                return (
                  <button
                    key={entry.number}
                    type="button"
                    onClick={() => handleCellClick(entry.number)}
                    className={cn(
                      "flex aspect-square w-full flex-col items-center justify-center gap-0.5 rounded-lg border px-0.5 text-sm font-medium transition-colors",
                      entry.playerId !== null
                        ? cn(
                            getPlayerColorClass(playerIndexById.get(entry.playerId) ?? -1),
                            "border-transparent text-white",
                            isThisPlayer && "ring-2 ring-primary ring-offset-1"
                          )
                        : "cursor-pointer border-amber-500/40 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-400"
                    )}
                  >
                    <span>{entry.number}</span>
                    {owner && (
                      <span className="max-w-full truncate text-[10px] leading-none opacity-90">
                        {owner.name.split(" ")[0]}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          <DialogFooter className="flex-row justify-end gap-2 p-5 bg-gray-300">
            <Button variant="outline" onClick={handleCancel}>
              Cancelar
            </Button>
            <Button onClick={handleAccept}>Aceptar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDiscardConfirm} onOpenChange={setShowDiscardConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Descartar cambios?</AlertDialogTitle>
            <AlertDialogDescription>
              Tienes cambios sin guardar en la jugada de {player.name}. Si cierras ahora se
              perderán.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir editando</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setDraft(cloneCartones(state.cartones))
                setShowDiscardConfirm(false)
                onOpenChange(false)
              }}
            >
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
