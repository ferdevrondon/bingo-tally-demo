"use client"

import * as React from "react"

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
import { getPlayerNumbers } from "@/lib/round-draft/selectors"
import type { DraftPlayer } from "@/lib/round-draft/types"
import { cn } from "@/lib/utils"

function ownedKey(cartonId: string, number: number) {
  return `${cartonId}:${number}`
}

export function PlayerReleaseNumbersDialog({
  player,
  open,
  onOpenChange,
}: {
  player: DraftPlayer
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { state, resolveCarryOver } = useRoundDraft()
  const ownedNumbers = getPlayerNumbers(state, player.id)
  const [keep, setKeep] = React.useState<Set<string>>(new Set())
  const [showDiscardConfirm, setShowDiscardConfirm] = React.useState(false)
  const playerIndex = state.players.findIndex((p) => p.id === player.id)
  const hasMultipleCartones = new Set(ownedNumbers.map((n) => n.cartonId)).size > 1

  React.useEffect(() => {
    if (open) {
      setKeep(new Set(ownedNumbers.map((n) => ownedKey(n.cartonId, n.number))))
    }
    // Only reset when the dialog opens, not on every state.cartones change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const isDirty = keep.size !== ownedNumbers.length

  function toggleKeep(key: string) {
    setKeep((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function requestClose(next: boolean) {
    if (!next && isDirty) {
      setShowDiscardConfirm(true)
      return
    }
    onOpenChange(next)
  }

  function handleCancel() {
    setKeep(new Set(ownedNumbers.map((n) => ownedKey(n.cartonId, n.number))))
    onOpenChange(false)
  }

  function handleAccept() {
    const releaseNumbers = ownedNumbers
      .filter((n) => !keep.has(ownedKey(n.cartonId, n.number)))
      .map((n) => ({ cartonId: n.cartonId, number: n.number }))
    resolveCarryOver(player.id, releaseNumbers)
    onOpenChange(false)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={requestClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Liberar números de {player.name}</DialogTitle>
            <DialogDescription>
              Selecciona los números que {player.name} mantiene para la nueva ronda; deselecciona
              los que quieres liberar.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 px-6">
            {ownedNumbers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Este jugador no tiene números.</p>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => setKeep(new Set())}>
                  Liberar todos
                </Button>
                <div className="grid grid-cols-5 gap-2">
                  {ownedNumbers.map(({ cartonId, cartonIndex, number }) => {
                    const key = ownedKey(cartonId, number)
                    const kept = keep.has(key)
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => toggleKeep(key)}
                        className={cn(
                          "flex aspect-square w-full flex-col items-center justify-center gap-0.5 rounded-lg border px-0.5 text-sm font-medium transition-colors",
                          kept
                            ? cn(getPlayerColorClass(playerIndex), "border-transparent text-white")
                            : "border-destructive/40 bg-destructive/10 text-destructive line-through opacity-70"
                        )}
                      >
                        <span>{number}</span>
                        {hasMultipleCartones && (
                          <span className="max-w-full truncate text-[10px] leading-none opacity-90">
                            Cartón #{cartonIndex}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>

          <DialogFooter className="flex-row justify-end gap-2">
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
              Tienes cambios sin guardar al liberar números de {player.name}. Si cierras ahora se
              perderán.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir editando</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setKeep(new Set(ownedNumbers.map((n) => ownedKey(n.cartonId, n.number))))
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
