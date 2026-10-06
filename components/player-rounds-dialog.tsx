"use client"

import * as React from "react"
import {
  ArrowDownUpIcon,
  BanknoteIcon,
  ChevronDownIcon,
  GiftIcon,
  RotateCcwIcon,
  TicketIcon,
  TrophyIcon,
  Undo2Icon,
} from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { fetchPlayerRounds } from "@/lib/game-report/fetch"
import { groupByNumber, type NumberCount } from "@/lib/game-report/group-by-number"
import type { PlayerRoundReport } from "@/lib/game-report/types"
import { formatMoney } from "@/lib/rounds"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

const money = formatMoney

function NumberChips({
  numbers,
  winning,
  tone = "default",
  struck,
}: {
  numbers: NumberCount[]
  /** Plays of a number that were given back (released): shown crossed out. */
  struck?: Map<number, number>
  /** Numbers the player won with: highlighted. */
  winning: Set<number>
  tone?: "default" | "gift"
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {numbers.map(({ number, count, tickets }) => {
        const returned = struck?.get(number) ?? 0
        const gone = returned >= count
        const won = winning.has(number) && !gone
        return (
          <span
            key={number}
            title={tickets.map((t) => `Cartón ${t}`).join(", ")}
            className={cn(
              "inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-sm font-semibold tabular-nums",
              gone && "text-muted-foreground line-through opacity-60",
              won
                ? "bg-amber-400 font-extrabold text-amber-950 shadow-sm ring-1 ring-amber-500"
                : tone === "gift"
                  ? "bg-red-500/10 text-red-700 dark:text-red-400"
                  : "bg-muted text-foreground"
            )}
          >
            {won && <TrophyIcon className="size-3.5" aria-hidden="true" />}
            {number}
            {count > 1 && <span className="text-xs font-medium opacity-70">×{count}</span>}
          </span>
        )
      })}
    </div>
  )
}

// A line of the round: what it is, the numbers involved and what it adds or
// takes from the play, at the right.
function MoneyRow({
  icon,
  label,
  amount,
  detail,
  tone,
  children,
}: {
  icon: React.ReactNode
  label: string
  amount?: string
  /** Small text before the amount, e.g. "5 × $10". */
  detail?: string
  tone?: "red" | "green"
  children?: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-md px-2.5 py-1.5",
        tone === "red" ? "bg-red-500/5" : tone === "green" ? "bg-green-500/10" : "bg-muted/60"
      )}
    >
      {icon}
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {(amount || detail) && (
        <span className="ml-auto flex items-baseline gap-1.5 tabular-nums">
          {detail && <span className="text-xs text-muted-foreground">{detail} =</span>}
          {amount && (
            <span
              className={cn(
                "text-sm font-bold",
                tone === "red" && "text-red-600",
                tone === "green" && "text-green-600"
              )}
            >
              {amount}
            </span>
          )}
        </span>
      )}
    </div>
  )
}

function roundKey(round: PlayerRoundReport): number {
  return round.roundId ?? 0
}

// One row per round (name, winning number, what was played and won); the
// detail opens under it.
function RoundEntry({
  round,
  index,
  expanded,
  onToggle,
}: {
  round: PlayerRoundReport
  index: number
  expanded: boolean
  onToggle: () => void
}) {
  const roundWinning = round.winningNumbers.filter((n): n is number => n !== null)
  const won = new Set(round.wins.map((w) => w.number))
  const allBought = groupByNumber(round.bought)
  const released = groupByNumber(round.released)
  const releasedCount = new Map(released.map((r) => [r.number, r.count]))
  const gifted = groupByNumber(round.gifted)
  const winTotal = round.wins.reduce((total, w) => total + w.prize, 0)
  const hasWon = round.wins.length > 0
  const detailId = `round-detail-${roundKey(round)}`

  return (
    <div
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
      className={cn(
        "rounded-lg border fill-mode-both motion-safe:animate-in motion-safe:fade-in",
        hasWon && "border-amber-400/60 bg-amber-50 dark:bg-amber-500/10"
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={detailId}
        className="flex w-full items-center gap-2 rounded-lg p-2.5 text-left transition-colors hover:bg-muted/50"
      >
        <ChevronDownIcon
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none",
            !expanded && "-rotate-90"
          )}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">
          {round.roundId === null ? round.name : `R${round.seq} · ${round.name}`}
        </span>
        {roundWinning.map((n, i) => (
          <span
            key={`${n}-${i}`}
            title={won.has(n) ? "Número ganador (lo tenía)" : "Número ganador"}
            className={cn(
              "inline-flex shrink-0 items-center gap-0.5 rounded-full border px-2 text-sm font-extrabold tabular-nums",
              won.has(n)
                ? "border-amber-500 bg-amber-400 text-amber-950"
                : "border-amber-400/60 bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"
            )}
          >
            <TrophyIcon className="size-3.5" aria-hidden="true" />
            {n}
          </span>
        ))}
        {round.played > 0 && (
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            Jugó {money(round.played)}
          </span>
        )}
        {winTotal > 0 && (
          <span className="shrink-0 text-sm font-bold text-green-600 tabular-nums">
            +{money(winTotal)}
          </span>
        )}
      </button>

      <div
        id={detailId}
        className={cn(
          "grid transition-[grid-template-rows] duration-200 motion-reduce:transition-none",
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-2 px-3 pb-3">
            {round.purchasedAmount > 0 && (
              <MoneyRow
                icon={<TicketIcon className="size-4 text-muted-foreground" aria-hidden="true" />}
                label="Jugada"
                amount={`+${money(round.purchasedAmount)}`}
                detail={`${round.bought.length} × ${money(round.linePrice)}`}
              >
                <NumberChips numbers={allBought} winning={won} struck={releasedCount} />
              </MoneyRow>
            )}

            {gifted.length > 0 && (
              <MoneyRow
                tone="red"
                icon={<GiftIcon className="size-4 text-red-600" aria-hidden="true" />}
                label="Regalados"
                amount={round.giftedAmount > 0 ? `−${money(round.giftedAmount)}` : undefined}
              >
                <NumberChips numbers={gifted} winning={won} tone="gift" />
              </MoneyRow>
            )}

            {released.length > 0 && (
              <MoneyRow
                icon={<Undo2Icon className="size-4 text-muted-foreground" aria-hidden="true" />}
                label="Devueltos"
                amount={round.releasedAmount > 0 ? `−${money(round.releasedAmount)}` : undefined}
              >
                <NumberChips numbers={released} winning={won} struck={releasedCount} />
              </MoneyRow>
            )}

            {round.keptAmount > 0 && (
              <MoneyRow
                icon={<RotateCcwIcon className="size-4 text-muted-foreground" aria-hidden="true" />}
                label="Mantenidos de la ronda anterior"
                amount={`+${money(round.keptAmount)}`}
                detail={`${round.keptCount} × ${money(round.linePrice)}`}
              >
                <NumberChips
                  numbers={groupByNumber(round.keptNumbers.map((number) => ({ ticketIndex: 0, number })))}
                  winning={won}
                />
              </MoneyRow>
            )}

            {round.otherAmount !== 0 && (
              <MoneyRow
                icon={<RotateCcwIcon className="size-4 text-muted-foreground" aria-hidden="true" />}
                label="Otros ajustes"
                amount={`${round.otherAmount > 0 ? "+" : "−"}${money(Math.abs(round.otherAmount))}`}
              />
            )}

            {round.wins.map((w, i) => (
              <div
                key={`${w.ticketIndex}-${w.number}-${i}`}
                className="flex items-center gap-2 rounded-md border border-green-500/40 bg-green-500/10 px-2.5 py-1.5 text-green-700 dark:text-green-400"
              >
                <TrophyIcon className="size-4 text-amber-500" aria-hidden="true" />
                <span className="text-sm font-extrabold tabular-nums">Ganó {money(w.prize)}</span>
                <span className="text-xs font-semibold">con el #{w.number}</span>
              </div>
            ))}

            <div className="flex items-center justify-between border-t pt-2 text-sm font-bold tabular-nums">
              <span>{round.played < 0 ? "Se le devolvió" : "Total jugado"}</span>
              <span>{money(Math.abs(round.played))}</span>
            </div>

            {round.recharges > 0 && (
              <MoneyRow
                tone="green"
                icon={<BanknoteIcon className="size-4 text-green-600" aria-hidden="true" />}
                label="Recargó (dinero aparte de la jugada)"
                amount={`+${money(round.recharges)}`}
              />
            )}
            {round.payouts > 0 && (
              <MoneyRow
                icon={<BanknoteIcon className="size-4 text-muted-foreground" aria-hidden="true" />}
                label="Se le pagó (dinero aparte de la jugada)"
                amount={`−${money(round.payouts)}`}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// "Ver rondas": what one player did in each round of a game session, read
// when the dialog opens (the live game and the game session report).
export function PlayerRoundsDialog({
  gameSessionId,
  playerId,
  playerName,
  open,
  onOpenChange,
}: {
  gameSessionId: number
  playerId: number
  playerName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [rounds, setRounds] = React.useState<PlayerRoundReport[] | null>(null)
  const [failed, setFailed] = React.useState(false)
  const [order, setOrder] = React.useState<"newest" | "oldest">("newest")
  // Rounds whose detail is open; null until the first read opens the newest.
  const [expanded, setExpanded] = React.useState<Set<number> | null>(null)

  React.useEffect(() => {
    if (!open) return
    let cancelled = false
    fetchPlayerRounds(createClient(), gameSessionId, playerId)
      .then((result) => {
        if (cancelled) return
        setRounds(result)
        setFailed(false)
      })
      .catch((error) => {
        console.error("player rounds read failed", error)
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [open, gameSessionId, playerId])

  const sorted = React.useMemo(
    () =>
      rounds === null
        ? []
        : [...rounds].sort((a, b) => (order === "newest" ? b.seq - a.seq : a.seq - b.seq)),
    [rounds, order]
  )
  const openKeys = expanded ?? new Set(sorted.slice(0, 1).map(roundKey))
  const allOpen = sorted.length > 0 && sorted.every((r) => openKeys.has(roundKey(r)))

  function toggle(key: number) {
    const next = new Set(openKeys)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setExpanded(next)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Rondas de {playerName}</DialogTitle>
          <DialogDescription>Lo que jugó, ganó y recargó en cada ronda de la jornada.</DialogDescription>
        </DialogHeader>

        {sorted.length > 0 && (
          <div className="flex items-center justify-between gap-2 px-6 pt-3">
            <span className="text-xs text-muted-foreground">
              {sorted.length} ronda{sorted.length === 1 ? "" : "s"}
            </span>
            <span className="flex items-center gap-1">
              <Button
                variant="link"
                size="sm"
                onClick={() =>
                  setExpanded(allOpen ? new Set() : new Set(sorted.map(roundKey)))
                }
              >
                {allOpen ? "Contraer todas" : "Expandir todas"}
              </Button>
              <Button
                variant="link"
                size="sm"
                onClick={() => setOrder((o) => (o === "newest" ? "oldest" : "newest"))}
              >
                <ArrowDownUpIcon />
                {order === "newest" ? "Más recientes primero" : "Más antiguas primero"}
              </Button>
            </span>
          </div>
        )}

        <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto px-6 pb-6">
          {failed ? (
            <p className="text-sm text-destructive">No se pudieron leer sus rondas.</p>
          ) : rounds === null ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : rounds.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no jugó en esta jornada.</p>
          ) : (
            sorted.map((round, i) => (
              <RoundEntry
                key={roundKey(round)}
                round={round}
                index={i}
                expanded={openKeys.has(roundKey(round))}
                onToggle={() => toggle(roundKey(round))}
              />
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
