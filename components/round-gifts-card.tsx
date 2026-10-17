"use client"

import { Badge } from "@/components/ui/badge"
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getPlayerColorClass } from "@/lib/round-draft/colors"
import { useRoundDraft } from "@/lib/round-draft/context"
import { getRoundGifts } from "@/lib/round-draft/selectors"
import { formatMoney } from "@/lib/rounds"
import { cn } from "@/lib/utils"

// Gifts of the open round: the "Regalados" tab of the open numbers card, built
// like "Disponibles" (title and pills in the header, the gifts below). The
// gifts end with the round.
export function RoundGiftsTab() {
  const { state } = useRoundDraft()
  const gifts = getRoundGifts(state)
  const linePrice = state.round?.linePrice ?? 0
  const playerCount = gifts.players.length

  return (
    <>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle>Números regalados</CardTitle>
        {gifts.giftCount > 0 && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {[
              `${gifts.giftCount} número${gifts.giftCount === 1 ? "" : "s"} regalado${gifts.giftCount === 1 ? "" : "s"}`,
              `${playerCount} jugador${playerCount === 1 ? "" : "es"} con regalo`,
              `${formatMoney(gifts.giftCount * linePrice)} en regalos`,
            ].map((label) => (
              <Badge
                key={label}
                variant="outline"
                className="border-red-500/40 text-sm text-red-600 dark:text-red-400"
              >
                {label}
              </Badge>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {gifts.giftCount === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no hay números regalados en esta ronda.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-2 pt-2">
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
        )}
      </CardContent>
    </>
  )
}
