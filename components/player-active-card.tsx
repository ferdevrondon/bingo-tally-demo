"use client"

import * as React from "react"
import { CalculatorIcon, CheckIcon, ChevronRightIcon } from "lucide-react"

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
import { Toggle } from "@/components/ui/toggle"
import { PlayerEditNumbersDialog } from "@/components/player-edit-numbers-dialog"
import { PlayerRechargeDialog } from "@/components/player-recharge-dialog"
import { PlayerReleaseNumbersDialog } from "@/components/player-release-numbers-dialog"
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
  const { state, removePlayer, toggleCheckIn, resolveCarryOver } =
    useRoundDraft()
  const [isEditOpen, setIsEditOpen] = React.useState(false)
  const [isRechargeOpen, setIsRechargeOpen] = React.useState(false)
  const [isRoundsOpen, setIsRoundsOpen] = React.useState(false)
  const [isRemoveConfirmOpen, setIsRemoveConfirmOpen] = React.useState(false)
  const [isReleaseOpen, setIsReleaseOpen] = React.useState(false)

  const netBalance = player.positiveBalance - player.negativeBalance

  const countsByNumber = new Map<number, number>()
  state.cartones.forEach((carton) => {
    carton.numbers.forEach((entry) => {
      if (entry.playerId === player.id) {
        countsByNumber.set(
          entry.number,
          (countsByNumber.get(entry.number) ?? 0) + 1
        )
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
        <span className="font-heading text-base font-medium">
          {player.name}
        </span>
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
          <p className="text-sm text-muted-foreground">
            Sin números asignados.
          </p>
        ) : (
          <div className="flex flex-wrap gap-x-4 gap-y-4 pt-2">
            {numbers.map(({ number, amount }) => (
              <BingoBall
                key={number}
                number={number}
                amount={amount}
                variant="taken"
              />
            ))}
          </div>
        )}

        <Button variant="outline" onClick={() => setIsEditOpen(true)}>
          Editar jugada
        </Button>
        <div
          className={cn(
            "flex items-center justify-between rounded-xl border px-3 py-2 text-sm transition-colors",
            player.checkedIn
              ? "border-green-500/40 bg-green-500/10"
              : cn(
                  "border-amber-500/40 bg-amber-500/10",
                  player.negativeBalance > 0 && "animate-pulse"
                )
          )}
        >
          <span
            className={cn(
              "font-medium",
              player.checkedIn
                ? "text-green-700 dark:text-green-400"
                : "text-amber-700 dark:text-amber-400"
            )}
          >
            {player.checkedIn ? "Check-in confirmado" : "Check-in pendiente"}
            {player.negativeBalance > 0 && !player.checkedIn && (
              <span className="ml-2 text-xs font-semibold text-destructive">
                Debe ${player.negativeBalance}
              </span>
            )}
          </span>
          <Toggle
            pressed={player.checkedIn}
            onPressedChange={() => toggleCheckIn(player.id)}
            size="sm"
            aria-label="Check-in"
            className={cn(
              "border transition-all duration-300",
              player.checkedIn
                ? "animate-in zoom-in-50 border-green-600 bg-green-600 text-white hover:bg-green-600/90 aria-pressed:bg-green-600 aria-pressed:text-white"
                : "border-amber-500/50 text-amber-600 hover:bg-amber-500/10 dark:text-amber-400"
            )}
          >
            <CheckIcon />
          </Toggle>
        </div>
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

        {player.pendingCarryOverDecision && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => resolveCarryOver(player.id, [])}
            >
              Mantener jugada
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setIsReleaseOpen(true)}
            >
              Liberar
            </Button>
          </div>
        )}

        <Button
          variant="destructive"
          onClick={() => setIsRemoveConfirmOpen(true)}
        >
          Retirar jugador
        </Button>
      </CardContent>

      <PlayerEditNumbersDialog
        player={player}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
      />
      <PlayerRechargeDialog
        player={player}
        open={isRechargeOpen}
        onOpenChange={setIsRechargeOpen}
      />
      <PlayerRoundsDialog
        player={player}
        open={isRoundsOpen}
        onOpenChange={setIsRoundsOpen}
      />
      <PlayerReleaseNumbersDialog
        player={player}
        open={isReleaseOpen}
        onOpenChange={setIsReleaseOpen}
      />

      <AlertDialog
        open={isRemoveConfirmOpen}
        onOpenChange={setIsRemoveConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Retirar a {player.name} de la ronda?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Sus números quedarán disponibles de nuevo en los cartones y dejará
              de aparecer en esta ronda.
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
