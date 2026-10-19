"use client"

import Link from "next/link"
import { ArrowRightIcon, CheckIcon, LockIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { GameSessionListItem } from "@/lib/game-report/types"
import { signedMoney } from "@/lib/round-draft/balance"
import { cn } from "@/lib/utils"

function GamePill({
  isActive,
  value,
  label,
}: {
  isActive: boolean
  value: number
  label: [singular: string, plural: string]
}) {
  return (
    <Badge
      className={cn(
        "h-6 border-transparent",
        isActive
          ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400"
          : "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
      )}
    >
      {value} {value === 1 ? label[0] : label[1]}
    </Badge>
  )
}

function SettlementBadge({ game }: { game: GameSessionListItem }) {
  if (!game.settlement) return null
  if (game.settlement.status === "closed") {
    return (
      <Badge variant="secondary" className="gap-1">
        <LockIcon className="size-3" aria-hidden="true" />
        Liquidada
      </Badge>
    )
  }
  return (
    <Badge
      className={cn(
        game.settlement.unresolved > 0
          ? "bg-warning/15 text-warning"
          : "bg-success/15 text-success"
      )}
    >
      {game.settlement.unresolved > 0
        ? `Liquidación · ${game.settlement.unresolved} por resolver`
        : "Liquidación abierta"}
    </Badge>
  )
}

function GameRow({ game }: { game: GameSessionListItem }) {
  const isActive = game.status === "active"

  const status = isActive ? (
    <span className="flex items-center gap-1 text-sm font-medium text-success">
      <span className="size-2 rounded-full bg-green-600 dark:bg-green-500" />
      En curso
    </span>
  ) : (
    <span className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
      <CheckIcon className="size-3.5" />
      Terminada
    </span>
  )

  // Same rows at every width: narrow, the title and result on top and the pills
  // below; wide (@3xl), everything on one line.
  return (
    <Card className="gap-2 rounded-3xl px-4 py-3 @3xl/main:flex-row @3xl/main:items-center @3xl/main:gap-3">
      <div className="flex items-center justify-between gap-3 @3xl/main:contents">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 @3xl/main:order-1">
          <span className="text-base font-bold text-foreground">Jornada #{game.number}</span>
          <span className="truncate text-sm text-muted-foreground">{game.startedAtLabel}</span>
        </div>

        <div className="flex shrink-0 items-center gap-4 @3xl/main:order-3">
          <span
            className={cn(
              "text-base font-bold tabular-nums",
              game.houseTotal >= 0 ? "text-success" : "text-destructive"
            )}
            title="Resultado de la casa"
          >
            {signedMoney(game.houseTotal)}
          </span>
          <div className="hidden @3xl/main:block">{status}</div>
          <Button
            size="icon-sm"
            className="bg-foreground text-background hover:bg-foreground/85"
            aria-label={`Ver reporte de la jornada #${game.number}`}
            nativeButton={false}
            render={<Link href={`/reports/games/${game.id}`} />}
          >
            <ArrowRightIcon />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 @3xl/main:order-2 @3xl/main:flex-1 @3xl/main:justify-center">
        <GamePill isActive={isActive} value={game.roundsPlayed} label={["ronda", "rondas"]} />
        <GamePill isActive={isActive} value={game.playersCount} label={["jugador", "jugadores"]} />
        <GamePill isActive={isActive} value={game.ticketsCount} label={["cartón", "cartones"]} />
        <SettlementBadge game={game} />
        <div className="ml-auto @3xl/main:hidden">{status}</div>
      </div>
    </Card>
  )
}

// Reportes → Jornadas (/reports/games): every game session of the house, newest
// first, each one opening its report (/reports/games/[id]).
export default function GamePage({ games }: { games: GameSessionListItem[] }) {
  const activeGame = games.find((game) => game.status === "active")
  const previousGames = games.filter((game) => game.status !== "active")

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      {games.length === 0 && (
        <p className="mx-4 rounded-xl border border-dashed p-6 text-sm text-muted-foreground lg:mx-6">
          Todavía no hay jornadas. Aparecen aquí desde que se inicia la primera.
        </p>
      )}

      {activeGame && (
        <div className="px-4 lg:px-6">
          <GameRow game={activeGame} />
        </div>
      )}

      {previousGames.length > 0 && (
        <div className="flex flex-col gap-4">
          <h2 className="px-4 text-sm font-medium text-muted-foreground lg:px-6">
            Jornadas anteriores
          </h2>
          <div className="flex flex-col gap-3 px-4 lg:px-6">
            {previousGames.map((game) => (
              <GameRow key={game.id} game={game} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
