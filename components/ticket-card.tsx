"use client"

import { GiftIcon } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getPlayerColorClass } from "@/lib/round-draft/colors"
import type {
  DraftPlayer,
  NumberAssignment,
  Ticket,
} from "@/lib/round-draft/types"
import { cn } from "@/lib/utils"

/** What a click on one number of a ticket does, shared by the Cartones and
 *  Lista views of /new-game: a free number goes to the active player, and the
 *  active player's own number is released. */
export function ticketNumberState(
  entry: NumberAssignment,
  activePlayerId: number | null,
  readOnly: boolean
) {
  const canRelease =
    entry.playerId !== null && entry.playerId === activePlayerId && !readOnly
  const canAssign =
    entry.playerId === null && activePlayerId !== null && !readOnly
  return {
    canAssign,
    canRelease,
    clickable: canAssign || canRelease,
    title:
      entry.playerId === null && activePlayerId === null && !readOnly
        ? "Selecciona un jugador activo primero"
        : undefined,
  }
}

/** The gift mark of a sold number: a toggle for the admin, a badge for an
 *  observer (only when it is a gift). */
export function GiftToggle({
  entry,
  readOnly,
  onToggle,
  className,
}: {
  entry: NumberAssignment
  readOnly: boolean
  onToggle: () => void
  className?: string
}) {
  const base =
    "flex size-5 items-center justify-center rounded-full border bg-background shadow-sm"
  if (readOnly) {
    return entry.isGift ? (
      <span
        title="Regalo"
        className={cn(base, "border-red-500/60 text-red-500", className)}
      >
        <GiftIcon className="size-3" />
      </span>
    ) : null
  }
  if (entry.playerId === null) return null
  return (
    <button
      type="button"
      onClick={onToggle}
      title={entry.isGift ? "Quitar regalo" : "Marcar como regalo"}
      className={cn(
        base,
        "transition-colors",
        entry.isGift
          ? "border-red-500/60 text-red-500"
          : "border-border text-muted-foreground hover:text-foreground",
        className
      )}
    >
      <GiftIcon className="size-3" />
    </button>
  )
}

export interface TicketCardProps {
  ticket: Ticket
  players: DraftPlayer[]
  activePlayerId: number | null
  /** An observer: numbers and gifts are shown, not clickable. */
  readOnly?: boolean
  onAssign: (number: number) => void
  onToggleGift: (number: number) => void
  /** A number to point out where it is still free ("Números disponibles"). */
  highlightNumber?: number | null
}

export function TicketCard({
  ticket,
  players,
  activePlayerId,
  readOnly = false,
  onAssign,
  onToggleGift,
  highlightNumber = null,
}: TicketCardProps) {
  const assignedCount = ticket.numbers.filter((n) => n.playerId !== null).length
  const playerIndexById = new Map(players.map((p, i) => [p.id, i]))
  const playerById = new Map(players.map((p) => [p.id, p]))

  return (
    <Card className="w-full max-w-72">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Cartón #{ticket.index}</CardTitle>
        <span className="text-xs text-muted-foreground">
          {assignedCount}/15
        </span>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-5 gap-1.5">
          {ticket.numbers.map((entry) => {
            const owner =
              entry.playerId !== null
                ? playerById.get(entry.playerId)
                : undefined
            const { canAssign, canRelease, clickable, title } =
              ticketNumberState(entry, activePlayerId, readOnly)
            return (
              <div key={entry.number} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    if (clickable) onAssign(entry.number)
                  }}
                  disabled={readOnly || (entry.playerId === null && !canAssign)}
                  title={owner?.name ?? title}
                  aria-pressed={entry.playerId !== null}
                  className={cn(
                    "aspect-square w-full rounded-lg border text-sm font-medium transition-colors",
                    "flex flex-col items-center justify-center gap-0.5 px-0.5",
                    entry.playerId !== null
                      ? cn(
                          getPlayerColorClass(
                            playerIndexById.get(entry.playerId) ?? -1
                          ),
                          "border-transparent text-white",
                          entry.isGift &&
                            "border-2 border-dashed border-foreground/40",
                          canRelease ? "cursor-pointer" : "cursor-default"
                        )
                      : cn(
                          "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
                          entry.number === highlightNumber &&
                            "ring-2 ring-amber-500 ring-offset-2 ring-offset-background",
                          readOnly
                            ? "cursor-default"
                            : canAssign
                              ? "cursor-pointer hover:bg-amber-500/20"
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
                <GiftToggle
                  entry={entry}
                  readOnly={readOnly}
                  onToggle={() => onToggleGift(entry.number)}
                  className="absolute -top-1.5 -right-1.5"
                />
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
