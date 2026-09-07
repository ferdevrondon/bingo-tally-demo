"use client"

import * as React from "react"
import { ArrowRightIcon, CheckIcon, CircleIcon, PlayIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

// ------------------------------------------------------------------
// Estructura de una jornada (sesión de juego).
// ------------------------------------------------------------------
export interface Session {
  id: number
  number: number
  status: "active" | "finished"
  dateLabel: string
  gamesCount: number
  playersCount: number
  cardsCount: number
  revenue: number
}

const sessions: Session[] = [
  {
    id: 42,
    number: 42,
    status: "active",
    dateLabel: "Hoy · 10:32 PM",
    gamesCount: 3,
    playersCount: 18,
    cardsCount: 54,
    revenue: 540,
  },
  {
    id: 41,
    number: 41,
    status: "finished",
    dateLabel: "4 septiembre · 5:40 PM",
    gamesCount: 8,
    playersCount: 42,
    cardsCount: 126,
    revenue: 1260,
  },
  {
    id: 40,
    number: 40,
    status: "finished",
    dateLabel: "3 septiembre · 6:10 PM",
    gamesCount: 6,
    playersCount: 31,
    cardsCount: 93,
    revenue: 930,
  },
]

function formatAmount(amount: number) {
  return `$${amount.toLocaleString("en-US")}`
}

function SessionStat({ value, label }: { value: number; label: string }) {
  return (
    <span className="text-sm text-muted-foreground">
      <span className="font-medium text-foreground">{value}</span> {label}
    </span>
  )
}

function SessionCard({ session }: { session: Session }) {
  const isActive = session.status === "active"

  return (
    <Card>
      <CardHeader>
        <CardTitle>Jornada #{String(session.number).padStart(3, "0")}</CardTitle>
        <CardDescription>{session.dateLabel}</CardDescription>
        <CardAction>
          <Badge
            variant="outline"
            className={cn(
              isActive &&
                "border-green-600/30 bg-green-50 text-green-700 dark:border-green-500/30 dark:bg-green-950 dark:text-green-400"
            )}
          >
            {isActive ? (
              <CircleIcon className="fill-current" />
            ) : (
              <CheckIcon />
            )}
            {isActive ? "Activa" : "Finalizada"}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
          <SessionStat value={session.gamesCount} label="partidas" />
          <SessionStat value={session.playersCount} label="jugadores" />
          <SessionStat value={session.cardsCount} label="cartones" />
          {isActive && (
            <span className="text-sm font-medium text-foreground">
              {formatAmount(session.revenue)}
            </span>
          )}
        </div>
      </CardContent>
      <CardFooter>
        {!isActive && (
          <span className="text-sm font-medium">
            Resultado: {formatAmount(session.revenue)}
          </span>
        )}
        <Button variant="ghost" size="sm" className="ml-auto">
          Ver jornada
          <ArrowRightIcon />
        </Button>
      </CardFooter>
    </Card>
  )
}

export default function SessionPage() {
  const activeSession = sessions.find((session) => session.status === "active")
  const previousSessions = sessions.filter((session) => session.status !== "active")

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <div className="flex justify-end px-4 lg:px-6">
            <Button onClick={() => console.log("iniciar jornada")}>
              <PlayIcon />
              Iniciar jornada
            </Button>
          </div>

          {activeSession && (
            <div className="px-4 lg:px-6">
              <SessionCard session={activeSession} />
            </div>
          )}

          {previousSessions.length > 0 && (
            <div className="flex flex-col gap-4">
              <h2 className="px-4 text-sm font-medium text-muted-foreground lg:px-6">
                Jornadas anteriores
              </h2>
              <div className="flex flex-col gap-4 px-4 lg:px-6">
                {previousSessions.map((session) => (
                  <SessionCard key={session.id} session={session} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
