"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

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

export default function MainPage() {
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

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Iniciar jornada</CardTitle>
          <CardDescription>
            Comienza una nueva jornada para registrar la actividad de hoy.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 rounded-2xl bg-muted/40 p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarIcon className="size-4" />
              {dateLabel}
            </div>
            <div className="text-base font-medium">
              Jornada #{String(NEXT_GAME_NUMBER).padStart(3, "0")}
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Inicio</span>
              <span className="text-3xl font-semibold tabular-nums">{timeLabel}</span>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button className="w-full" onClick={() => console.log("iniciar jornada")}>
            Iniciar jornada
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
