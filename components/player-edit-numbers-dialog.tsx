"use client"

import * as React from "react"
import { ChevronLeftIcon, ChevronRightIcon, GiftIcon } from "lucide-react"

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
import type { Ticket, DraftPlayer } from "@/lib/round-draft/types"
import { cn } from "@/lib/utils"

function cloneTickets(tickets: Ticket[]): Ticket[] {
  return tickets.map((t) => ({ ...t, numbers: t.numbers.map((n) => ({ ...n })) }))
}

function ticketsDiffer(a: Ticket[], b: Ticket[]): boolean {
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
  const { state, setNumberOwner, toggleGift, logActivity } = useRoundDraft()
  const [draft, setDraft] = React.useState<Ticket[]>(() => cloneTickets(state.tickets))
  const [pageIndex, setPageIndex] = React.useState(0)
  const [showDiscardConfirm, setShowDiscardConfirm] = React.useState(false)
  const [pendingSteal, setPendingSteal] = React.useState<number | null>(null)

  React.useEffect(() => {
    if (open) {
      setDraft(cloneTickets(state.tickets))
      setPageIndex(0)
    }
    // Only reset when the dialog opens, not on every state.tickets change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const isDirty = ticketsDiffer(draft, state.tickets)
  const playerIndexById = new Map(state.players.map((p, i) => [p.id, i]))
  const playerById = new Map(state.players.map((p) => [p.id, p]))
  const currentTicket = draft[pageIndex]
  const pendingStealOwnerId =
    pendingSteal !== null
      ? (currentTicket?.numbers.find((n) => n.number === pendingSteal)?.playerId ?? null)
      : null
  const pendingStealOwnerName =
    pendingStealOwnerId !== null
      ? (playerById.get(pendingStealOwnerId)?.name ?? "otro jugador")
      : null

  function applyCellToggle(number: number) {
    setDraft((prev) =>
      prev.map((ticket) => {
        if (ticket.id !== currentTicket.id) return ticket
        return {
          ...ticket,
          numbers: ticket.numbers.map((entry) =>
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

  function handleCellClick(number: number) {
    const entry = currentTicket.numbers.find((n) => n.number === number)
    if (entry && entry.playerId !== null && entry.playerId !== player.id) {
      setPendingSteal(number)
      return
    }
    applyCellToggle(number)
  }

  function handleToggleGift(number: number) {
    setDraft((prev) =>
      prev.map((ticket) => {
        if (ticket.id !== currentTicket.id) return ticket
        return {
          ...ticket,
          numbers: ticket.numbers.map((entry) =>
            entry.number === number ? { ...entry, isGift: !entry.isGift } : entry
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
    setDraft(cloneTickets(state.tickets))
    onOpenChange(false)
  }

  function handleAccept() {
    const added: number[] = []
    const removed: number[] = []
    const giftToggles: { ticketId: string; number: number }[] = []

    draft.forEach((ticket) => {
      const original = state.tickets.find((t) => t.id === ticket.id)
      if (!original) return
      ticket.numbers.forEach((entry) => {
        const originalEntry = original.numbers.find((n) => n.number === entry.number)
        if (!originalEntry) return

        const ownershipChanged = originalEntry.playerId !== entry.playerId
        if (ownershipChanged) {
          setNumberOwner(ticket.id, entry.number, entry.playerId)
          if (entry.playerId === player.id) added.push(entry.number)
          else if (originalEntry.playerId === player.id) removed.push(entry.number)
          if (entry.playerId === player.id && entry.isGift) {
            giftToggles.push({ ticketId: ticket.id, number: entry.number })
          }
        } else if (entry.playerId === player.id && entry.isGift !== originalEntry.isGift) {
          giftToggles.push({ ticketId: ticket.id, number: entry.number })
        }
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

    giftToggles.forEach(({ ticketId, number }) => toggleGift(ticketId, number))

    onOpenChange(false)
  }

  if (!currentTicket) return null

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
              {currentTicket.numbers.map((entry) => {
                const owner = entry.playerId !== null ? playerById.get(entry.playerId) : undefined
                const isThisPlayer = entry.playerId === player.id

                return (
                  <div key={entry.number} className="relative">
                    <button
                      type="button"
                      onClick={() => handleCellClick(entry.number)}
                      className={cn(
                        "flex aspect-square w-full flex-col items-center justify-center gap-0.5 rounded-lg border px-0.5 text-sm font-medium transition-colors",
                        entry.playerId !== null
                          ? cn(
                              getPlayerColorClass(playerIndexById.get(entry.playerId) ?? -1),
                              "border-transparent text-white",
                              isThisPlayer && "ring-2 ring-primary ring-offset-1",
                              entry.isGift && "border-2 border-dashed border-foreground/40"
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
                    {isThisPlayer && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleToggleGift(entry.number)
                        }}
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
          </div>

          <DialogFooter className="flex-row justify-end gap-2 p-5 bg-gray-300">
            <Button variant="outline" onClick={handleCancel}>
              Cancelar
            </Button>
            <Button onClick={handleAccept}>Aceptar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={pendingSteal !== null}
        onOpenChange={(next) => {
          if (!next) setPendingSteal(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Quitar el número {pendingSteal} a {pendingStealOwnerName}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Este número ya está asignado a {pendingStealOwnerName}. Si continúas, pasará a ser de{" "}
              {player.name}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingSteal !== null) applyCellToggle(pendingSteal)
                setPendingSteal(null)
              }}
            >
              Quitar y asignar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
                setDraft(cloneTickets(state.tickets))
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
