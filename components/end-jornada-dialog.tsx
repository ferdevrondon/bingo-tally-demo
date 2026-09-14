"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useRoundDraft } from "@/lib/round-draft/context"
import { getJornadaSummary } from "@/lib/round-draft/selectors"
import { FileChartColumn } from "lucide-react"

function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`
}

export function EndJornadaDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { state, resetDraft } = useRoundDraft()
  const router = useRouter()
  const summary = getJornadaSummary(state)

  function handleNewJornada() {
    resetDraft()
    onOpenChange(false)
    router.push("/")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
              render={<Link href="/reports" />}
            >
              {" "}
              <FileChartColumn />
              Ver reporte del día
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
              Dinero obtenido en casa
            </div>
            <div className="text-lg font-semibold">${summary.houseBalance}</div>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="text-xs tracking-wide text-muted-foreground uppercase">
              Jugadores activos
            </div>
            <div className="text-lg font-semibold">{summary.playersCount}</div>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="text-xs tracking-wide text-muted-foreground uppercase">
              Tiempo de la jornada
            </div>
            <div className="text-lg font-semibold">
              {formatDuration(summary.durationMs)}
            </div>
          </div>
          <div className="col-span-2 rounded-lg border bg-muted/30 p-3">
            <div className="text-xs tracking-wide text-muted-foreground uppercase">
              Saldo negativo total
            </div>
            <div className="text-lg font-semibold text-destructive">
              ${summary.negativeBalanceTotal}
            </div>
          </div>
        </div>

        <DialogFooter className="flex-row justify-end gap-2 bg-muted/50 p-3">
          <Button onClick={handleNewJornada}>Comenzar nueva jornada</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
