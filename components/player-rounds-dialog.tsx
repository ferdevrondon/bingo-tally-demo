"use client"

import * as React from "react"
import { ArrowDownUpIcon, ChevronDownIcon, TrophyIcon } from "lucide-react"

import { useHouse } from "@/components/house-provider"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { formatHouseTime } from "@/lib/game-report/format"
import { fetchPlayerRounds } from "@/lib/game-report/fetch"
import type { PlayerRoundMovement, PlayerRoundReport } from "@/lib/game-report/types"
import { formatMoney } from "@/lib/rounds"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

const money = formatMoney

// A balance: negative when the player owes the house.
function balanceText(value: number): string {
  return value < 0 ? `−${money(-value)}` : money(value)
}

// A movement's effect on the balance, with its sign.
function effectText(value: number): string {
  return value < 0 ? `−${money(-value)}` : `+${money(value)}`
}

function toneOf(value: number): string {
  return value < 0 ? "text-destructive" : value > 0 ? "text-success" : "text-foreground"
}

// What the movement is, in the words the player sees.
function movementLabel(m: PlayerRoundMovement, linePrice: number): string {
  switch (m.type) {
    case "number_purchased":
      return `Jugada · #${m.number}`
    case "number_reassigned":
      return m.effect < 0 ? `Jugada · #${m.number}` : `Liberó #${m.number}`
    case "carryover_kept": {
      const count = linePrice > 0 ? Math.round(-m.effect / linePrice) : 0
      return `Mantuvo ${count} número${count === 1 ? "" : "s"} de la ronda anterior`
    }
    case "number_gifted":
      return `Regaló #${m.number}`
    case "number_ungifted":
      return `Quitó el regalo #${m.number}`
    case "number_released":
      return `Liberó #${m.number}`
    case "recharge":
      return "Recarga"
    case "prize_won":
      return `Premio · #${m.number}`
    case "payout":
      return "Pago"
    case "balance_transfer":
      return m.counterpartyName
        ? `${m.effect < 0 ? "Transferencia a" : "Transferencia de"} ${m.counterpartyName}`
        : "Transferencia"
    case "adjustment":
      return "Ajuste por ronda sin jugar"
    default:
      return m.type
  }
}

// One movement: what it was, the time, what it moved the balance by, and the
// balance right after it, so each line reads from the one above.
function MovementLine({
  movement,
  linePrice,
  timeZone,
}: {
  movement: PlayerRoundMovement
  linePrice: number
  timeZone: string
}) {
  const isPrize = movement.type === "prize_won"
  return (
    <li
      className={cn(
        "grid grid-cols-[1fr_auto] items-center gap-x-3 rounded-md px-2.5 py-1.5",
        isPrize ? "bg-success/10" : "bg-muted/50"
      )}
    >
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          {isPrize && <TrophyIcon className="size-3.5 text-warning" aria-hidden="true" />}
          <span className="truncate">{movementLabel(movement, linePrice)}</span>
        </p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {formatHouseTime(movement.createdAt, timeZone)}
        </p>
      </div>
      <div className="text-right tabular-nums">
        <p className={cn("text-sm font-bold", toneOf(movement.effect))}>{effectText(movement.effect)}</p>
        <p className="text-xs text-muted-foreground">saldo {balanceText(movement.balanceAfter)}</p>
      </div>
    </li>
  )
}

function roundKey(round: PlayerRoundReport): number {
  return round.roundId ?? 0
}

// One row per round (name, winning numbers, where the balance closed); the
// movements open under it, from the balance it entered with to the one it
// closed with.
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
  const house = useHouse()
  const timeZone = house?.timezone ?? "UTC"
  const roundWinning = round.winningNumbers.filter((n): n is number => n !== null)
  const won = new Set(round.wins.map((w) => w.number))
  const hasWon = round.wins.length > 0
  const detailId = `round-detail-${roundKey(round)}`
  const closeLabel = round.open ? "Saldo hasta ahora" : "Cerró con"

  return (
    <div
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
      className={cn(
        "rounded-lg border fill-mode-both motion-safe:animate-in motion-safe:fade-in",
        hasWon && "border-warning/60 bg-amber-50 dark:bg-warning/10"
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
                : "border-warning/60 bg-amber-100 text-warning dark:bg-warning/15"
            )}
          >
            <TrophyIcon className="size-3.5" aria-hidden="true" />
            {n}
          </span>
        ))}
        <span className="shrink-0 text-xs text-muted-foreground">{closeLabel}</span>
        <span className={cn("shrink-0 text-sm font-bold tabular-nums", toneOf(round.exitBalance))}>
          {balanceText(round.exitBalance)}
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
          <div className="flex flex-col gap-2 px-3 pb-3">
            <div className="flex items-center justify-between rounded-md border px-2.5 py-1.5 text-sm">
              <span className="text-muted-foreground">Saldo al entrar</span>
              <span className={cn("font-bold tabular-nums", toneOf(round.enteredBalance))}>
                {balanceText(round.enteredBalance)}
              </span>
            </div>

            {round.movements.length > 0 ? (
              <ol className="flex flex-col gap-1.5">
                {round.movements.map((m) => (
                  <MovementLine
                    key={m.id}
                    movement={m}
                    linePrice={round.linePrice}
                    timeZone={timeZone}
                  />
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">Sin movimientos de dinero.</p>
            )}

            <div className="flex items-center justify-between border-t pt-2 text-sm font-bold tabular-nums">
              <span>{round.open ? "Saldo hasta ahora (ronda en curso)" : "Saldo al cerrar"}</span>
              <span className={toneOf(round.exitBalance)}>{balanceText(round.exitBalance)}</span>
            </div>
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
          <DialogDescription>
            Cada ronda empieza con el saldo con el que entró y termina con el que cerró. Negativo = debe a la casa.
          </DialogDescription>
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
