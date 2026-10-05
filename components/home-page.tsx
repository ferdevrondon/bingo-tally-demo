"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowRightIcon,
  CalendarDaysIcon,
  CircleCheckIcon,
  EyeIcon,
  HourglassIcon,
  ZapIcon,
} from "lucide-react"

import { StartGameSessionButton } from "@/components/start-game-session-button"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { HomeData } from "@/lib/data/game-sessions"
import { signedMoney } from "@/lib/round-draft/balance"
import { formatMoney } from "@/lib/rounds"
import { cn } from "@/lib/utils"

function subscribeToClock(onTick: () => void) {
  const id = setInterval(onTick, 1000)
  return () => clearInterval(id)
}

// Whole seconds keep the snapshot stable between ticks; null on the server
// so the first client render matches the server HTML.
function getClockSnapshot() {
  return Math.floor(Date.now() / 1000)
}

function getServerClockSnapshot() {
  return null
}

function useClock() {
  const seconds = React.useSyncExternalStore(
    subscribeToClock,
    getClockSnapshot,
    getServerClockSnapshot
  )
  return React.useMemo(
    () => (seconds === null ? null : new Date(seconds * 1000)),
    [seconds]
  )
}

function getGreeting(now: Date | null) {
  if (!now) return "Hola"
  const hour = now.getHours()
  if (hour < 12) return "Buenos días"
  if (hour < 19) return "Buenas tardes"
  return "Buenas noches"
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`
}

function moneyClass(value: number) {
  return value > 0
    ? "text-green-700 dark:text-green-400"
    : value < 0
      ? "text-destructive"
      : undefined
}

function Greeting({ home }: { home: HomeData }) {
  const now = useClock()
  const date = now
    ? capitalize(
        new Intl.DateTimeFormat("es-ES", {
          weekday: "long",
          day: "numeric",
          month: "long",
        }).format(now)
      )
    : ""
  const time = now
    ? new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(now)
    : "--:--"

  return (
    <div className="relative flex flex-wrap items-end justify-between gap-4 overflow-hidden rounded-2xl border bg-card p-6">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/5 to-transparent" />
      <div className="relative flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">
          {getGreeting(now)}, {home.userName}
        </h1>
        <p className="text-sm text-muted-foreground">
          {home.houseName} ·{" "}
          {home.role === "admin" ? "Administrador" : "Observador"}
        </p>
      </div>
      <div className="relative flex flex-col items-end gap-0.5">
        <span className="text-3xl font-bold tabular-nums">{time}</span>
        <span className="text-xs text-muted-foreground">{date}</span>
      </div>
    </div>
  )
}

function Figure({
  label,
  value,
  className,
}: {
  label: string
  value: React.ReactNode
  className?: string
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("text-xl font-semibold tabular-nums", className)}>
        {value}
      </span>
    </div>
  )
}

function GameCard({ home }: { home: HomeData }) {
  const { game } = home
  const isAdmin = home.role === "admin"
  const ctaClass =
    "w-fit gap-2 rounded-4xl bg-gradient-to-r from-primary to-chart-5 px-6 text-primary-foreground hover:opacity-90"

  if (!game.active) {
    return (
      <Card>
        <CardHeader>
          <CardDescription>Jornada</CardDescription>
          <CardTitle className="text-xl">No hay una jornada en curso</CardTitle>
          <CardAction>
            <Badge variant="outline">Próxima #{game.nextNumber}</Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          {isAdmin ? (
            <StartGameSessionButton className={ctaClass} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Cuando el administrador inicie una jornada la verás aquí.
            </p>
          )}
        </CardContent>
      </Card>
    )
  }

  // The admin picks the round on /new-game; once one is open the game is on
  // /active-round. Observers follow it live there.
  const href = isAdmin && !game.round ? "/new-game" : "/active-round"
  return (
    <Card>
      <CardHeader>
        <CardDescription className="flex items-center gap-1.5">
          <ZapIcon className="size-3.5 text-primary" />
          En curso
        </CardDescription>
        <CardTitle className="text-xl">Jornada #{game.number}</CardTitle>
        <CardAction>
          <Badge variant="outline">
            {game.round
              ? `${game.round.name} · ${formatMoney(game.round.linePrice)}`
              : "Eligiendo ronda"}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-4 @xl/main:grid-cols-4">
          <Figure label="Rondas jugadas" value={game.roundsPlayed} />
          <Figure label="Jugadores" value={game.players} />
          <Figure label="Cartones" value={game.tickets} />
          <Figure
            label="Resultado de la casa"
            value={signedMoney(game.houseBalance)}
            className={moneyClass(game.houseBalance)}
          />
        </div>
        <Button
          size="lg"
          nativeButton={false}
          render={<Link href={href} />}
          className={ctaClass}
        >
          {isAdmin ? null : <EyeIcon className="size-5" />}
          {isAdmin ? "Ir a la jornada" : "Ver en vivo"}
          <ArrowRightIcon className="size-4" />
        </Button>
      </CardContent>
    </Card>
  )
}

function TodayCard({ today }: { today: NonNullable<HomeData["today"]> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Hoy</CardTitle>
        <CardDescription>
          Jornadas que empezaron hoy y la caja del día.
        </CardDescription>
        <CardAction>
          <Badge variant="outline">
            <CalendarDaysIcon />
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <Figure
            label="Resultado de la casa"
            value={signedMoney(today.house)}
            className={moneyClass(today.house)}
          />
          <Figure
            label="Caja neta"
            value={signedMoney(today.netCash)}
            className={moneyClass(today.netCash)}
          />
          <Figure label="Jornadas" value={today.gameSessions} />
          <Figure label="Rondas jugadas" value={today.roundsPlayed} />
        </div>
        <Link
          href="/reports/daily"
          className="flex w-fit items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          Ver diario
          <ArrowRightIcon className="size-3.5" />
        </Link>
      </CardContent>
    </Card>
  )
}

function PendingRow({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-muted"
    >
      <span>{children}</span>
      <ArrowRightIcon className="size-3.5 shrink-0 text-muted-foreground" />
    </Link>
  )
}

function PendingCard({ pending }: { pending: HomeData["pending"] }) {
  const { owe, owed, openSettlements } = pending
  const clear = owe.players === 0 && owed.players === 0 && openSettlements === 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pendientes</CardTitle>
        <CardDescription>Saldos de jugadores y liquidaciones.</CardDescription>
        <CardAction>
          <Badge variant="outline">
            <HourglassIcon />
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {clear ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CircleCheckIcon className="size-4 text-green-600" />
            Todo al día.
          </p>
        ) : (
          <>
            {owe.players > 0 && (
              <PendingRow href="/reports/debts">
                {plural(owe.players, "jugador debe", "jugadores deben")}{" "}
                <span className="font-semibold text-destructive tabular-nums">
                  {formatMoney(owe.total)}
                </span>
              </PendingRow>
            )}
            {owed.players > 0 && (
              <PendingRow href="/reports/debts">
                Se le debe{owed.players === 1 ? "" : "n"}{" "}
                <span className="font-semibold text-green-700 tabular-nums dark:text-green-400">
                  {formatMoney(owed.total)}
                </span>{" "}
                a {plural(owed.players, "jugador", "jugadores")}
              </PendingRow>
            )}
            {openSettlements > 0 && (
              <PendingRow href="/settlement">
                {plural(
                  openSettlements,
                  "liquidación abierta",
                  "liquidaciones abiertas"
                )}
              </PendingRow>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

// Inicio (/), for admins and observers: who and where, the active game
// session (or "Iniciar jornada" for the admin), today and what is pending.
export function HomePage({ home }: { home: HomeData }) {
  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <Greeting home={home} />
      <GameCard home={home} />
      <div className="grid gap-4 @xl/main:grid-cols-2">
        {home.today && <TodayCard today={home.today} />}
        <PendingCard pending={home.pending} />
      </div>
    </div>
  )
}
