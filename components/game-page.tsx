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
          ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
          : "bg-green-500/15 text-green-700 dark:text-green-400"
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

  return (
    <Card className="flex-row flex-wrap items-center gap-3 rounded-3xl px-4 py-3">
      <div className="flex min-w-0 items-baseline gap-2">
        <span className="text-base font-bold text-foreground">Jornada #{game.number}</span>
        <span className="truncate text-sm text-muted-foreground">{game.startedAtLabel}</span>
      </div>

      <div className="flex flex-1 flex-wrap items-center justify-center gap-1.5">
        <GamePill isActive={isActive} value={game.roundsPlayed} label={["ronda", "rondas"]} />
        <GamePill isActive={isActive} value={game.playersCount} label={["jugador", "jugadores"]} />
        <GamePill isActive={isActive} value={game.ticketsCount} label={["cartón", "cartones"]} />
        <SettlementBadge game={game} />
      </div>

      <div className="flex shrink-0 items-center gap-4">
        <span
          className={cn(
            "text-base font-bold tabular-nums",
            game.houseTotal >= 0 ? "text-green-600" : "text-destructive"
          )}
          title="Resultado de la casa"
        >
          {signedMoney(game.houseTotal)}
        </span>
        {isActive ? (
          <span className="flex items-center gap-1 text-sm font-medium text-green-600 dark:text-green-500">
            <span className="size-2 rounded-full bg-green-600 dark:bg-green-500" />
            En curso
          </span>
        ) : (
          <span className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
            <CheckIcon className="size-3.5" />
            Terminada
          </span>
        )}
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
