"use client"

import * as React from "react"
import { PlayIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

const NEXT_GAME_NUMBER = 42

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function useClock() {
  const [now, setNow] = React.useState<Date | null>(null)

  React.useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  return now
}

function getGreeting(now: Date | null) {
  if (!now) return ""
  const hour = now.getHours()
  if (hour < 12) return "Buenos días"
  if (hour < 19) return "Buenas tardes"
  return "Buenas noches"
}

// ------------------------------------------------------------------
// Variante "hero" del main page: en vez de una tarjeta centrada,
// usa todo el lienzo disponible como fondo (grid de puntos + glow
// radial), un reloj gigante como elemento principal y un botón de
// CTA con un halo pulsante, para que la página invite a iniciar
// la jornada en vez de sentirse como un formulario más.
// ------------------------------------------------------------------
export default function MainPageHero() {
  const now = useClock()

  const dateLabel = now
    ? capitalize(
        new Intl.DateTimeFormat("es-ES", {
          weekday: "long",
          day: "numeric",
          month: "long",
        }).format(now)
      )
    : ""

  const timeLabel = now
    ? new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(now)
    : "--:--"

  const [time, period] = timeLabel.split(" ")

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden p-6">
      <div
        className="pointer-events-none absolute inset-0 text-muted-foreground/20"
        style={{
          backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          maskImage:
            "radial-gradient(ellipse at center, black, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at center, black, transparent 75%)",
        }}
      />

      <div className="pointer-events-none absolute top-1/2 left-1/2 size-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-3xl" />

      <div className="relative flex flex-col items-center gap-1 text-center">
        <p className=" text-3xl bolder">
          {getGreeting(now)}, Admin
        </p>
        <p className="text-sm text-muted-foreground">{dateLabel}</p>
      </div>

      <div className="relative mt-6 flex items-end gap-2">
        <span className="bg-linear-to-b from-foreground to-foreground/60 bg-clip-text text-2xl font-semibold tracking-tight text-transparent tabular-nums sm:text-5xl">
          {time}
        </span>
        <span className="mb-2 text-lg font-medium text-muted-foreground sm:mb-3">
          {period}
        </span>
      </div>

      <p className="relative mt-4 text-sm text-muted-foreground">
        Jornada #{String(NEXT_GAME_NUMBER).padStart(3, "0")} · lista para
        comenzar
      </p>

      <div className="relative mt-8 inline-flex">
        {/* <span className="absolute inset-0 motion-safe:animate-ping delay-700 rounded-4xl bg-primary/40" />
        <Button
          size="lg"
          className="relative ease-linear h-14 gap-2 rounded-4xl px-10 text-base shadow-[0_0_45px_-8px_var(--primary)]"
          onClick={() => console.log("iniciar jornada")}
        >
          <PlayIcon className="size-5" />
          Iniciar jornada
        </Button> */}
      </div>

      <p className="relative mt-4 text-xs text-muted-foreground">
        Se registrará la hora de inicio automáticamente.
      </p>

      <div className="relative mt-12 flex items-center gap-2 rounded-4xl border border-border/60 bg-muted/30 px-4 py-2 text-xs text-muted-foreground backdrop-blur">
        <span className="font-medium text-foreground">Última jornada #041</span>
        <span>·</span>
        <span>42 jugadores</span>
        <span>·</span>
        <span>$1,260</span>
        <span>·</span>
        <span className="text-foreground">Finalizada</span>
      </div>
    </div>
  )
}
