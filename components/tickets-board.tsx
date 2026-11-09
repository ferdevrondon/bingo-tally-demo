"use client"

import * as React from "react"
import { LayoutGridIcon, ListIcon, PlusIcon } from "lucide-react"

import { RemovePlayerDialog } from "@/components/remove-player-dialog"
import { TicketCard } from "@/components/ticket-card"
import { TicketListColumn } from "@/components/ticket-list-column"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
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
import { useRoundDraft } from "@/lib/round-draft/context"
import { canRemoveTicket, sortPlayersByName } from "@/lib/round-draft/selectors"
import type { DraftPlayer } from "@/lib/round-draft/types"
import { cn } from "@/lib/utils"

export type TicketsView = "tickets" | "list"

// Cartones (grid) or Lista (columns): a per-browser display preference,
// shared by /new-game, "Ver cartones" and "Editar jugada" in /active-round.
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

export function useTicketsView() {
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

/** The Cartones/Lista toggle; the choice is remembered per browser. */
export function TicketsViewToggle({ className }: { className?: string }) {
  const [view, setView] = useTicketsView()
  return (
    <ToggleGroup
      variant="outline"
      spacing={0}
      className={className}
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
  )
}

/** The active-player select and the Cartones/Lista toggle above the tickets.
 *  `leading` and `trailing` hold the controls each screen adds around the
 *  player select (/new-game: the round select before it and "Agregar
 *  jugador" after it). */
export function TicketsToolbar({
  leading,
  trailing,
}: {
  leading?: React.ReactNode
  trailing?: React.ReactNode
}) {
  const { state, setActivePlayer } = useRoundDraft()

  return (
    <div className="flex flex-wrap items-center gap-3">
      {leading}

      <PlayerCombobox
        players={state.players}
        value={state.activePlayerId}
        onChange={setActivePlayer}
        disabled={!state.round}
        placeholder={
          state.round
            ? "Selecciona un jugador activo"
            : "Primero elige la ronda"
        }
        className="w-full sm:w-72"
      />

      {trailing}

      <TicketsViewToggle className="ml-auto" />
    </div>
  )
}

export type ComboboxPlayer = Pick<DraftPlayer, "id" | "name">

/** A player select you can type into: the list is alphabetical and the
 *  filter runs in the browser over the players already in memory (no
 *  request per keystroke). Accents and case are ignored ("jose" finds
 *  "JOSÉ"). */
export function PlayerCombobox({
  players,
  value,
  onChange,
  disabled,
  placeholder,
  className,
}: {
  players: ComboboxPlayer[]
  value: number | null
  onChange: (playerId: number | null) => void
  disabled?: boolean
  placeholder: string
  className?: string
}) {
  const sorted = React.useMemo(() => sortPlayersByName(players), [players])
  // The selected item must be one of `sorted` (compared by identity).
  const selected = sorted.find((p) => p.id === value) ?? null

  return (
    <Combobox
      items={sorted}
      value={selected}
      onValueChange={(player: ComboboxPlayer | null) =>
        onChange(player?.id ?? null)
      }
      itemToStringLabel={(player: ComboboxPlayer) => player.name}
      disabled={disabled}
    >
      <ComboboxInput
        placeholder={placeholder}
        disabled={disabled}
        className={className}
      />
      <ComboboxContent>
        <ComboboxEmpty>Sin coincidencias</ComboboxEmpty>
        <ComboboxList>
          {(player: ComboboxPlayer) => (
            <ComboboxItem key={player.id} value={player}>
              {player.name}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

/** Every ticket of the game session in the chosen view, plus "Agregar
 *  cartón". `highlightNumber` rings that number where it is still free. */
export function TicketsGrid({
  highlightNumber = null,
}: {
  highlightNumber?: number | null
}) {
  const { state, readOnly, addTicket, removeTicket, assignNumber, toggleGift } =
    useRoundDraft()
  const [isTicketPending, startTicketTransition] = React.useTransition()
  const [view] = useTicketsView()
  // The ticket waiting for "Retirar cartón" to be confirmed.
  const [removing, setRemoving] = React.useState<{ id: number; index: number } | null>(null)
  // The player whose last number was tapped: freeing it removes them from the
  // game session, after confirming.
  const [leaving, setLeaving] = React.useState<{ id: number; name: string } | null>(null)

  function handleAssign(ticketId: number, number: number) {
    const player = state.players.find((p) => p.id === state.activePlayerId)
    const tapped = state.tickets
      .find((t) => t.id === ticketId)
      ?.numbers.find((n) => n.number === number)
    if (player && !readOnly && !player.pendingCarryOverDecision && tapped?.playerId === player.id) {
      const held = state.tickets.reduce(
        (count, t) => count + t.numbers.filter((n) => n.playerId === player.id).length,
        0
      )
      if (held === 1) {
        setLeaving({ id: player.id, name: player.name })
        return
      }
    }
    assignNumber(ticketId, number)
  }

  function handleAddTicket() {
    startTicketTransition(async () => {
      await addTicket()
    })
  }

  function handleRemoveTicket() {
    if (!removing) return
    const { id } = removing
    setRemoving(null)
    startTicketTransition(async () => {
      await removeTicket(id)
    })
  }

  const ticketProps = (ticketId: number) => ({
    players: state.players,
    activePlayerId: state.activePlayerId,
    readOnly,
    highlightNumber,
    onAssign: (number: number) => handleAssign(ticketId, number),
    onToggleGift: (number: number) => toggleGift(ticketId, number),
    onRemove:
      !readOnly && !isTicketPending && canRemoveTicket(state, ticketId)
        ? () => {
            const ticket = state.tickets.find((t) => t.id === ticketId)
            if (ticket) setRemoving({ id: ticket.id, index: ticket.index })
          }
        : undefined,
  })

  const confirmRemove = (
    <>
      {leaving && (
        <RemovePlayerDialog
          player={leaving}
          open
          onOpenChange={(open) => !open && setLeaving(null)}
          reason="no-numbers"
        />
      )}
      <AlertDialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Retirar el cartón {removing?.index}?</AlertDialogTitle>
            <AlertDialogDescription>
              No tiene números jugados. Su historial se conserva y, si agregas un cartón más
              adelante, vuelve este mismo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleRemoveTicket}>
              Retirar cartón
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )

  return view === "tickets" ? (
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
          className="w-full max-w-72"
        />
      )}
      {confirmRemove}
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
      {confirmRemove}
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
