"use client"

import * as React from "react"
import { AwardIcon, GiftIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { fetchPlayerRounds } from "@/lib/game-report/fetch"
import type { NumberPosition, PlayerRoundReport } from "@/lib/game-report/types"
import { formatMoney } from "@/lib/rounds"
import { createClient } from "@/lib/supabase/client"

function Positions({ label, positions }: { label: string; positions: NumberPosition[] }) {
  if (positions.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-muted-foreground">{label}:</span>
      {positions.map((p, i) => (
        <Badge key={`${p.ticketIndex}-${p.number}-${i}`} variant="outline" className="px-1.5">
          Cartón {p.ticketIndex} · #{p.number}
        </Badge>
      ))}
    </div>
  )
}

function RoundEntry({ round }: { round: PlayerRoundReport }) {
  const winning = round.winningNumbers.filter((n): n is number => n !== null)
  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">
          {round.roundId === null ? round.name : `Ronda ${round.seq} · ${round.name}`}
        </span>
        <span className="flex gap-1">
          {winning.map((n, i) => (
            <span
              key={`${n}-${i}`}
              className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary"
            >
              <AwardIcon className="size-3.5" aria-hidden="true" />#{n}
            </span>
          ))}
        </span>
      </div>

      <Positions label="Compró" positions={round.bought} />
      {round.gifted.length > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <GiftIcon className="size-3.5" aria-hidden="true" />
          Regalo: {round.gifted.map((p) => `Cartón ${p.ticketIndex} · #${p.number}`).join(", ")}
        </div>
      )}
      {round.keptCount > 0 && (
        <p className="text-xs text-muted-foreground">
          Mantuvo {round.keptCount} número{round.keptCount === 1 ? "" : "s"} de la ronda anterior
        </p>
      )}
      {round.wins.map((w, i) => (
        <p key={`${w.ticketIndex}-${w.number}-${i}`} className="text-sm text-green-600">
          Ganó {formatMoney(w.prize)} con Cartón {w.ticketIndex} · #{w.number}
        </p>
      ))}

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {round.played !== 0 && (
          <span className="font-medium text-foreground">
            {round.played > 0 ? `Jugó ${formatMoney(round.played)}` : `Se le devolvió ${formatMoney(-round.played)}`}
          </span>
        )}
        {round.recharges > 0 && <span>Recargó {formatMoney(round.recharges)}</span>}
        {round.payouts > 0 && <span>Se le pagó {formatMoney(round.payouts)}</span>}
      </div>
    </div>
  )
}

// "Ver rondas": what one player did in each round of a game session, read
// when the dialog opens (the live game and the game session report).
export function PlayerRoundsDialog({
  gameSessionId,
  playerId,
  playerName,
  open,
  onOpenChange,
}: {
  gameSessionId: number
  playerId: number
  playerName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [rounds, setRounds] = React.useState<PlayerRoundReport[] | null>(null)
  const [failed, setFailed] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    let cancelled = false
    fetchPlayerRounds(createClient(), gameSessionId, playerId)
      .then((result) => {
        if (cancelled) return
        setRounds(result)
        setFailed(false)
      })
      .catch((error) => {
        console.error("player rounds read failed", error)
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [open, gameSessionId, playerId])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rondas de {playerName}</DialogTitle>
          <DialogDescription>Lo que jugó, ganó y recargó en cada ronda de la jornada.</DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[50vh] flex-col gap-3 overflow-y-auto px-6 pb-6">
          {failed ? (
            <p className="text-sm text-destructive">No se pudieron leer sus rondas.</p>
          ) : rounds === null ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : rounds.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no jugó en esta jornada.</p>
          ) : (
            rounds.map((round) => <RoundEntry key={round.roundId ?? 0} round={round} />)
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
