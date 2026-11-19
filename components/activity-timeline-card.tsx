"use client"

import * as React from "react"
import {
  BanknoteIcon,
  ChevronDownIcon,
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
import {
  describeActivity,
  type ActivityContext,
} from "@/lib/round-draft/activity-text"
import { signedMoney } from "@/lib/round-draft/balance"
import type { ActivityEntry } from "@/lib/round-draft/types"
import { cn } from "@/lib/utils"

const CATEGORY_LABELS: Record<TimelineCategory, string> = {
  plays: "Jugadas",
  prizes: "Premios",
  gifts: "Regalos",
  rounds: "Rondas",
  cash: "Recargas",
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

// Open / closed of a collapsible card: a per-browser display preference
// (like "new-game-view" in tickets-board.tsx), one key per card.
const openListeners = new Set<() => void>()
// Fallback when storage is blocked: the choice lasts until the page reloads.
const memoryOpen = new Map<string, boolean>()

function readOpen(key: string, fallback: boolean): boolean {
  try {
    const saved = localStorage.getItem(key)
    if (saved === "open") return true
    if (saved === "closed") return false
  } catch {}
  return memoryOpen.get(key) ?? fallback
}

function subscribeOpen(listener: () => void) {
  openListeners.add(listener)
  return () => {
    openListeners.delete(listener)
  }
}

function useStoredOpen(key: string | null, fallback: boolean) {
  // The server (and the first render) uses the fallback; the browser then
  // reads the saved choice.
  const open = React.useSyncExternalStore(
    subscribeOpen,
    () => (key ? readOpen(key, fallback) : fallback),
    () => fallback
  )
  function change(next: boolean) {
    if (!key) return
    memoryOpen.set(key, next)
    try {
      localStorage.setItem(key, next ? "open" : "closed")
    } catch {}
    openListeners.forEach((listener) => listener())
  }
  return [open, change] as const
}

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

// A game session's activity, newest first: grouped by minute, filterable by
// kind of movement, a page at a time, inside its own scroll so a long game
// session never stretches the page. The Historial of /reports/games/[id] and
// the Actividad reciente of /active-round. `collapsible` (the live game)
// starts it closed: one row with the count and the latest movement, which
// stays live; the open / closed choice is remembered per browser.
export function ActivityTimelineCard({
  activity,
  labels,
  title,
  description,
  emptyText,
  collapsible = null,
}: {
  activity: ActivityEntry[]
  labels: ActivityContext
  title: string
  description: string
  emptyText: string
  collapsible?: { storageKey: string; defaultOpen?: boolean } | null
}) {
  const timeZone = useHouse()?.timezone
  // Times are formatted on the client only, so the server HTML can't differ.
  const mounted = useNow() !== null
  const [category, setCategory] = React.useState<TimelineCategory | null>(null)
  const [limit, setLimit] = React.useState(PAGE_SIZE)
  const [storedOpen, setOpen] = useStoredOpen(
    collapsible?.storageKey ?? null,
    collapsible?.defaultOpen ?? false
  )
  const open = collapsible ? storedOpen : true
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const bodyId = React.useId()

  const categories = timelineCategories(activity)
  const filtered = category
    ? activity.filter((e) => timelineCategory(e.type) === category)
    : activity
  const groups = groupTimeline(filtered.slice(0, limit))
  const playerName = (id: number | null) =>
    labels.players.find((p) => p.id === id)?.name ?? "Jugador"

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
    activity.length > 0 &&
    day.format(activity[0].timestamp) !== day.format(activity.at(-1)!.timestamp)

  const pick = (next: TimelineCategory | null) => {
    setCategory(next)
    setLimit(PAGE_SIZE)
    scrollRef.current?.scrollTo({ top: 0 })
  }

  const latest = activity[0] ?? null
  const minuteLabel = (timestamp: number) =>
    mounted
      ? `${multiDay ? `${day.format(timestamp)} · ` : ""}${time.format(timestamp)}`
      : " "

  const filters = categories.length > 1 && (
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
  )

  return (
    // Collapsible: no flex gap, so a closed card is just its header row.
    <Card className={cn(collapsible && "gap-0")}>
      {collapsible ? (
        <CardHeader className="gap-0">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={() => setOpen(!open)}
            className="group/toggle -mx-2 flex min-w-0 items-center gap-3 rounded-xl px-2 py-1 text-left transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="flex items-center gap-2">
                <CardTitle>{title}</CardTitle>
                {activity.length > 0 && (
                  <span className="rounded-full bg-muted px-2 text-xs font-medium text-muted-foreground tabular-nums">
                    {activity.length}
                  </span>
                )}
              </span>
              {open ? (
                <CardDescription>{description}</CardDescription>
              ) : latest ? (
                // The latest movement stays visible while closed (and live).
                <span className="truncate text-sm text-muted-foreground">
                  <span className="font-medium text-foreground tabular-nums">
                    {minuteLabel(latest.timestamp)}
                  </span>
                  {" · "}
                  {describeActivity(latest, labels)}
                </span>
              ) : (
                <CardDescription>{emptyText}</CardDescription>
              )}
            </span>
            {/* The toggle at the end of the row: a word on wider screens and
                a round primary-tinted chevron, filled while open. The whole
                row is the button, so the target is large. */}
            <span className="flex shrink-0 items-center gap-2">
              <span className="hidden text-sm font-medium text-primary sm:inline">
                {open ? "Ocultar" : "Ver todo"}
              </span>
              <span
                className={cn(
                  "flex size-10 items-center justify-center rounded-full ring-1 transition-colors motion-reduce:transition-none",
                  open
                    ? "bg-primary text-primary-foreground ring-primary"
                    : "bg-primary/10 text-primary ring-primary/25 group-hover/toggle:bg-primary/15"
                )}
                aria-hidden="true"
              >
                <ChevronDownIcon
                  className={cn(
                    "size-5 transition-transform duration-200 motion-reduce:transition-none",
                    open && "rotate-180"
                  )}
                  strokeWidth={2.5}
                />
              </span>
            </span>
          </button>
          {open && filters && <div className="pt-3">{filters}</div>}
        </CardHeader>
      ) : (
        <CardHeader className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {filters}
        </CardHeader>
      )}
      <div
        id={bodyId}
        className={cn(
          "grid transition-[grid-template-rows] duration-200 motion-reduce:transition-none",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          collapsible && open && "mt-(--card-spacing)"
        )}
      >
        <div className="min-h-0 overflow-hidden" inert={!open}>
          <CardContent className="flex flex-col">
            <div
              ref={scrollRef}
              tabIndex={0}
              role="region"
              aria-label={`${title}: movimientos`}
              className="-mx-2 flex max-h-[min(60vh,32rem)] flex-col overflow-y-auto overscroll-contain px-2 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {groups.length === 0 && (
                <p className="text-sm text-muted-foreground">{emptyText}</p>
              )}
              {groups.map((group) => (
                <section key={group.minute} className="flex flex-col">
                  <div className="sticky top-0 z-10 flex items-center gap-3 bg-card pt-4 pb-1.5">
                    <span className="text-xs font-semibold tabular-nums">
                      {minuteLabel(group.minute)}
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
                          {describeActivity(item.entry, labels)}
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
                              ? describeActivity(item.entries[0], labels)
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
            </div>
          </CardContent>
        </div>
      </div>
    </Card>
  )
}
