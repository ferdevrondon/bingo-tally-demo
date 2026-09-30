"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowRightIcon,
  EyeIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  UsersIcon,
  ZapIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useRole } from "@/components/house-provider"
import { StartGameSessionButton } from "@/components/start-game-session-button"
import type { HomeSummary } from "@/lib/data/game-sessions"
import { signedMoney } from "@/lib/round-draft/balance"

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

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
  return React.useMemo(() => (seconds === null ? null : new Date(seconds * 1000)), [seconds])
}

function getGreeting(now: Date | null) {
  if (!now) return ""
  const hour = now.getHours()
  if (hour < 12) return "Buenos días"
  if (hour < 19) return "Buenas tardes"
  return "Buenas noches"
}

// ------------------------------------------------------------------
// Variante "split" del main page: un panel de marca con el reloj en
// vivo a la izquierda (gradiente con los colores del tema activo:
// violeta suave sobre blanco en modo claro, violeta profundo sobre
// negro en modo oscuro), y un panel con el resumen de la jornada y
// el CTA para iniciarla a la derecha.
// ------------------------------------------------------------------
export default function MainPageSplit({
  summary,
}: {
  summary: HomeSummary
}) {
  const { gameNumber, hasActiveGameSession, lastEnded, pendingPlayers } = summary
  const now = useClock()
  const isAdmin = useRole() === "admin"

  const dateLabel = now
    ? capitalize(
        new Intl.DateTimeFormat("es-ES", {
          weekday: "long",
          day: "numeric",
          month: "long",
        }).format(now)
      )
    : ""

  const hourMinute = now
    ? new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(now)
    : "--:--"

  const [time, period] = hourMinute.split(" ")
  const seconds = now ? String(now.getSeconds()).padStart(2, "0") : "--"

  return (
    <div className="grid flex-1 grid-cols-1 lg:grid-cols-2">
      <div className="relative flex flex-col justify-between overflow-hidden bg-background p-8 text-foreground">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/25 via-primary/5 to-background dark:from-primary/30 dark:via-background dark:to-background" />
        <div className="pointer-events-none absolute -top-24 -left-24 size-96 rounded-full bg-primary/20 blur-3xl dark:bg-primary/30" />

        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-xl bg-foreground/10">
              <ZapIcon className="size-4" />
            </div>
            <span className="text-sm font-medium">Jornada Live</span>
          </div>
          {/* <Badge
            variant="outline"
            className="border-foreground/10 bg-foreground/10 text-foreground"
          >
            <span className="size-1.5 rounded-full bg-teal-400" />
            Sistema en línea
          </Badge> */}
        </div>

        <div className="relative flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <p className="text-xs font-medium tracking-widest text-foreground/50 uppercase">
              {dateLabel}
            </p>
            <p className="text-3xl font-semibold">{getGreeting(now)}, {isAdmin ? "Admin" : "Observador"}</p>
          </div>

          <div className="flex items-end gap-2">
            <span className="text-7xl font-bold tabular-nums">{time}</span>
            <span className="mb-1 text-3xl font-medium text-foreground/40 tabular-nums">
              {seconds}
            </span>
            <span className="mb-2 text-sm font-medium text-foreground/50">
              {period}
            </span>
          </div>

        </div>

        <p className="relative text-sm text-foreground/50">
          La hora de inicio se registra automáticamente en cuanto arrancas.
        </p>
      </div>

      <div className="flex flex-col justify-center gap-6 bg-background p-8">
        <div className="flex flex-col gap-3">
          <Badge className="w-fit bg-primary/10 text-primary" variant="outline">
            Jornada #{gameNumber}
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight">
            {hasActiveGameSession ? "Jornada en curso" : "Todo listo para comenzar"}
          </h1>
          <p className="max-w-md text-sm text-muted-foreground">
            {pendingPlayers === 0
              ? "Nadie tiene saldos pendientes de jornadas anteriores."
              : `${pendingPlayers} jugador${pendingPlayers === 1 ? "" : "es"} con saldo pendiente de jornadas anteriores.`}
          </p>
        </div>

        {/* An observer follows the active game session instead of starting one. */}
        {isAdmin ? (
          <StartGameSessionButton className="rounded-4xl bg-gradient-to-r from-primary to-chart-5 px-8 text-base text-primary-foreground hover:opacity-90" />
        ) : hasActiveGameSession ? (
          <Button
            size="lg"
            nativeButton={false}
            render={<Link href="/active-round" />}
            className="w-fit gap-2 rounded-4xl bg-gradient-to-r from-primary to-chart-5 px-8 text-base text-primary-foreground hover:opacity-90"
          >
            <EyeIcon className="size-5" />
            Ver jornada en vivo
            <ArrowRightIcon className="size-4" />
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">No hay una jornada activa.</p>
        )}

        {lastEnded && (
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  <UsersIcon className="size-3.5" />
                  Jugadores
                </div>
                <div className="text-2xl font-bold">{lastEnded.playersCount}</div>
                <div className="text-xs text-muted-foreground">en la última jornada</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {lastEnded.houseTotal >= 0 ? (
                    <TrendingUpIcon className="size-3.5" />
                  ) : (
                    <TrendingDownIcon className="size-3.5" />
                  )}
                  Resultado de la casa
                </div>
                <div
                  className={
                    lastEnded.houseTotal >= 0
                      ? "text-2xl font-bold text-green-600"
                      : "text-2xl font-bold text-destructive"
                  }
                >
                  {signedMoney(lastEnded.houseTotal)}
                </div>
                <div className="text-xs text-muted-foreground">en la última jornada</div>
              </CardContent>
            </Card>
          </div>
        )}

        {lastEnded && (
          <Link
            href={`/reports/games/${lastEnded.id}`}
            className="flex flex-wrap items-center justify-between gap-2 border-t pt-4 text-sm text-muted-foreground hover:text-foreground"
          >
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-foreground">
                Última jornada #{lastEnded.number}
              </span>
              <span>·</span>
              <span>{lastEnded.startedAtLabel}</span>
            </span>
            <Badge variant="outline">Ver reporte</Badge>
          </Link>
        )}
      </div>
    </div>
  )
}
