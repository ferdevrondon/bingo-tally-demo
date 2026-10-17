"use client"

import * as React from "react"
import { CheckCircle2Icon, GiftIcon, HashIcon } from "lucide-react"

import { BingoBall } from "@/components/bingo-ball"
import { Badge } from "@/components/ui/badge"
import { FOLDER_TAB } from "@/components/folder-tab"
import { RoundGiftsTab } from "@/components/round-gifts-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useRoundDraft } from "@/lib/round-draft/context"
import { getOpenStats, getRoundGifts } from "@/lib/round-draft/selectors"
import { formatMoney } from "@/lib/rounds"
import { cn } from "@/lib/utils"

const ALL_NUMBERS = Array.from({ length: 15 }, (_, i) => i + 1)

/** Two folder tabs over one card: the numbers still free ("Disponibles") and
 *  the gifted ones of the open round ("Regalados"). Tapping a number opens "Ver cartones" with it ringed (`onNumberClick`);
 *  numbers are assigned there, on the tickets. */
export function OpenNumbersCard({
  onNumberClick,
}: {
  onNumberClick: (number: number) => void
}) {
  const { state } = useRoundDraft()
  const [tab, setTab] = React.useState<"open" | "gifts">("open")
  const giftCount = getRoundGifts(state).giftCount

  const linePrice = state.round?.linePrice ?? 0
  const openNumbers = ALL_NUMBERS.map((number) => {
    const openCount = state.tickets.filter(
      (ticket) =>
        ticket.numbers.find((n) => n.number === number)?.playerId === null
    ).length
    return { number, openCount, amount: openCount * linePrice }
  }).filter((n) => n.openCount > 0)

  const stats = getOpenStats(state)

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => setTab(value === "gifts" ? "gifts" : "open")}
      className="gap-0"
    >
      <TabsList className="h-auto gap-1 rounded-none bg-transparent p-0">
        <TabsTrigger
          value="open"
          className={cn(FOLDER_TAB, "before:bg-primary/85")}
        >
          <HashIcon aria-hidden="true" />
          Disponibles
          {openNumbers.length > 0 && (
            <span
              className={cn(
                "rounded-full px-1.5 text-xs font-semibold tabular-nums",
                tab === "open"
                  ? "bg-primary/15 text-primary"
                  : "bg-white/25 text-white"
              )}
            >
              {openNumbers.length}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger
          value="gifts"
          className={cn(FOLDER_TAB, "before:bg-red-400/75")}
        >
          <GiftIcon aria-hidden="true" />
          Regalados
          {giftCount > 0 && (
            <span
              className={cn(
                "rounded-full px-1.5 text-xs font-semibold tabular-nums",
                tab === "gifts"
                  ? "bg-red-500/15 text-red-700 dark:text-red-400"
                  : "bg-white/25 text-white"
              )}
            >
              {giftCount}
            </span>
          )}
        </TabsTrigger>
      </TabsList>

      <Card className="gap-3 rounded-tl-none">
        <TabsContent value="open" className="flex flex-col gap-3">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
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
                    <BingoBall
                      number={number}
                      amount={amount}
                      variant="pending"
                    />
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </TabsContent>
        <TabsContent value="gifts" className="flex flex-col gap-3">
          <RoundGiftsTab />
        </TabsContent>
      </Card>
    </Tabs>
  )
}
