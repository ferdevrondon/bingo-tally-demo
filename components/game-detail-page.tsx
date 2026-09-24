"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowLeftIcon,
  CalendarIcon,
  ChevronRightIcon,
  DicesIcon,
  GiftIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { GamePlayerRoundsDialog } from "@/components/game-player-rounds-dialog"
import { games } from "@/components/game-page"

interface GameEntry {
  playerId: number
  playerName: string
  roundId: number
  roundName: string
  numbersPlayed: number[]
  cost: number
  recharge: number
  wonPrize: boolean
  prizeAmount?: number
  hadGiftedNumber: boolean
}

const gameEntries: Record<number, GameEntry[]> = {
  42: [
    { playerId: 1, playerName: "Ana Torres", roundId: 1, roundName: "Ronda 1", numbersPlayed: [1, 6, 9], cost: 30, recharge: 0, wonPrize: false, hadGiftedNumber: false },
    { playerId: 2, playerName: "Luis Gómez", roundId: 1, roundName: "Ronda 1", numbersPlayed: [4, 7, 9], cost: 30, recharge: 20, wonPrize: false, hadGiftedNumber: true },
    { playerId: 3, playerName: "Maria Fernanda", roundId: 2, roundName: "Ronda 2", numbersPlayed: [2, 5], cost: 20, recharge: 0, wonPrize: false, hadGiftedNumber: false },
    { playerId: 4, playerName: "Carlos Ruiz", roundId: 2, roundName: "Ronda 2", numbersPlayed: [3, 8, 12], cost: 30, recharge: 0, wonPrize: true, prizeAmount: 40, hadGiftedNumber: false },
    { playerId: 1, playerName: "Ana Torres", roundId: 3, roundName: "Ronda 3", numbersPlayed: [10, 13], cost: 20, recharge: 50, wonPrize: false, hadGiftedNumber: false },
    { playerId: 2, playerName: "Luis Gómez", roundId: 3, roundName: "Ronda 3", numbersPlayed: [14, 15, 1], cost: 30, recharge: 0, wonPrize: true, prizeAmount: 20, hadGiftedNumber: false },
  ],
  41: [
    { playerId: 5, playerName: "Pedro Sánchez", roundId: 1, roundName: "Ronda 1", numbersPlayed: [2, 5, 11], cost: 30, recharge: 0, wonPrize: true, prizeAmount: 150, hadGiftedNumber: false },
    { playerId: 6, playerName: "Laura Jiménez", roundId: 2, roundName: "Ronda 2", numbersPlayed: [3, 9], cost: 20, recharge: 0, wonPrize: false, hadGiftedNumber: true },
    { playerId: 7, playerName: "Jorge Medina", roundId: 3, roundName: "Ronda 3", numbersPlayed: [1, 4, 7, 10], cost: 40, recharge: 30, wonPrize: true, prizeAmount: 200, hadGiftedNumber: false },
    { playerId: 8, playerName: "Sofía Herrera", roundId: 4, roundName: "Ronda 4", numbersPlayed: [6, 12], cost: 20, recharge: 0, wonPrize: false, hadGiftedNumber: false },
    { playerId: 5, playerName: "Pedro Sánchez", roundId: 5, roundName: "Ronda 5", numbersPlayed: [8, 13, 15], cost: 30, recharge: 20, wonPrize: false, hadGiftedNumber: false },
  ],
  40: [
    { playerId: 9, playerName: "Elena Castro", roundId: 1, roundName: "Ronda 1", numbersPlayed: [1, 2, 3], cost: 30, recharge: 0, wonPrize: false, hadGiftedNumber: false },
    { playerId: 10, playerName: "Ricardo Vega", roundId: 2, roundName: "Ronda 2", numbersPlayed: [5, 9], cost: 20, recharge: 10, wonPrize: false, hadGiftedNumber: false },
    { playerId: 9, playerName: "Elena Castro", roundId: 3, roundName: "Ronda 3", numbersPlayed: [7, 11, 14], cost: 30, recharge: 0, wonPrize: true, prizeAmount: 50, hadGiftedNumber: true },
    { playerId: 11, playerName: "Mónica Díaz", roundId: 4, roundName: "Ronda 4", numbersPlayed: [4, 8], cost: 20, recharge: 0, wonPrize: false, hadGiftedNumber: false },
  ],
}

function formatAmount(amount: number) {
  const sign = amount < 0 ? "-" : ""
  return `${sign}$${Math.abs(amount).toLocaleString("en-US")}`
}

function StatCard({
  label,
  value,
  valueClassName,
  icon,
}: {
  label: string
  value: React.ReactNode
  valueClassName?: string
  icon: React.ReactNode
}) {
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle
          className={cn(
            "text-2xl font-semibold tabular-nums @[250px]/card:text-3xl",
            valueClassName
          )}
        >
          {value}
        </CardTitle>
        <CardAction>
          <Badge variant="outline">{icon}</Badge>
        </CardAction>
      </CardHeader>
    </Card>
  )
}

interface PlayerGameSummary {
  playerId: number
  playerName: string
  entries: GameEntry[]
}

function groupEntriesByPlayer(entries: GameEntry[]): PlayerGameSummary[] {
  const byPlayer = new Map<number, PlayerGameSummary>()
  entries.forEach((entry) => {
    const existing = byPlayer.get(entry.playerId)
    if (existing) {
      existing.entries.push(entry)
    } else {
      byPlayer.set(entry.playerId, {
        playerId: entry.playerId,
        playerName: entry.playerName,
        entries: [entry],
      })
    }
  })
  return [...byPlayer.values()]
}

function playerHandle(name: string) {
  return (
    "@" +
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/\s+/g, "_")
  )
}

function PlayerGameCard({ player }: { player: PlayerGameSummary }) {
  const [isRoundsOpen, setIsRoundsOpen] = React.useState(false)

  const roundsCount = player.entries.length
  const giftedCount = player.entries.filter((entry) => entry.hadGiftedNumber).length
  const saldo = player.entries.reduce(
    (sum, entry) =>
      sum + (entry.wonPrize ? (entry.prizeAmount ?? 0) : 0) - entry.cost - entry.recharge,
    0
  )
  const saldoIsPositive = saldo >= 0

  return (
    <Card className="gap-3 bg-ball/5 px-4 py-3 ring-ball/20 dark:bg-ball/10">
      <div className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-ball/60 text-sm font-bold text-ball">
          {player.playerName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold">{player.playerName}</div>
          <div className="truncate text-xs text-muted-foreground">
            {playerHandle(player.playerName)}
          </div>
        </div>
        <Button
          variant="outline"
          size="icon-sm"
          className="shrink-0 rounded-full"
          onClick={() => setIsRoundsOpen(true)}
          aria-label={`Ver rondas de ${player.playerName}`}
        >
          <ChevronRightIcon />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className="gap-1 border-transparent bg-background/70">
          <DicesIcon className="size-3" />
          {roundsCount} rondas
        </Badge>
        <Badge variant="outline" className="gap-1 border-transparent bg-background/70">
          <GiftIcon className="size-3" />
          {giftedCount} regalado
        </Badge>
        <Badge
          variant="outline"
          className={cn(
            "gap-1",
            saldoIsPositive
              ? "border-green-600/30 bg-green-50 text-green-700 dark:border-green-500/30 dark:bg-green-950 dark:text-green-400"
              : "border-red-600/30 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-950 dark:text-red-400"
          )}
        >
          <WalletIcon className="size-3" />
          {formatAmount(saldo)}
        </Badge>
      </div>

      <GamePlayerRoundsDialog
        playerName={player.playerName}
        rounds={player.entries.map((entry) => ({
          id: entry.roundId,
          roundName: entry.roundName,
          numbersPlayed: entry.numbersPlayed,
          cost: entry.cost,
          recharge: entry.recharge,
          wonPrize: entry.wonPrize,
          prizeAmount: entry.prizeAmount,
          hadGiftedNumber: entry.hadGiftedNumber,
        }))}
        open={isRoundsOpen}
        onOpenChange={setIsRoundsOpen}
      />
    </Card>
  )
}

export function GameDetailPage({ id }: { id: number }) {
  const game = games.find((g) => g.id === id)
  const entries = gameEntries[id] ?? []

  if (!game) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          No se encontró la jornada #{id}.
        </p>
        <Button variant="outline" nativeButton={false} render={<Link href="/reports" />}>
          <ArrowLeftIcon />
          Volver a jornadas
        </Button>
      </div>
    )
  }

  const houseResult = entries.reduce(
    (sum, entry) => sum + entry.cost + entry.recharge - (entry.wonPrize ? (entry.prizeAmount ?? 0) : 0),
    0
  )
  const isPositive = houseResult >= 0
  const playerSummaries = groupEntriesByPlayer(entries)

  return (
    <div className="flex flex-col gap-6 py-4 md:gap-6 md:py-6">
      <div className="flex flex-col gap-2 px-4 lg:px-6">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 w-fit"
          nativeButton={false}
          render={<Link href="/reports" />}
        >
          <ArrowLeftIcon />
          Volver
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">
          Jornada #{String(game.number).padStart(3, "0")}
        </h1>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <CalendarIcon className="size-4" />
          <span>{game.dateLabel}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 px-4 @xl/main:grid-cols-3 lg:px-6">
        <StatCard label="Rondas" value={game.roundsCount} icon={<DicesIcon />} />
        <StatCard label="Jugadores" value={game.playersCount} icon={<UsersIcon />} />
        <StatCard
          label="Ganancia"
          value={formatAmount(houseResult)}
          valueClassName={isPositive ? "text-green-700 dark:text-green-400" : "text-destructive"}
          icon={
            isPositive ? (
              <TrendingUpIcon className="text-green-600 dark:text-green-500" />
            ) : (
              <TrendingDownIcon className="text-destructive" />
            )
          }
        />
      </div>

      <div className="flex flex-col gap-3 px-4 lg:px-6">
        <h2 className="text-sm font-medium text-muted-foreground">Jugadores</h2>
        {playerSummaries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay datos de jugadores para esta jornada.
          </p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
            {playerSummaries.map((player) => (
              <PlayerGameCard key={player.playerId} player={player} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
