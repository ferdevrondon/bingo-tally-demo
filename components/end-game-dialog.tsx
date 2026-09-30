"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { HouseResultBreakdown } from "@/components/house-result-breakdown"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { GameSessionSummary } from "@/lib/round-draft/game-api"
import { formatMoney } from "@/lib/rounds"
import { useRoundDraft } from "@/lib/round-draft/context"
import { FileChartColumn } from "lucide-react"

function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`
}

export function EndGameDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { state, endGameSession } = useRoundDraft()
  const router = useRouter()
  const [summary, setSummary] = React.useState<GameSessionSummary | null>(null)
  const [isPending, startTransition] = React.useTransition()

  // end_game_session closes the open round when all its winning numbers are
  // in (refunding it when it was never played) and marks the game session
  // ended. Nothing is deleted.
  function handleConfirmEnd() {
    startTransition(async () => {
      const result = await endGameSession()
      if (result) setSummary(result)
    })
  }

  function handleGoHome() {
    router.push("/")
  }

  if (!summary) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Terminar la jornada?</DialogTitle>
            <DialogDescription>
              Si la ronda actual ya tiene todos sus números ganadores, se cierra con su resultado.
              Si todavía no se jugó, se cierra sin resultado y se devuelve lo cobrado por ella.
              Una ronda con números ganadores a medias no deja terminar.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" disabled={isPending} onClick={handleConfirmEnd}>
              Terminar jornada
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open onOpenChange={(next) => !next && handleGoHome()}>
      <DialogContent className={"w-3xl"}>
        <DialogHeader>
          <DialogTitle className={"text-xl"}>
            ¡Felicidades! La jornada de hoy ha terminado.
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-6 p-6 px-6">
          {" "}
          <p> Resumen de jornada </p>
          <div className="px-6">
            <Button
              variant="link"
              className="h-auto p-0"
              nativeButton={false}
              render={<Link href={`/reports/games/${state.gameSessionId}`} />}
            >
              {" "}
              <FileChartColumn />
              Ver reporte de la jornada
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 p-6">
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="text-xs tracking-wide text-muted-foreground uppercase">
              Rondas jugadas
            </div>
            <div className="text-lg font-semibold">{summary.roundsPlayed}</div>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="text-xs tracking-wide text-muted-foreground uppercase">
              Jugadores activos
            </div>
            <div className="text-lg font-semibold">{summary.playersCount}</div>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="text-xs tracking-wide text-muted-foreground uppercase">
              Deben los jugadores
            </div>
            <div className="text-lg font-semibold text-destructive">
              {formatMoney(summary.owedByPlayers)}
            </div>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="text-xs tracking-wide text-muted-foreground uppercase">
              A favor de los jugadores
            </div>
            <div className="text-lg font-semibold text-green-600">
              {formatMoney(summary.owedToPlayers)}
            </div>
          </div>
          <div className="col-span-2 rounded-lg border bg-muted/30 p-3">
            <div className="text-xs tracking-wide text-muted-foreground uppercase">
              Tiempo de la jornada
            </div>
            <div className="text-lg font-semibold">
              {formatDuration(summary.durationMs)}
            </div>
          </div>
          <div className="col-span-2 rounded-lg border bg-muted/30 p-3">
            <div className="mb-2 text-xs tracking-wide text-muted-foreground uppercase">
              Resultado de la casa
            </div>
            <HouseResultBreakdown house={summary.house} />
          </div>
        </div>

        <DialogFooter className="flex-row justify-end gap-2 bg-muted/50 p-3">
          <Button variant="outline" onClick={handleGoHome}>
            Ir al inicio
          </Button>
          <Button onClick={() => router.push(`/games/${state.gameSessionId}/settlement`)}>
            Ir a liquidación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
