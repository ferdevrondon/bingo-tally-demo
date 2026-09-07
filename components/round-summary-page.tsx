"use client"

import Link from "next/link"
import { ArrowLeftIcon, CheckCircle2Icon, PlayIcon } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useRoundDraft } from "@/lib/round-draft/context"
import { NUMBER_PRICE } from "@/lib/round-draft/types"
import { cn } from "@/lib/utils"

export function RoundSummaryPage() {
  const { state } = useRoundDraft()

  const openCartones = state.cartones
    .map((carton) => ({
      carton,
      openNumbers: carton.numbers.filter((n) => n.playerId === null).map((n) => n.number),
    }))
    .filter((c) => c.openNumbers.length > 0)

  const playerRows = state.players
    .map((player) => {
      const assignments = state.cartones.flatMap((carton) =>
        carton.numbers
          .filter((n) => n.playerId === player.id)
          .map((n) => ({ ...n, cartonIndex: carton.index }))
      )
      const giftCount = assignments.filter((n) => n.isGift).length
      const chargeCount = assignments.length - giftCount
      const roundCharge = chargeCount * NUMBER_PRICE
      const previousBalance = player.positiveBalance - player.negativeBalance
      const totalBalance = previousBalance - roundCharge

      return { player, assignments, giftCount, roundCharge, previousBalance, totalBalance }
    })
    .filter((row) => row.assignments.length > 0)

  function handleConfirm() {
    toast.success("Ronda iniciada")
  }

  return (
    <div className="@container/main flex flex-1 flex-col gap-6 p-4 lg:p-6">
      <div>
        <Link
          href="/cartones"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3.5" />
          Volver a cartones
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Números abiertos</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {openCartones.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2Icon className="size-4 text-green-600" />
              Todos los cartones están completos.
            </div>
          ) : (
            openCartones.map(({ carton, openNumbers }) => (
              <div key={carton.id} className="text-sm">
                <span className="font-medium">Cartón #{carton.index}</span>
                <span className="text-muted-foreground">
                  {" "}
                  — {openNumbers.length} sin asignar: {openNumbers.join(", ")}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Jugadores activos</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {playerRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Todavía no hay números asignados a ningún jugador.
            </p>
          ) : (
            playerRows.map((row) => (
              <div
                key={row.player.id}
                className="flex flex-col gap-2 border-b pb-4 last:border-b-0 last:pb-0"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{row.player.name}</span>
                  <span
                    className={cn(
                      "text-sm font-semibold",
                      row.totalBalance >= 0 ? "text-green-600" : "text-red-600"
                    )}
                  >
                    Saldo total: {row.totalBalance >= 0 ? "+" : "-"}$
                    {Math.abs(row.totalBalance)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {row.assignments.map((a) => (
                    <Badge
                      key={`${a.cartonIndex}-${a.number}`}
                      variant={a.isGift ? "outline" : "secondary"}
                    >
                      #{a.cartonIndex}·{a.number}
                      {a.isGift && " 🎁"}
                    </Badge>
                  ))}
                </div>
                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <span>Regalos: {row.giftCount}</span>
                  <span>Cargo de esta ronda: -${row.roundCharge}</span>
                  <span>
                    Saldo previo: {row.previousBalance >= 0 ? "+" : "-"}$
                    {Math.abs(row.previousBalance)}
                  </span>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end border-t pt-4">
        <Button size="lg" className="gap-2" onClick={handleConfirm}>
          <PlayIcon className="size-4" />
          Confirmar e iniciar ronda
        </Button>
      </div>
    </div>
  )
}
