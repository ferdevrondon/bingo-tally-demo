"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  ArrowRightIcon,
  FlameIcon,
  PlayIcon,
  TrophyIcon,
  UsersIcon,
  WalletIcon,
  ZapIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

const NEXT_GAME_NUMBER = 42
const READINESS_PERCENT = 86

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

const stats = [
  {
    icon: UsersIcon,
    label: "Jugadores",
    value: "42",
    caption: "+6 vs ayer",
  },
  {
    icon: WalletIcon,
    label: "Bolsa",
    value: "$1,260",
    caption: "acumulada",
  },
  {
    icon: FlameIcon,
    label: "Racha",
    value: "7 días",
    caption: "sin fallas",
  },
  {
    icon: TrophyIcon,
    label: "Cierre récord",
    value: "00:42",
    caption: "tiempo mínimo",
  },
]

// ------------------------------------------------------------------
// Variante "split" del main page: un panel de marca con el reloj en
// vivo a la izquierda (gradiente con los colores del tema activo:
// violeta suave sobre blanco en modo claro, violeta profundo sobre
// negro en modo oscuro), y un panel con el resumen de la jornada y
// el CTA para iniciarla a la derecha.
// ------------------------------------------------------------------
export default function MainPageSplit() {
  const now = useClock()
  const router = useRouter()

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
            <p className="text-3xl font-semibold">{getGreeting(now)}, Admin</p>
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

          {/* <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs text-foreground/60">
              <span>
                Preparación de la jornada #
                {String(NEXT_GAME_NUMBER).padStart(3, "0")}
              </span>
              <span className="font-medium text-foreground">
                {READINESS_PERCENT}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-foreground/10">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${READINESS_PERCENT}%` }}
              />
            </div>
          </div> */}
        </div>

        <p className="relative text-sm text-foreground/50">
          La hora de inicio se registra automáticamente en cuanto arrancas.
        </p>
      </div>

      <div className="flex flex-col justify-center gap-6 bg-background p-8">
        <div className="flex flex-col gap-3">
          <Badge className="w-fit bg-primary/10 text-primary" variant="outline">
            Jornada #{String(NEXT_GAME_NUMBER).padStart(3, "0")}
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight">
            Todo listo para comenzar
          </h1>
          <p className="max-w-md text-sm text-muted-foreground">
            42 jugadores confirmados y la bolsa está cargada. Solo falta tu
            arranque.
          </p>
        </div>

        <Button
          size="lg"
          className="w-fit gap-2 rounded-4xl bg-gradient-to-r from-primary to-chart-5 px-8 text-base text-primary-foreground hover:opacity-90"
          onClick={() => router.push("/new-game")}
        >
          <PlayIcon className="size-5" />
          Iniciar jornada
          <ArrowRightIcon className="size-4" />
        </Button>

        <div className="grid grid-cols-2 gap-4">
          {stats.map((stat) => (
            <Card key={stat.label}>
              <CardContent className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  <stat.icon className="size-3.5" />
                  {stat.label}
                </div>
                <div className="text-2xl font-bold">{stat.value}</div>
                <div className="text-xs text-muted-foreground">
                  {stat.caption}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex items-center justify-between border-t pt-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">
              Última jornada #041
            </span>
            <span>·</span>
            <span>42 jugadores</span>
            <span>·</span>
            <span>$1,260</span>
          </div>
          <Badge variant="outline">Finalizada</Badge>
        </div>
      </div>
    </div>
  )
}
