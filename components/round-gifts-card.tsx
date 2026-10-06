"use client"

import { GiftIcon } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { getPlayerColorClass } from "@/lib/round-draft/colors"
import { useRoundDraft } from "@/lib/round-draft/context"
import { getRoundGifts } from "@/lib/round-draft/selectors"
import { formatMoney } from "@/lib/rounds"
import { cn } from "@/lib/utils"

// Gifts of the open round and what they cost the house (a gift that doesn't
// win costs the line price; the gift ends with the round).
export function RoundGiftsCard() {
  const { state } = useRoundDraft()
  const gifts = getRoundGifts(state)
  if (gifts.giftCount === 0) return null

  const playerCount = gifts.players.length

  return (
    <Card className="gap-2 border-red-500/30 bg-red-500/5">
      <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-2 text-base font-semibold">
          <GiftIcon className="size-5 text-red-600" />
          {playerCount} jugador{playerCount === 1 ? "" : "es"} con números
          regalados
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {gifts.players.map((p) => {
            const index = state.players.findIndex((x) => x.id === p.playerId)
            return (
              <span
                key={p.playerId}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold text-white",
                  getPlayerColorClass(index)
                )}
              >
                {p.playerName} el {p.numbers.join(", ")}
              </span>
            )
          })}
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-red-600 tabular-nums">
            {formatMoney(gifts.giftLoss)}
          </div>
          <div className="text-xs text-muted-foreground">
            pérdida de la casa · {gifts.pendingCount} de {gifts.giftCount}{" "}
            regalo{gifts.giftCount === 1 ? "" : "s"} sin ganar
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
