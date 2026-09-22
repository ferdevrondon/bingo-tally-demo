"use client"

import * as React from "react"
import { ArrowRightIcon, CheckIcon, PlayIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

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

function SessionPill({
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

function SessionRow({ session }: { session: Session }) {
  const isActive = session.status === "active"

  return (
    <Card className="flex-row items-center gap-3 rounded-full px-4 py-3">
      <div className="flex min-w-0 items-baseline gap-2">
        <span className="text-base font-bold text-foreground">
          #{String(session.number).padStart(3, "0")}
        </span>
        <span className="truncate text-sm text-muted-foreground">
          {session.dateLabel}
        </span>
      </div>

      <div className="flex flex-1 flex-wrap items-center justify-center gap-1.5">
        <SessionPill isActive={isActive} value={session.gamesCount} label="partidas" />
        <SessionPill isActive={isActive} value={session.playersCount} label="jugadores" />
        <SessionPill isActive={isActive} value={session.cardsCount} label="cartones" />
      </div>

      <div className="flex shrink-0 items-center gap-6">
        <span className="text-base font-bold text-foreground">
          {formatAmount(session.revenue)}
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
          onClick={() => console.log("ver jornada", session.id)}
          aria-label={`Ver jornada #${String(session.number).padStart(3, "0")}`}
        >
          <ArrowRightIcon />
        </Button>
      </div>
    </Card>
  )
}

export default function SessionPage() {
  const activeSession = sessions.find((session) => session.status === "active")
  const previousSessions = sessions.filter(
    (session) => session.status !== "active"
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

          {activeSession && (
            <div className="px-4 lg:px-6">
              <SessionRow session={activeSession} />
            </div>
          )}

          {previousSessions.length > 0 && (
            <div className="flex flex-col gap-4">
              <h2 className="px-4 text-sm font-medium text-muted-foreground lg:px-6">
                Jornadas anteriores
              </h2>
              <div className="flex flex-col gap-3 px-4 lg:px-6">
                {previousSessions.map((session) => (
                  <SessionRow key={session.id} session={session} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
