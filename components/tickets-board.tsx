"use client"

import * as React from "react"
import { LayoutGridIcon, ListIcon, PlusIcon } from "lucide-react"

import { TicketCard } from "@/components/ticket-card"
import { TicketListColumn } from "@/components/ticket-list-column"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useRoundDraft } from "@/lib/round-draft/context"
import { cn } from "@/lib/utils"

type TicketsView = "tickets" | "list"

// Cartones (grid) or Lista (columns): a per-browser display preference,
// shared by /new-game and "Ver cartones" in /active-round.
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
  const [view, setView] = useTicketsView()

  return (
    <div className="flex flex-wrap items-center gap-3">
      {leading}

      <Select
        value={state.activePlayerId != null ? String(state.activePlayerId) : ""}
        onValueChange={(value) => setActivePlayer(value ? Number(value) : null)}
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

      {trailing}

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
  )
}

/** Every ticket of the game session in the chosen view, plus "Agregar
 *  cartón". `highlightNumber` rings that number where it is still free. */
export function TicketsGrid({
  highlightNumber = null,
}: {
  highlightNumber?: number | null
}) {
  const { state, readOnly, addTicket, assignNumber, toggleGift } =
    useRoundDraft()
  const [isTicketPending, startTicketTransition] = React.useTransition()
  const [view] = useTicketsView()

  function handleAddTicket() {
    startTicketTransition(async () => {
      await addTicket()
    })
  }

  const ticketProps = (ticketId: number) => ({
    players: state.players,
    activePlayerId: state.activePlayerId,
    readOnly,
    highlightNumber,
    onAssign: (number: number) => assignNumber(ticketId, number),
    onToggleGift: (number: number) => toggleGift(ticketId, number),
  })

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
