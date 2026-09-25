"use client"

import { AwardIcon, DoorClosedIcon, FlagIcon } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { formatRelativeTime } from "@/lib/format-relative-time"
import { getPlayerColorClass } from "@/lib/round-draft/colors"
import { useRoundDraft } from "@/lib/round-draft/context"
import { ACTIVITY_LABELS, describeActivity } from "@/lib/round-draft/activity-text"
import { getRecentActivity } from "@/lib/round-draft/selectors"
import type { ActivityEntry } from "@/lib/round-draft/types"

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

function ActivityLogRow({
  entry,
  playerName,
  description,
  colorClass,
}: {
  entry: ActivityEntry
  playerName: string | null
  description: string
  colorClass: string
}) {
  return (
    <div className="flex items-start gap-3">
      <Avatar size="sm" className={entry.playerId === null ? "bg-muted" : undefined}>
        {entry.playerId !== null && playerName ? (
          <AvatarFallback className={`${colorClass} text-white`}>
            {initials(playerName)}
          </AvatarFallback>
        ) : (
          <AvatarFallback>
            {entry.type === "game_session_ended" || entry.type === "round_closed" ? (
              <DoorClosedIcon className="size-3" />
            ) : entry.type === "prize_won" ? (
              <AwardIcon className="size-3" />
            ) : (
              <FlagIcon className="size-3" />
            )}
          </AvatarFallback>
        )}
      </Avatar>
      <div className="flex flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{ACTIVITY_LABELS[entry.type]}</Badge>
          <span className="text-sm">{description}</span>
        </div>
      </div>
      <Tooltip>
        <TooltipTrigger className="shrink-0 text-xs text-muted-foreground">
          {formatRelativeTime(entry.timestamp)}
        </TooltipTrigger>
        <TooltipContent>{new Date(entry.timestamp).toLocaleString("es")}</TooltipContent>
      </Tooltip>
    </div>
  )
}

export function ActivityLogCard() {
  const { state } = useRoundDraft()
  const entries = getRecentActivity(state)
  const playerIndexById = new Map(state.players.map((p, i) => [p.id, i]))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Actividad reciente</CardTitle>
      </CardHeader>
      <CardContent className="flex max-h-[420px] flex-col gap-4 overflow-y-auto">
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay actividad en esta jornada.</p>
        ) : (
          entries.map((entry) => (
            <ActivityLogRow
              key={entry.id}
              entry={entry}
              playerName={state.players.find((p) => p.id === entry.playerId)?.name ?? null}
              description={describeActivity(entry, state)}
              colorClass={getPlayerColorClass(
                entry.playerId !== null ? (playerIndexById.get(entry.playerId) ?? -1) : -1
              )}
            />
          ))
        )}
      </CardContent>
    </Card>
  )
}
