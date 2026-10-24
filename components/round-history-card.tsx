"use client"

import * as React from "react"
import {
  ChevronDownIcon,
  GiftIcon,
  LayersIcon,
  PackageOpenIcon,
  ShoppingBagIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  TrophyIcon,
  WalletIcon,
} from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FOLDER_TAB } from "@/components/folder-tab"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { roundNumbers } from "@/lib/game-report/round-counts"
import type { RoundGift, RoundReport } from "@/lib/game-report/types"
import { signedMoney } from "@/lib/round-draft/balance"
import { formatMoney } from "@/lib/rounds"
import { cn } from "@/lib/utils"

/** The winners of a round, one line per winning number: every player who
 *  had it with what they were paid. A winning number nobody had leaves its
 *  prize with the house. */
export function RoundWinners({ round }: { round: RoundReport }) {
  if (!round.played) {
    return (
      <p className="text-xs text-muted-foreground">
        No se jugó: se devolvió lo cobrado por la ronda.
      </p>
    )
  }
  return (
    <ul className="flex flex-col gap-1.5">
      {round.winningNumbers.map((number, slot) => {
        if (number === null) return null
        const winners = round.winners.filter((w) => w.slot === slot)
        return (
          <li key={slot} className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="inline-flex h-7 items-center gap-1 rounded-full border border-amber-500 bg-amber-400 px-2 text-sm font-extrabold text-amber-950 tabular-nums">
              <TrophyIcon className="size-3.5" aria-hidden="true" />
              {number}
            </span>
            {winners.length === 0 ? (
              <span className="text-muted-foreground">
                Nadie lo tenía: el premio de {formatMoney(round.prizes[slot] ?? 0)} queda para la
                casa
              </span>
            ) : (
              winners.map((w) => (
                <span
                  key={`${w.ticketIndex}-${w.playerId}`}
                  className="inline-flex h-7 items-center gap-1.5 rounded-full border border-warning/60 bg-amber-100 pr-2.5 pl-1 font-semibold text-amber-950 dark:bg-warning/15 dark:text-amber-100"
                >
                  <span className="flex size-5 items-center justify-center rounded-full bg-amber-400 text-[10px] font-bold text-amber-950">
                    {w.playerName.charAt(0).toUpperCase()}
                  </span>
                  {w.playerName}
                  {w.isGift && (
                    <span
                      title="Ganó con un número regalado: se paga el premio menos el precio del número"
                      className="inline-flex items-center gap-0.5 rounded-full bg-destructive/10 px-1 text-[10px] text-destructive"
                    >
                      <GiftIcon className="size-3" aria-hidden="true" />
                      regalo
                    </span>
                  )}
                  <span className="whitespace-nowrap tabular-nums">
                    {w.isGift && (
                      <span className="text-muted-foreground">
                        {formatMoney(round.prizes[slot] ?? w.prize)} −{" "}
                        {formatMoney((round.prizes[slot] ?? w.prize) - w.prize)} ={" "}
                      </span>
                    )}
                    <span className="text-success">{formatMoney(w.prize)}</span>
                  </span>
                </span>
              ))
            )}
          </li>
        )
      })}
    </ul>
  )
}

/** One slim stat: icon, label and value on a single line. */
function Stat({
  icon,
  label,
  value,
  tone = "neutral",
}: {
  icon: React.ReactNode
  label: string
  value: string
  tone?: "neutral" | "amber" | "red" | "green"
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border px-2.5 py-1.5",
        tone === "amber" && "border-warning/40 bg-amber-50 dark:bg-warning/10",
        tone === "red" && "border-destructive/30 bg-destructive/5",
        tone === "green" && "border-success/30 bg-success/10",
        tone === "neutral" && "bg-muted/40"
      )}
    >
      {icon}
      <span className="min-w-0 flex-1 text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-sm font-bold tabular-nums",
          tone === "red" && "text-destructive",
          tone === "green" && "text-success"
        )}
      >
        {value}
      </span>
    </div>
  )
}

/** What happened to the round's numbers and its result. The first lines are
 *  money (sales, prizes paid); the gifted and house numbers are shown with
 *  their value for reference and are not part of the result. */
function RoundSummary({ round }: { round: RoundReport }) {
  const { house } = round
  const n = roundNumbers(round)
  const plural = (count: number, one: string, many: string) =>
    `${count} ${count === 1 ? one : many}`
  const items: {
    icon: typeof ShoppingBagIcon
    iconClass: string
    label: string
    value: number
    signed: boolean
  }[] = [
    {
      icon: ShoppingBagIcon,
      iconClass: "text-success",
      label: plural(n.sold, "número vendido", "números vendidos"),
      value: house.sales,
      signed: true,
    },
    {
      icon: TrophyIcon,
      iconClass: "text-warning",
      label: plural(n.prizes, "premio pagado", "premios pagados"),
      value: -house.prizes,
      signed: true,
    },
    {
      icon: GiftIcon,
      iconClass: "text-destructive",
      label: `${plural(n.gifted, "regalado", "regalados")} (valor, no suma)`,
      value: n.giftedValue,
      signed: false,
    },
    {
      icon: PackageOpenIcon,
      iconClass: "text-muted-foreground",
      label: `${plural(n.houseNumbers, "número se quedó la casa", "números se quedó la casa")}${
        n.unsoldWon > 0 ? ` · ${n.unsoldWon} ganador${n.unsoldWon === 1 ? "" : "es"}` : ""
      } (valor, no suma)`,
      value: n.houseValue,
      signed: false,
    },
    // Margins of rounds closed before the cash basis (2026-10-23).
    { icon: GiftIcon, iconClass: "text-destructive", label: "Regalados que no ganaron (antes)", value: house.gifts, signed: true },
    { icon: PackageOpenIcon, iconClass: "text-muted-foreground", label: "Sin vender que no ganaron (antes)", value: house.unsoldLosing, signed: true },
    { icon: PackageOpenIcon, iconClass: "text-warning", label: "Sin vender que ganaron (antes)", value: house.unsoldWinning, signed: true },
  ].filter((item, i) => i < 4 || item.value !== 0)
  return (
    <dl className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
      {items.map(({ icon: Icon, iconClass, label, value, signed }) => (
        <div
          key={label}
          className={cn("flex items-center gap-1.5", value === 0 && "text-muted-foreground")}
        >
          <Icon className={cn("size-3.5 shrink-0", iconClass)} aria-hidden="true" />
          <dt className="min-w-0 flex-1">{label}</dt>
          <dd className="font-semibold tabular-nums">
            {signed ? signedMoney(value) : formatMoney(value)}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function RoundRow({
  round,
  index,
  expanded,
  onToggle,
}: {
  round: RoundReport
  index: number
  expanded: boolean
  onToggle: () => void
}) {
  const winning = round.winningNumbers.filter((n): n is number => n !== null)
  const positive = round.house.total >= 0
  const detailId = `round-history-${round.id}`
  return (
    <div
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
      className={cn(
        "rounded-lg border fill-mode-both motion-safe:animate-in motion-safe:fade-in"
      )}
    >
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={detailId}
        onClick={onToggle}
        title={[
          `${formatMoney(round.linePrice)} por línea`,
          round.closedAtLabel && `cerró ${round.closedAtLabel}`,
        ]
          .filter(Boolean)
          .join(" · ")}
        className="grid w-full grid-cols-[1fr_auto] items-center gap-x-2 gap-y-1.5 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-muted/40 sm:grid-cols-[1fr_auto_1fr]"
      >
        <span className="order-1 min-w-0 truncate text-sm font-semibold">
          R{round.seq} · {round.name}
          {round.status === "open" && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">(en juego)</span>
          )}
        </span>
        <span
          className={cn(
            "order-3 col-span-2 flex flex-wrap items-center justify-center gap-1.5 sm:order-2 sm:col-span-1",
            winning.length === 0 && "max-sm:hidden"
          )}
        >
          {winning.map((n, i) => (
            <span
              key={`${n}-${i}`}
              className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-amber-500 bg-amber-400 px-2 text-sm font-extrabold text-amber-950 tabular-nums"
            >
              <TrophyIcon className="size-3.5" aria-hidden="true" />
              {n}
            </span>
          ))}
        </span>
        <span className="order-2 flex items-center justify-self-end gap-2 sm:order-3">
          {round.played ? (
            <span
              className={cn(
                "flex items-center gap-1 text-sm font-bold tabular-nums",
                positive ? "text-success" : "text-destructive"
              )}
            >
              {positive ? (
                <TrendingUpIcon className="size-3.5" aria-hidden="true" />
              ) : (
                <TrendingDownIcon className="size-3.5" aria-hidden="true" />
              )}
              {signedMoney(round.house.total)}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">No se jugó</span>
          )}
          <ChevronDownIcon
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none",
              expanded && "rotate-180"
            )}
            aria-hidden="true"
          />
        </span>
      </button>

      <div
        id={detailId}
        className={cn(
          "grid transition-[grid-template-rows] duration-200 motion-reduce:transition-none",
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-2 border-t px-2.5 py-2">
            <RoundWinners round={round} />
            {round.played && <RoundSummary round={round} />}
          </div>
        </div>
      </div>
    </div>
  )
}

/** One gifted number as a chip: number, player and its value; gold when it
 *  won (it was paid prize - line price). */
function GiftChip({ gift }: { gift: RoundGift }) {
  return (
    <span
      title={
        gift.won
          ? `Ganó: se pagó ${formatMoney(gift.paid ?? 0)} (premio − ${formatMoney(gift.value)})`
          : `No ganó · valor ${formatMoney(gift.value)}`
      }
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full border pr-2.5 pl-1 text-xs font-medium",
        gift.won
          ? "border-warning/60 bg-amber-100 text-amber-950 dark:bg-warning/15 dark:text-amber-100"
          : "border-destructive/20 bg-destructive/5"
      )}
    >
      <span
        className={cn(
          "flex size-5 items-center justify-center rounded-full text-[11px] font-bold tabular-nums",
          gift.won ? "bg-amber-400 text-amber-950" : "bg-destructive/15 text-destructive"
        )}
      >
        {gift.number}
      </span>
      {gift.playerName}
      {gift.won && <TrophyIcon className="size-3 text-warning" aria-hidden="true" />}
      <strong className="tabular-nums">{formatMoney(gift.value)}</strong>
      {gift.won && gift.paid !== null && (
        <span className="text-success tabular-nums">paga {formatMoney(gift.paid)}</span>
      )}
    </span>
  )
}

function GiftsTab({ rounds }: { rounds: RoundReport[] }) {
  const withGifts = rounds.filter((r) => r.gifts.length > 0)
  if (withGifts.length === 0) {
    return (
      <p className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
        <GiftIcon className="size-4" aria-hidden="true" />
        No hubo números regalados.
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      {withGifts.map((round, i) => {
        const value = round.gifts.reduce((sum, g) => sum + g.value, 0)
        const won = round.gifts.filter((g) => g.won).length
        return (
          <section
            key={round.id}
            style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
            className="flex flex-col gap-1.5 rounded-lg border px-2.5 py-2 fill-mode-both motion-safe:animate-in motion-safe:fade-in"
          >
            <div className="flex items-center justify-between gap-2 text-sm">
              <h3 className="font-semibold">
                R{round.seq} · {round.name}
              </h3>
              <span className="text-xs text-muted-foreground tabular-nums">
                {round.gifts.length} regalado{round.gifts.length === 1 ? "" : "s"} ·{" "}
                <strong className="text-foreground">{formatMoney(value)}</strong>
                {won > 0 && ` · ${won} ganó${won === 1 ? "" : "ron"}`}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {round.gifts.map((g) => (
                <GiftChip key={`${g.playerId}-${g.number}-${g.ticketIndex}`} gift={g} />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

// Rounds of a game session as a small dashboard: totals on top, then a tab
// per view. "Rondas": newest first, each expandable with its winners and
// house result (business rule F). "Regalados": per round, which numbers were
// gifted, to whom, what they cost and whether they won.
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
  const [tab, setTab] = React.useState<"rounds" | "gifts">("rounds")
  const houseTotal = rounds.reduce((sum, r) => sum + r.house.total, 0)
  const played = rounds.filter((r) => r.played).length
  const prizes = rounds.reduce((sum, r) => sum + r.house.prizes, 0)
  const gifts = rounds.flatMap((r) => r.gifts)
  const giftValue = gifts.reduce((sum, g) => sum + g.value, 0)

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => setTab(value === "gifts" ? "gifts" : "rounds")}
      className="gap-0"
    >
      <TabsList className="h-auto gap-1 rounded-none bg-transparent p-0">
        <TabsTrigger value="rounds" className={cn(FOLDER_TAB, "before:bg-primary/85")}>
          <LayersIcon aria-hidden="true" />
          Rondas
        </TabsTrigger>
        <TabsTrigger value="gifts" className={cn(FOLDER_TAB, "before:bg-destructive/75")}>
          <GiftIcon aria-hidden="true" />
          Regalados
          {gifts.length > 0 && (
            <span
              className={cn(
                "rounded-full px-1.5 text-xs font-semibold tabular-nums",
                tab === "gifts"
                  ? "bg-destructive/15 text-destructive"
                  : "bg-white/25 text-white"
              )}
            >
              {gifts.length}
            </span>
          )}
        </TabsTrigger>
      </TabsList>

      <Card className="rounded-tl-none">
        <CardHeader>
          <CardTitle>
            {tab === "rounds" ? "Historial de rondas" : "Historial de números regalados"}
          </CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {rounds.length > 0 && (
            <div className="grid grid-cols-1 gap-2 @sm/main:grid-cols-2 @3xl/main:grid-cols-4">
              <Stat
                tone="neutral"
                icon={<LayersIcon className="size-3.5" aria-hidden="true" />}
                label="Rondas jugadas"
                value={String(played)}
              />
              <Stat
                tone="amber"
                icon={<TrophyIcon className="size-3.5 text-warning" aria-hidden="true" />}
                label="Premios pagados"
                value={formatMoney(prizes)}
              />
              <Stat
                tone="red"
                icon={<GiftIcon className="size-3.5 text-destructive" aria-hidden="true" />}
                label={`Regalados (${gifts.length}) · valor`}
                value={formatMoney(giftValue)}
              />
              <Stat
                tone={houseTotal >= 0 ? "green" : "red"}
                icon={<WalletIcon className="size-3.5" aria-hidden="true" />}
                label="Resultado de la casa"
                value={signedMoney(houseTotal)}
              />
            </div>
          )}

          <TabsContent value="rounds" className="flex flex-col gap-1.5 pt-2">
            {rounds.length === 0 && (
              <p className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                <LayersIcon className="size-4" aria-hidden="true" />
                {emptyText}
              </p>
            )}
            {rounds.map((round, i) => (
              <RoundRow
                key={round.id}
                round={round}
                index={i}
                expanded={expandedId === round.id}
                onToggle={() => setExpandedId(expandedId === round.id ? null : round.id)}
              />
            ))}
          </TabsContent>

          <TabsContent value="gifts" className="pt-2">
            <GiftsTab rounds={rounds} />
          </TabsContent>
        </CardContent>
      </Card>
    </Tabs>
  )
}
