"use client"

import {
  GiftToggle,
  ticketNumberState,
  type TicketCardProps,
} from "@/components/ticket-card"
import { getPlayerColorClass } from "@/lib/round-draft/colors"
import { cn } from "@/lib/utils"

// The Lista view of /new-game: one ticket as a narrow column, a row per
// number with its player's name. Same rules and colors as TicketCard.
export function TicketListColumn({
  ticket,
  players,
  activePlayerId,
  readOnly = false,
  onAssign,
  onToggleGift,
}: TicketCardProps) {
  const assignedCount = ticket.numbers.filter((n) => n.playerId !== null).length
  const playerIndexById = new Map(players.map((p, i) => [p.id, i]))
  const playerById = new Map(players.map((p) => [p.id, p]))

  return (
    <div className="flex w-40 shrink-0 flex-col gap-2">
      <span className="w-fit rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
        Cartón {ticket.index}
      </span>
      <div className="flex flex-col gap-1 rounded-2xl border border-primary/30 bg-card p-2">
        {ticket.numbers.map((entry) => {
          const owner =
            entry.playerId !== null ? playerById.get(entry.playerId) : undefined
          const { canAssign, canRelease, clickable, title } = ticketNumberState(
            entry,
            activePlayerId,
            readOnly
          )
          return (
            <div
              key={entry.number}
              className={cn(
                "flex h-7 items-center gap-1 rounded-md border pr-1 text-xs font-medium transition-colors",
                owner
                  ? cn(
                      getPlayerColorClass(playerIndexById.get(owner.id) ?? -1),
                      "border-transparent text-white",
                      entry.isGift &&
                        "border-2 border-dashed border-foreground/40"
                    )
                  : "border-border text-muted-foreground"
              )}
            >
              <button
                type="button"
                onClick={() => {
                  if (clickable) onAssign(entry.number)
                }}
                disabled={readOnly || (entry.playerId === null && !canAssign)}
                title={owner?.name ?? title}
                aria-pressed={entry.playerId !== null}
                className={cn(
                  "flex h-full min-w-0 flex-1 items-center gap-2 rounded-md px-2",
                  owner
                    ? canRelease
                      ? "cursor-pointer"
                      : "cursor-default"
                    : readOnly
                      ? "cursor-default"
                      : canAssign
                        ? "cursor-pointer hover:bg-muted"
                        : "cursor-not-allowed"
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
              <GiftToggle
                entry={entry}
                readOnly={readOnly}
                onToggle={() => onToggleGift(entry.number)}
                className="size-4 shrink-0 [&_svg]:size-2.5"
              />
            </div>
          )
        })}
        <div className="mt-1 flex items-center justify-between px-1 text-xs text-muted-foreground">
          <span>{assignedCount === 15 ? "Lleno" : "Disponible"}</span>
          <span className="tabular-nums">{assignedCount}/15</span>
        </div>
      </div>
    </div>
  )
}
