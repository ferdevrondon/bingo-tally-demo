"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowRightIcon, CheckIcon, PlayIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

export interface Game {
  id: number
  number: number
  status: "active" | "finished"
  dateLabel: string
  roundsCount: number
  playersCount: number
  ticketsCount: number
  revenue: number
}

export const games: Game[] = [
  {
    id: 42,
    number: 42,
    status: "active",
    dateLabel: "Hoy · 10:32 PM",
    roundsCount: 3,
    playersCount: 18,
    ticketsCount: 54,
    revenue: 540,
  },
  {
    id: 41,
    number: 41,
    status: "finished",
    dateLabel: "4 septiembre · 5:40 PM",
    roundsCount: 8,
    playersCount: 42,
    ticketsCount: 126,
    revenue: 1260,
  },
  {
    id: 40,
    number: 40,
    status: "finished",
    dateLabel: "3 septiembre · 6:10 PM",
    roundsCount: 6,
    playersCount: 31,
    ticketsCount: 93,
    revenue: 930,
  },
]

function formatAmount(amount: number) {
  return `$${amount.toLocaleString("en-US")}`
}

function GamePill({
  isActive,
  value,
  label,
}: {
  isActive: boolean
  value: number
  label: string
}) {
  return (
    <Badge
      className={cn(
        "border-transparent h-6",
        isActive
          ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400"
          : "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
      )}
    >
      {value} {label}
    </Badge>
  )
}

function GameRow({ game }: { game: Game }) {
  const isActive = game.status === "active"

  return (
    <Card className="flex-row items-center gap-3 rounded-full px-4 py-3">
      <div className="flex min-w-0 items-baseline gap-2">
        <span className="text-base font-bold text-foreground">
          #{String(game.number).padStart(3, "0")}
        </span>
        <span className="truncate text-sm text-muted-foreground">
          {game.dateLabel}
        </span>
      </div>

      <div className="flex flex-1 flex-wrap items-center justify-center gap-1.5">
        <GamePill isActive={isActive} value={game.roundsCount} label="partidas" />
        <GamePill isActive={isActive} value={game.playersCount} label="jugadores" />
        <GamePill isActive={isActive} value={game.ticketsCount} label="cartones" />
      </div>

      <div className="flex shrink-0 items-center gap-6">
        <span className="text-base font-bold text-foreground">
          {formatAmount(game.revenue)}
        </span>
        {isActive ? (
          <span className="flex items-center gap-1 text-sm font-medium text-green-600 dark:text-green-500">
            <span className="size-2 rounded-full bg-green-600 dark:bg-green-500" />
            Activa
          </span>
        ) : (
          <span className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
            <CheckIcon className="size-3.5" />
            Teminada.
          </span>
        )}
        <Button
          size="icon-sm"
          className="bg-foreground text-background hover:bg-foreground/85"
          aria-label={`Ver jornada #${String(game.number).padStart(3, "0")}`}
          nativeButton={false}
          render={<Link href={`/games/${game.id}`} />}
        >
          <ArrowRightIcon />
        </Button>
      </div>
    </Card>
  )
}

export default function GamePage() {
  const activeGame = games.find((game) => game.status === "active")
  const previousGames = games.filter(
    (game) => game.status !== "active"
  )

  return (
    <div className="@container/main flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <div className="flex justify-end px-4 lg:px-6">
            <Button onClick={() => console.log("iniciar jornada")}>
              <PlayIcon />
              Iniciar jornada
            </Button>
          </div>

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
      </div>
    </div>
  )
}
