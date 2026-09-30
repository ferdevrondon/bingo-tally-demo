"use client"

import * as React from "react"
import { AwardIcon, ChevronDownIcon } from "lucide-react"

import { HouseResultBreakdown } from "@/components/house-result-breakdown"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { RoundReport } from "@/lib/game-report/types"
import { signedMoney } from "@/lib/round-draft/balance"
import { formatMoney } from "@/lib/rounds"
import { cn } from "@/lib/utils"

/** The winners of a round, one line per winning ticket; a winning number
 *  nobody had leaves its prize with the house. */
export function RoundWinners({ round }: { round: RoundReport }) {
  if (!round.played) {
    return (
      <p className="text-sm text-muted-foreground">
        No se jugó: se devolvió lo cobrado por la ronda.
      </p>
    )
  }
  return (
    <ul className="flex flex-col gap-1.5 text-sm">
      {round.winningNumbers.map((number, slot) => {
        if (number === null) return null
        const winners = round.winners.filter((w) => w.slot === slot)
        return winners.length === 0 ? (
          <li key={`${slot}-none`} className="text-muted-foreground">
            #{number} · nadie lo tenía (el premio de {formatMoney(round.prizes[slot] ?? 0)} queda
            para la casa)
          </li>
        ) : (
          winners.map((w) => (
            <li
              key={`${slot}-${w.ticketIndex}-${w.playerId}`}
              className="flex items-center justify-between gap-3"
            >
              <span>
                <span className="font-medium">{w.playerName}</span> · Cartón {w.ticketIndex} · #
                {w.number}
              </span>
              <span className="font-medium text-green-600 tabular-nums">
                {formatMoney(w.prize)}
              </span>
            </li>
          ))
        )
      })}
    </ul>
  )
}

// Rounds of a game session, newest first, each one expandable with its
// winners and house result (business rule F).
export function RoundHistoryCard({
  rounds,
  description,
  emptyText = "Todavía no se cerró ninguna ronda.",
}: {
  rounds: RoundReport[]
  description?: string
  emptyText?: string
}) {
  const [expandedId, setExpandedId] = React.useState<number | null>(null)
  const houseTotal = rounds.reduce((sum, r) => sum + r.house.total, 0)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle>Historial de rondas</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {rounds.length > 0 && (
          <Badge
            variant="outline"
            className={cn(
              houseTotal >= 0
                ? "border-green-600/30 text-green-700 dark:text-green-400"
                : "border-destructive/40 text-destructive"
            )}
          >
            Resultado de la casa: {signedMoney(houseTotal)}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {rounds.length === 0 && <p className="text-sm text-muted-foreground">{emptyText}</p>}
        {rounds.map((round) => {
          const isExpanded = expandedId === round.id
          const winning = round.winningNumbers.filter((n): n is number => n !== null)
          return (
            <div
              key={round.id}
              className={cn(
                "rounded-xl border transition-colors",
                isExpanded ? "border-primary/40 bg-primary/5" : "border-border"
              )}
            >
              <button
                type="button"
                aria-expanded={isExpanded}
                onClick={() => setExpandedId(isExpanded ? null : round.id)}
                className="flex w-full flex-wrap items-center justify-between gap-3 p-3 text-left"
              >
                <span className="font-medium">
                  Ronda {round.seq} · {round.name}
                  {round.status === "open" && (
                    <span className="ml-2 text-xs text-muted-foreground">(en juego)</span>
                  )}
                </span>
                <span className="flex flex-wrap items-center gap-1.5">
                  {winning.map((n, i) => (
                    <span
                      key={`${n}-${i}`}
                      className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-sm font-semibold text-green-700 dark:text-green-400"
                    >
                      <AwardIcon className="size-3.5" aria-hidden="true" />#{n}
                    </span>
                  ))}
                </span>
                <span
                  className={cn(
                    "text-sm font-semibold tabular-nums",
                    round.house.total >= 0 ? "text-green-600" : "text-destructive"
                  )}
                >
                  {signedMoney(round.house.total)}
                </span>
                <ChevronDownIcon
                  className={cn(
                    "size-4 text-muted-foreground transition-transform",
                    isExpanded && "rotate-180"
                  )}
                  aria-hidden="true"
                />
              </button>

              {isExpanded && (
                <div className="flex flex-col gap-4 border-t px-4 pt-3 pb-4">
                  <p className="text-xs text-muted-foreground">
                    {formatMoney(round.linePrice)} por línea · premios{" "}
                    {round.prizes.map(formatMoney).join(" / ")}
                    {round.closedAtLabel && ` · cerró ${round.closedAtLabel}`}
                  </p>
                  <RoundWinners round={round} />
                  <HouseResultBreakdown house={round.house} />
                </div>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
