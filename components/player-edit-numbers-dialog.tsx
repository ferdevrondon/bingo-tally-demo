"use client"

import * as React from "react"
import { GiftIcon } from "lucide-react"
import { toast } from "sonner"

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
import { TicketsViewToggle, useTicketsView } from "@/components/tickets-board"
import { claimFirstFree } from "@/lib/round-draft/assign-ticket"
import { useRoundDraft, type NumberEdit } from "@/lib/round-draft/context"
import { getPlayerColorClass } from "@/lib/round-draft/colors"
import { orderTicketsByFreeNumbers } from "@/lib/round-draft/selectors"
import type { Ticket, DraftPlayer } from "@/lib/round-draft/types"
import { cn } from "@/lib/utils"

function cloneTickets(tickets: Ticket[]): Ticket[] {
  return tickets.map((t) => ({ ...t, numbers: t.numbers.map((n) => ({ ...n })) }))
}

function ticketsDiffer(a: Ticket[], b: Ticket[]): boolean {
  return JSON.stringify(a) !== JSON.stringify(b)
}

function EditableTicket({
  ticket,
  playerId,
  playerIndexById,
  playerById,
  onCellClick,
  onToggleGift,
}: {
  ticket: Ticket
  playerId: number
  playerIndexById: Map<number, number>
  playerById: Map<number, DraftPlayer>
  onCellClick: (number: number) => void
  onToggleGift: (number: number) => void
}) {
  const free = ticket.numbers.filter((n) => n.playerId === null).length

  return (
    <div className="flex flex-col gap-2 rounded-xl border p-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold">Cartón {ticket.index}</span>
        <span className="text-muted-foreground">
          {free === 0 ? "Completo" : `${free} libre${free === 1 ? "" : "s"}`}
        </span>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {ticket.numbers.map((entry) => {
          const owner = entry.playerId !== null ? playerById.get(entry.playerId) : undefined
          const isThisPlayer = entry.playerId === playerId

          return (
            <div key={entry.number} className="relative">
              <button
                type="button"
                onClick={() => onCellClick(entry.number)}
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
              {(isThisPlayer || entry.playerId === null) && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleGift(entry.number)
                  }}
                  title={
                    entry.playerId === null
                      ? "Tomar como regalo"
                      : entry.isGift
                        ? "Quitar regalo"
                        : "Marcar como regalo"
                  }
                  className={cn(
                    "absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full border bg-background text-foreground shadow-sm transition-colors",
                    entry.isGift
                      ? "border-red-500/60 bg-amber-400 text-red-700"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  <GiftIcon className="size-3.5" />
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// The Lista view of one ticket while editing: a row per number with its
// player's name. Same clicks and gift button as EditableTicket.
function EditableTicketColumn({
  ticket,
  playerId,
  playerIndexById,
  playerById,
  onCellClick,
  onToggleGift,
}: {
  ticket: Ticket
  playerId: number
  playerIndexById: Map<number, number>
  playerById: Map<number, DraftPlayer>
  onCellClick: (number: number) => void
  onToggleGift: (number: number) => void
}) {
  const free = ticket.numbers.filter((n) => n.playerId === null).length

  return (
    <div className="flex w-44 shrink-0 flex-col gap-2">
      <span className="w-fit rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
        Cartón {ticket.index}
      </span>
      <div className="flex flex-col gap-1 rounded-2xl border border-primary/30 bg-card p-2">
        {ticket.numbers.map((entry) => {
          const owner = entry.playerId !== null ? playerById.get(entry.playerId) : undefined
          const isThisPlayer = entry.playerId === playerId

          return (
            <div
              key={entry.number}
              className={cn(
                "flex h-7 items-center gap-1 rounded-md border pr-1 text-xs font-medium transition-colors",
                owner
                  ? cn(
                      getPlayerColorClass(playerIndexById.get(owner.id) ?? -1),
                      "border-transparent text-white",
                      isThisPlayer && "ring-2 ring-primary ring-offset-1",
                      entry.isGift && "border-2 border-dashed border-foreground/40"
                    )
                  : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
              )}
            >
              <button
                type="button"
                onClick={() => onCellClick(entry.number)}
                title={owner?.name}
                className={cn(
                  "flex h-full min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md px-2",
                  !owner && "hover:bg-amber-500/20"
                )}
              >
                {owner ? (
                  <>
                    <span className="min-w-0 flex-1 truncate text-left font-semibold uppercase">
                      {owner.name}
                    </span>
                    <span className="tabular-nums">{entry.number}</span>
                  </>
                ) : (
                  <span className="tabular-nums">{entry.number}</span>
                )}
              </button>
              {(isThisPlayer || entry.playerId === null) && (
                <button
                  type="button"
                  onClick={() => onToggleGift(entry.number)}
                  title={
                    entry.playerId === null
                      ? "Tomar como regalo"
                      : entry.isGift
                        ? "Quitar regalo"
                        : "Marcar como regalo"
                  }
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full border bg-background shadow-sm transition-colors",
                    entry.isGift
                      ? "border-red-500/60 bg-amber-400 text-red-700"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  <GiftIcon className="size-3" />
                </button>
              )}
            </div>
          )
        })}
        <div className="mt-1 flex items-center justify-between px-1 text-xs text-muted-foreground">
          <span>{free === 0 ? "Completo" : `${free} libre${free === 1 ? "" : "s"}`}</span>
          <span className="tabular-nums">{15 - free}/15</span>
        </div>
      </div>
    </div>
  )
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
  const { state, editPlayerNumbers } = useRoundDraft()
  const [view] = useTicketsView()
  const [draft, setDraft] = React.useState<Ticket[]>(() => cloneTickets(state.tickets))
  // Ticket order is fixed when the dialog opens so cards don't jump while
  // editing: tickets with free numbers first, complete ones last.
  const [orderedIds, setOrderedIds] = React.useState<number[]>(() =>
    orderTicketsByFreeNumbers(state.tickets).map((t) => t.id)
  )
  const [showDiscardConfirm, setShowDiscardConfirm] = React.useState(false)
  const [pendingSteal, setPendingSteal] = React.useState<{
    ticketId: number
    number: number
  } | null>(null)

  // Only reset when the dialog opens, not on every state.tickets change.
  const [wasOpen, setWasOpen] = React.useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setDraft(cloneTickets(state.tickets))
      setOrderedIds(orderTicketsByFreeNumbers(state.tickets).map((t) => t.id))
    }
  }

  const isDirty = ticketsDiffer(draft, state.tickets)
  const playerIndexById = new Map(state.players.map((p, i) => [p.id, i]))
  const playerById = new Map(state.players.map((p) => [p.id, p]))
  const draftById = new Map(draft.map((t) => [t.id, t]))
  const orderedTickets = orderedIds
    .map((id) => draftById.get(id))
    .filter((t): t is Ticket => t !== undefined)
  const withFree = orderedTickets.filter((t) => t.numbers.some((n) => n.playerId === null))
  const complete = orderedTickets.filter((t) => t.numbers.every((n) => n.playerId !== null))
  const pendingStealOwnerId =
    pendingSteal !== null
      ? (draftById
          .get(pendingSteal.ticketId)
          ?.numbers.find((n) => n.number === pendingSteal.number)?.playerId ?? null)
      : null
  const pendingStealOwnerName =
    pendingStealOwnerId !== null
      ? (playerById.get(pendingStealOwnerId)?.name ?? "otro jugador")
      : null

  function applyCellToggle(ticketId: number, number: number) {
    setDraft((prev) =>
      prev.map((ticket) => {
        if (ticket.id !== ticketId) return ticket
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

  // A free number goes where the database will put it: the lowest ticket
  // with that number free (record_purchase / edit_player_numbers), whichever
  // ticket was tapped, as on Cartones y jugadores.
  function claimFree(tappedTicketId: number, number: number, isGift: boolean) {
    const result = claimFirstFree(draft, number, player.id, isGift)
    if (!result) return
    setDraft(result.tickets)
    if (result.ticketId !== tappedTicketId) {
      const index = draftById.get(result.ticketId)?.index
      toast.info(`Asignado al cartón ${index}`)
    }
  }

  function handleCellClick(ticketId: number, number: number) {
    const entry = draftById.get(ticketId)?.numbers.find((n) => n.number === number)
    if (entry && entry.playerId !== null && entry.playerId !== player.id) {
      setPendingSteal({ ticketId, number })
      return
    }
    if (entry?.playerId === null) {
      claimFree(ticketId, number, false)
      return
    }
    applyCellToggle(ticketId, number)
  }

  // On a free number the gift takes it as a gift (on the first free ticket,
  // like any purchase); on the player's own number it adds or removes the gift.
  function handleToggleGift(ticketId: number, number: number) {
    const entry = draftById.get(ticketId)?.numbers.find((n) => n.number === number)
    if (entry?.playerId === null) {
      claimFree(ticketId, number, true)
      return
    }
    setDraft((prev) =>
      prev.map((ticket) => {
        if (ticket.id !== ticketId) return ticket
        return {
          ...ticket,
          numbers: ticket.numbers.map((entry) => {
            if (entry.number !== number || entry.playerId !== player.id) return entry
            return { ...entry, isGift: !entry.isGift }
          }),
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

  // Every position this player gained, lost or re-gifted, saved in one
  // transaction (edit_player_numbers). Numbers taken from another player carry
  // the owner this screen showed, so a stale screen can't take a number that
  // changed in the meantime.
  function handleAccept() {
    const changes: NumberEdit[] = []
    draft.forEach((ticket) => {
      const original = state.tickets.find((t) => t.id === ticket.id)
      if (!original) return
      ticket.numbers.forEach((entry) => {
        const originalEntry = original.numbers.find((n) => n.number === entry.number)
        if (!originalEntry) return
        const wasMine = originalEntry.playerId === player.id
        const isMine = entry.playerId === player.id
        if (isMine && (!wasMine || entry.isGift !== originalEntry.isGift)) {
          changes.push({
            ticketId: ticket.id,
            number: entry.number,
            owned: true,
            isGift: entry.isGift,
            expectedOwnerId: wasMine ? null : originalEntry.playerId,
          })
        } else if (wasMine && !isMine) {
          changes.push({
            ticketId: ticket.id,
            number: entry.number,
            owned: false,
            isGift: false,
            expectedOwnerId: null,
          })
        }
      })
    })

    editPlayerNumbers(player.id, changes)
    onOpenChange(false)
  }

  if (orderedTickets.length === 0) return null

  return (
    <>
      <Dialog open={open} onOpenChange={requestClose}>
        <DialogContent className="max-h-[90vh] w-[95%] sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Editar jugada de {player.name}</DialogTitle>
            <DialogDescription>
              Selecciona o quita números para este jugador. Los números libres se asignan al
              primer cartón que los tenga libres.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-6 overflow-y-auto p-6">
            <TicketsViewToggle className="self-end" />
            {[
              { title: "Con números libres", tickets: withFree },
              { title: "Completos", tickets: complete },
            ]
              .filter((group) => group.tickets.length > 0)
              .map((group) => (
                <section key={group.title} className="flex flex-col gap-3">
                  <h3 className="text-base font-semibold">
                    {group.title} ({group.tickets.length})
                  </h3>
                  <div
                    className={
                      view === "tickets"
                        ? "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
                        : "flex gap-3 overflow-x-auto pb-2"
                    }
                  >
                    {group.tickets.map((ticket) => {
                      const TicketView = view === "tickets" ? EditableTicket : EditableTicketColumn
                      return (
                        <TicketView
                          key={ticket.id}
                          ticket={ticket}
                          playerId={player.id}
                          playerIndexById={playerIndexById}
                          playerById={playerById}
                          onCellClick={(number) => handleCellClick(ticket.id, number)}
                          onToggleGift={(number) => handleToggleGift(ticket.id, number)}
                        />
                      )
                    })}
                  </div>
                </section>
              ))}
          </div>

          <DialogFooter className="flex-row justify-end gap-2 bg-gray-300 p-5">
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
              ¿Quitar el número {pendingSteal?.number} a {pendingStealOwnerName}?
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
                if (pendingSteal !== null) {
                  applyCellToggle(pendingSteal.ticketId, pendingSteal.number)
                }
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
