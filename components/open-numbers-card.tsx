"use client"

import { CheckCircle2Icon } from "lucide-react"

import { BingoBall } from "@/components/bingo-ball"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useRoundDraft } from "@/lib/round-draft/context"
import { getOpenStats } from "@/lib/round-draft/selectors"
import { formatMoney } from "@/lib/rounds"

const ALL_NUMBERS = Array.from({ length: 15 }, (_, i) => i + 1)

/** Tapping a number opens "Ver cartones" with it ringed (`onNumberClick`);
 *  numbers are assigned there, on the tickets. */
export function OpenNumbersCard({
  onNumberClick,
}: {
  onNumberClick: (number: number) => void
}) {
  const { state } = useRoundDraft()

  const linePrice = state.round?.linePrice ?? 0
  const openNumbers = ALL_NUMBERS.map((number) => {
    const openCount = state.tickets.filter(
      (ticket) => ticket.numbers.find((n) => n.number === number)?.playerId === null
    ).length
    return { number, openCount, amount: openCount * linePrice }
  }).filter((n) => n.openCount > 0)

  const stats = getOpenStats(state)

  return (
    <Card className="gap-3">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Números disponibles</CardTitle>
        {openNumbers.length > 0 && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {[
              `${stats.openTickets} de ${stats.totalTickets} cartones abiertos`,
              `${stats.freeLines} números libres`,
              `${formatMoney(stats.freeAmount)} por cobrar`,
            ].map((label) => (
              <Badge
                key={label}
                variant="outline"
                className="border-amber-500/40 text-sm text-amber-600 dark:text-amber-400"
              >
                {label}
              </Badge>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {openNumbers.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2Icon className="size-4 text-green-600" />
            Todos los números tienen jugador asignado.
          </div>
        ) : (
          <div className="flex flex-wrap gap-x-4 gap-y-4 pt-2">
            {openNumbers.map(({ number, amount }) => (
              <button
                key={number}
                type="button"
                title={`Ver dónde está libre el ${number}`}
                onClick={() => onNumberClick(number)}
                className="cursor-pointer"
              >
                <BingoBall number={number} amount={amount} variant="pending" />
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
