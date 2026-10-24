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
                className="border-destructive/40 text-sm text-destructive"
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
                    "inline-flex items-center gap-1.5 rounded-full py-1 pr-1.5 pl-2.5 text-sm font-semibold whitespace-nowrap text-white",
                    getPlayerColorClass(index)
                  )}
                >
                  {p.playerName} el
                  {p.numbers.map(({ number, tickets }) => (
                    <span
                      key={number}
                      title={`Número ${number} regalado en ${tickets} cartón${tickets === 1 ? "" : "es"}`}
                      className="flex h-5 items-center justify-center rounded-full bg-white/25 px-1.5 text-xs font-bold text-white tabular-nums"
                    >
                      {number}
                      {tickets > 1 && <span className="opacity-80">×{tickets}</span>} –{" "}
                      {formatMoney(tickets * linePrice)}
                    </span>
                  ))}
                </span>
              )
            })}
          </div>
        )}
      </CardContent>
    </>
  )
}
