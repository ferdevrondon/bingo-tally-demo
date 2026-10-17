"use client"

import { GiftIcon } from "lucide-react"

import { getPlayerColorClass } from "@/lib/round-draft/colors"
import { useRoundDraft } from "@/lib/round-draft/context"
import { getRoundGifts } from "@/lib/round-draft/selectors"
import { formatMoney } from "@/lib/rounds"
import { cn } from "@/lib/utils"

// Gifts of the open round and what they cost the house (a gift that doesn't
// win costs the line price; the gift ends with the round). It is the "Regalados"
// tab of the open numbers card.
export function RoundGiftsContent() {
  const { state } = useRoundDraft()
  const gifts = getRoundGifts(state)
  if (gifts.giftCount === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Todavía no hay números regalados en esta ronda.
      </p>
    )
  }

  const playerCount = gifts.players.length

  return (
    <div className="flex flex-col gap-4 @4xl/main:flex-row @4xl/main:items-center @4xl/main:gap-6">
      {/* Narrow: summary left, loss right, pills below. Wide (@4xl): one row, summary, pills, loss. */}
      <div className="flex items-start justify-between gap-4 @4xl/main:contents">
        <div className="flex items-center gap-2 text-base font-semibold @4xl/main:order-1">
          <GiftIcon className="size-5 shrink-0 text-red-600" />
          {playerCount} jugador{playerCount === 1 ? "" : "es"} con números
          regalados
        </div>
        <div className="shrink-0 text-right @4xl/main:order-3">
          <div className="text-2xl font-bold text-red-600 tabular-nums">
            {formatMoney(gifts.giftLoss)}
          </div>
          <div className="text-xs text-muted-foreground">
            pérdida de la casa
            <span className="hidden @4xl/main:inline">
              {" "}
              · {gifts.pendingCount} de {gifts.giftCount} regalo
              {gifts.giftCount === 1 ? "" : "s"} sin ganar
            </span>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 @4xl/main:order-2 @4xl/main:min-w-0 @4xl/main:flex-1">
        {gifts.players.map((p) => {
          const index = state.players.findIndex((x) => x.id === p.playerId)
          return (
            <span
              key={p.playerId}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold whitespace-nowrap text-white",
                getPlayerColorClass(index)
              )}
            >
              {p.playerName} el {p.numbers.join(", ")}
            </span>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground @4xl/main:hidden">
        {gifts.pendingCount} de {gifts.giftCount} regalo
        {gifts.giftCount === 1 ? "" : "s"} sin ganar
      </p>
    </div>
  )
}
