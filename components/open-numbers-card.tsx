"use client"

import { CheckCircle2Icon } from "lucide-react"

import { BingoBall } from "@/components/bingo-ball"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { assignTicket } from "@/lib/round-draft/assign-ticket"
import { useRoundDraft } from "@/lib/round-draft/context"
import { getOpenStats } from "@/lib/round-draft/selectors"
import { formatMoney } from "@/lib/rounds"
import { cn } from "@/lib/utils"

const ALL_NUMBERS = Array.from({ length: 15 }, (_, i) => i + 1)

export function OpenNumbersCard() {
  const { state, readOnly, assignNumber } = useRoundDraft()

  const linePrice = state.round?.linePrice ?? 0
  const openNumbers = ALL_NUMBERS.map((number) => {
    const openCount = state.tickets.filter(
      (ticket) => ticket.numbers.find((n) => n.number === number)?.playerId === null
    ).length
    return { number, openCount, amount: openCount * linePrice }
  }).filter((n) => n.openCount > 0)

  const stats = getOpenStats(state)
  const canAssign = state.activePlayerId !== null

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
            {openNumbers.map(({ number, amount }) =>
              readOnly ? (
                <BingoBall key={number} number={number} amount={amount} variant="pending" />
              ) : (
              <button
                key={number}
                type="button"
                disabled={!canAssign}
                title={canAssign ? undefined : "Selecciona un jugador primero"}
                onClick={() => {
                  const ticketId = assignTicket(number, state.tickets)
                  if (ticketId !== null) assignNumber(ticketId, number)
                }}
                className={cn(canAssign ? "cursor-pointer" : "cursor-not-allowed opacity-60")}
              >
                <BingoBall number={number} amount={amount} variant="pending" />
              </button>
              )
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
