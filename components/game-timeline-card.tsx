"use client"

import * as React from "react"
import {
  BanknoteIcon,
  CircleCheckIcon,
  FlagIcon,
  GiftIcon,
  HouseIcon,
  TicketIcon,
  TrophyIcon,
  UserIcon,
  WalletIcon,
} from "lucide-react"

import { useHouse } from "@/components/house-provider"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useNow } from "@/hooks/use-now"
import {
  groupTimeline,
  timelineCategories,
  timelineCategory,
  type TimelineCategory,
} from "@/lib/game-report/timeline"
import type { GameSessionReport } from "@/lib/game-report/types"
import { describeActivity } from "@/lib/round-draft/activity-text"
import { signedMoney } from "@/lib/round-draft/balance"
import type { ActivityEntry } from "@/lib/round-draft/types"
import { cn } from "@/lib/utils"

const CATEGORY_LABELS: Record<TimelineCategory, string> = {
  plays: "Jugadas",
  prizes: "Premios",
  gifts: "Regalos",
  rounds: "Rondas",
  cash: "Caja",
  balances: "Saldos",
  other: "Otros",
}

const CATEGORY_STYLES: Record<TimelineCategory, string> = {
  plays: "bg-primary/12 text-primary",
  prizes: "bg-success/12 text-success",
  gifts: "bg-destructive/10 text-destructive",
  rounds: "bg-chart-4/14 text-chart-4",
  cash: "bg-chart-3/18 text-foreground",
  balances: "bg-chart-3/18 text-foreground",
  other: "bg-muted text-muted-foreground",
}

const PAGE_SIZE = 40

function EntryIcon({ entry }: { entry: Pick<ActivityEntry, "type"> }) {
  const category = timelineCategory(entry.type)
  const Icon =
    entry.type === "game_session_ended" || entry.type === "settlement_closed"
      ? CircleCheckIcon
      : entry.type === "margin_adjustment"
        ? HouseIcon
        : {
            plays: TicketIcon,
            prizes: TrophyIcon,
            gifts: GiftIcon,
            rounds: FlagIcon,
            cash: BanknoteIcon,
            balances: WalletIcon,
            other: UserIcon,
          }[category]
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg",
        CATEGORY_STYLES[category]
      )}
    >
      <Icon className="size-4" aria-hidden="true" />
    </span>
  )
}

// The Historial of /reports/games/[id]: grouped by minute, filterable by kind
// of movement, a page at a time.
export function GameTimelineCard({ report }: { report: GameSessionReport }) {
  const timeZone = useHouse()?.timezone
  // Times are formatted on the client only, so the server HTML can't differ.
  const mounted = useNow() !== null
  const [category, setCategory] = React.useState<TimelineCategory | null>(null)
  const [limit, setLimit] = React.useState(PAGE_SIZE)

  const categories = timelineCategories(report.activity)
  const filtered = category
    ? report.activity.filter((e) => timelineCategory(e.type) === category)
    : report.activity
  const groups = groupTimeline(filtered.slice(0, limit))
  const playerName = (id: number | null) =>
    report.labels.players.find((p) => p.id === id)?.name ?? "Jugador"

  const time = new Intl.DateTimeFormat("es-MX", {
    timeStyle: "short",
    timeZone,
  })
  const day = new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    timeZone,
  })
  const multiDay =
    report.activity.length > 0 &&
    day.format(report.activity[0].timestamp) !==
      day.format(report.activity.at(-1)!.timestamp)

  const pick = (next: TimelineCategory | null) => {
    setCategory(next)
    setLimit(PAGE_SIZE)
  }

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <CardTitle>Historial</CardTitle>
          <CardDescription>
            Cada movimiento de la jornada, del más reciente al primero.
          </CardDescription>
        </div>
        {categories.length > 1 && (
          <div
            role="group"
            aria-label="Filtrar movimientos"
            className="flex flex-wrap gap-1.5"
          >
            {[null, ...categories].map((c) => (
              <Button
                key={c ?? "all"}
                size="sm"
                variant={category === c ? "default" : "outline"}
                aria-pressed={category === c}
                onClick={() => pick(c)}
              >
                {c ? CATEGORY_LABELS[c] : "Todo"}
              </Button>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent className="flex flex-col">
        {groups.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Todavía no hay movimientos.
          </p>
        )}
        {groups.map((group) => (
          <section key={group.minute} className="flex flex-col">
            <div className="flex items-center gap-3 pt-4 pb-1.5">
              <span className="text-xs font-semibold tabular-nums">
                {mounted
                  ? `${multiDay ? `${day.format(group.minute)} · ` : ""}${time.format(group.minute)}`
                  : " "}
              </span>
              <span className="h-px flex-1 bg-border" />
            </div>
            {group.items.map((item) =>
              item.kind === "entry" ? (
                <div
                  key={item.entry.id}
                  className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/60"
                >
                  <EntryIcon entry={item.entry} />
                  <span className="min-w-0 text-sm">
                    {describeActivity(item.entry, report.labels)}
                  </span>
                </div>
              ) : (
                <div
                  key={item.entries[0].id}
                  className="-mx-2 flex items-start gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/60"
                >
                  <EntryIcon entry={{ type: item.type }} />
                  <div className="flex min-w-0 flex-col gap-2 pt-1.5">
                    <span className="text-sm">
                      {item.entries.length === 1
                        ? describeActivity(item.entries[0], report.labels)
                        : item.type === "balance_closed"
                          ? `${item.entries.length} jugadores terminaron con su saldo final`
                          : `${item.entries.length} jugadores entraron con su saldo`}
                    </span>
                    {item.entries.length > 1 && (
                      <ul className="flex flex-wrap gap-1.5">
                        {item.entries.map((e) => (
                          <li
                            key={e.id}
                            className="flex items-center gap-2 rounded-full border px-2.5 py-0.5 text-xs"
                          >
                            <span className="font-medium">
                              {playerName(e.playerId)}
                            </span>
                            <span
                              className={cn(
                                "font-semibold tabular-nums",
                                (e.amount ?? 0) > 0 && "text-success",
                                (e.amount ?? 0) < 0 && "text-destructive"
                              )}
                            >
                              {signedMoney(e.amount ?? 0)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )
            )}
          </section>
        ))}
        {filtered.length > limit && (
          <div className="mt-3 flex justify-center border-t pt-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLimit(limit + PAGE_SIZE)}
            >
              Ver movimientos anteriores ({filtered.length - limit})
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
