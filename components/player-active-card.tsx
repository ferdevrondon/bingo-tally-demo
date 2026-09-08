"use client"

import * as React from "react"
import { CalculatorIcon, ChevronRightIcon } from "lucide-react"

import { BingoBall } from "@/components/bingo-ball"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { PlayerEditNumbersDialog } from "@/components/player-edit-numbers-dialog"
import { PlayerRechargeDialog } from "@/components/player-recharge-dialog"
import { PlayerRoundsDialog } from "@/components/player-rounds-dialog"
import { useRoundDraft } from "@/lib/round-draft/context"
import { NUMBER_PRICE } from "@/lib/round-draft/types"
import type { DraftPlayer } from "@/lib/round-draft/types"
import { cn } from "@/lib/utils"

export function PlayerActiveCard({
  player,
  className,
}: {
  player: DraftPlayer
  className?: string
}) {
  const { state, removePlayer } = useRoundDraft()
  const [isEditOpen, setIsEditOpen] = React.useState(false)
  const [isRechargeOpen, setIsRechargeOpen] = React.useState(false)
  const [isRoundsOpen, setIsRoundsOpen] = React.useState(false)
  const [isRemoveConfirmOpen, setIsRemoveConfirmOpen] = React.useState(false)

  const netBalance = player.positiveBalance - player.negativeBalance

  const countsByNumber = new Map<number, number>()
  state.cartones.forEach((carton) => {
    carton.numbers.forEach((entry) => {
      if (entry.playerId === player.id) {
        countsByNumber.set(entry.number, (countsByNumber.get(entry.number) ?? 0) + 1)
      }
    })
  })
  const numbers = [...countsByNumber.entries()]
    .map(([number, count]) => ({ number, amount: count * NUMBER_PRICE }))
    .sort((a, b) => a.number - b.number)
  const totalJugada = numbers.reduce((sum, n) => sum + n.amount, 0)

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between">
        <span className="font-heading text-base font-medium">{player.name}</span>
        <span
          className={cn(
            "text-lg font-bold",
            netBalance >= 0 ? "text-green-600" : "text-destructive"
          )}
        >
          {netBalance >= 0 ? "+" : "-"}${Math.abs(netBalance)}
        </span>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {numbers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin números asignados.</p>
        ) : (
          <div className="flex flex-wrap gap-x-4 gap-y-4 pt-2">
            {numbers.map(({ number, amount }) => (
              <BingoBall key={number} number={number} amount={amount} variant="taken" />
            ))}
          </div>
        )}

        <Button variant="outline" onClick={() => setIsEditOpen(true)}>
          Editar jugada
        </Button>

        <Separator />

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Total jugada</span>
          <span className="font-semibold">${totalJugada}</span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Recarga</span>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setIsRechargeOpen(true)}
            title="Recargar saldo"
          >
            <CalculatorIcon />
          </Button>
        </div>

        <button
          type="button"
          onClick={() => setIsRoundsOpen(true)}
          className="flex items-center justify-between text-sm text-muted-foreground hover:text-foreground"
        >
          <span>Ver rondas</span>
          <ChevronRightIcon className="size-4" />
        </button>

        <Button variant="destructive" onClick={() => setIsRemoveConfirmOpen(true)}>
          Retirar jugador
        </Button>
      </CardContent>

      <PlayerEditNumbersDialog player={player} open={isEditOpen} onOpenChange={setIsEditOpen} />
      <PlayerRechargeDialog
        player={player}
        open={isRechargeOpen}
        onOpenChange={setIsRechargeOpen}
      />
      <PlayerRoundsDialog player={player} open={isRoundsOpen} onOpenChange={setIsRoundsOpen} />

      <AlertDialog open={isRemoveConfirmOpen} onOpenChange={setIsRemoveConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Retirar a {player.name} de la ronda?</AlertDialogTitle>
            <AlertDialogDescription>
              Sus números quedarán disponibles de nuevo en los cartones y dejará de aparecer en
              esta ronda.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive/10 text-destructive hover:bg-destructive/20"
              onClick={() => {
                removePlayer(player.id)
                setIsRemoveConfirmOpen(false)
              }}
            >
              Retirar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
