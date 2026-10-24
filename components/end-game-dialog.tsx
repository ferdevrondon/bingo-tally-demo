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
import { cn } from "@/lib/utils"
import { useRoundDraft } from "@/lib/round-draft/context"
import { FileChartColumn } from "lucide-react"

function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`
}

/** A compact figure of the game session summary. */
function SummaryStat({
  label,
  value,
  valueClass,
  className,
}: {
  label: string
  value: string
  valueClass?: string
  className?: string
}) {
  return (
    <div className={cn("rounded-lg border bg-muted/30 px-2.5 py-2", className)}>
      <div className="text-[11px] tracking-wide text-muted-foreground uppercase">
        {label}
      </div>
      <div className={cn("text-base font-semibold", valueClass)}>{value}</div>
    </div>
  )
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
              Si la ronda actual ya tiene todos sus números ganadores, se cierra
              con su resultado. Si todavía no se jugó, se cierra sin resultado y
              se devuelve lo cobrado por ella. Una ronda con números ganadores a
              medias no deja terminar.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={handleConfirmEnd}
            >
              Terminar jornada
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open onOpenChange={(next) => !next && handleGoHome()}>
      <DialogContent className="max-h-[90vh] w-[95%] sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className={"text-xl"}>
            ¡Felicidades! La jornada de hoy ha terminado.
          </DialogTitle>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium">Resumen de jornada</p>
            <Button
              variant="link"
              className="h-auto p-0"
              nativeButton={false}
              render={<Link href={`/reports/games/${state.gameSessionId}`} />}
            >
              <FileChartColumn />
              Ver reporte de la jornada
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <SummaryStat
              label="Rondas jugadas"
              value={String(summary.roundsPlayed)}
            />
            <SummaryStat
              label="Jugadores activos"
              value={String(summary.playersCount)}
            />
            <SummaryStat
              label="Deben jugadores"
              value={formatMoney(summary.owedByPlayers)}
              valueClass="text-destructive"
            />
            <SummaryStat
              label="A favor de jugadores"
              value={formatMoney(summary.owedToPlayers)}
              valueClass="text-success"
            />
            <SummaryStat
              label="Tiempo"
              value={formatDuration(summary.durationMs)}
              className="col-span-2 sm:col-span-1"
            />
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="mb-2 text-xs tracking-wide text-muted-foreground uppercase">
              Resultado de la casa
            </div>
            <HouseResultBreakdown
              house={summary.house}
              numbers={summary.numbers}
              className="md:grid md:grid-cols-2 md:items-start"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleGoHome}>
            Ir al inicio
          </Button>
          <Button
            onClick={() =>
              router.push(`/games/${state.gameSessionId}/settlement`)
            }
          >
            Ir a liquidación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
