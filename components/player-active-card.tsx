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
import { useCheckInToggle } from "@/components/check-in-dialog"
import { balanceLabel, signedMoney } from "@/lib/round-draft/balance"
import { useRoundDraft } from "@/lib/round-draft/context"
import type { DraftPlayer } from "@/lib/round-draft/types"
import { cn } from "@/lib/utils"

export function PlayerActiveCard({
  player,
  className,
}: {
  player: DraftPlayer
  className?: string
}) {
  const { state, readOnly, removePlayer, resolveCarryOver } = useRoundDraft()
  const checkInToggle = useCheckInToggle()
  const linePrice = state.round?.linePrice ?? 0
  const [isEditOpen, setIsEditOpen] = React.useState(false)
  const [isRechargeOpen, setIsRechargeOpen] = React.useState(false)
  const [isRoundsOpen, setIsRoundsOpen] = React.useState(false)
  const [isRemoveConfirmOpen, setIsRemoveConfirmOpen] = React.useState(false)
  const [isReleaseOpen, setIsReleaseOpen] = React.useState(false)

  const balance = player.balance

  const countsByNumber = new Map<number, number>()
  const giftByNumber = new Map<number, boolean>()
  state.tickets.forEach((ticket) => {
    ticket.numbers.forEach((entry) => {
      if (entry.playerId === player.id) {
        countsByNumber.set(
          entry.number,
          (countsByNumber.get(entry.number) ?? 0) + 1
        )
        if (entry.isGift) giftByNumber.set(entry.number, true)
      }
    })
  })
  const numbers = [...countsByNumber.entries()]
    .map(([number, count]) => ({
      number,
      amount: count * linePrice,
      isGift: giftByNumber.get(number) ?? false,
    }))
    .sort((a, b) => a.number - b.number)
  const totalPlayed = numbers.reduce((sum, n) => sum + n.amount, 0)

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between">
        <span className="font-heading text-base font-medium">
          {player.name}
        </span>
        <span
          className={cn(
            "text-lg font-bold",
            balance >= 0 ? "text-green-600" : "text-destructive"
          )}
        >
          {signedMoney(balance)}
        </span>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {numbers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sin números asignados.
          </p>
        ) : (
          <div className="flex flex-wrap gap-x-4 gap-y-4 pt-2">
            {numbers.map(({ number, amount, isGift }) => (
              <BingoBall
                key={number}
                number={number}
                amount={amount}
                variant="taken"
                isGift={isGift}
              />
            ))}
          </div>
        )}

        {!readOnly && (
          <Button variant="outline" onClick={() => setIsEditOpen(true)}>
            Editar jugada
          </Button>
        )}
        {/* After a round closes the player first keeps or releases their numbers;
            the new round's charge (and the check-in) comes after that. */}
        {player.pendingCarryOverDecision ? (
          <p className="rounded-xl border border-dashed px-3 py-2 text-sm text-muted-foreground">
            Decide si mantiene o libera su jugada para la nueva ronda.
          </p>
        ) : (
          <div
            className={cn(
              "flex items-center justify-between rounded-xl border px-3 py-2 text-sm transition-colors",
              player.checkedIn
                ? "border-green-500/40 bg-green-500/10"
                : cn(
                    "border-amber-500/40 bg-amber-500/10",
                    balance < 0 && "animate-pulse"
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
              {balance < 0 && !player.checkedIn && (
                <span className="ml-2 text-xs font-semibold text-destructive">
                  {balanceLabel(balance)}
                </span>
              )}
            </span>
            {!readOnly && (
            <Toggle
              pressed={player.checkedIn}
              onPressedChange={() => checkInToggle.toggle(player)}
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
            )}
          </div>
        )}
        <Separator />

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Total jugada</span>
          <span className="font-semibold">${totalPlayed}</span>
        </div>

        {!readOnly && (
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
        )}

        <button
          type="button"
          onClick={() => setIsRoundsOpen(true)}
          className="flex items-center justify-between text-sm text-muted-foreground hover:text-foreground"
        >
          <span>Ver rondas</span>
          <ChevronRightIcon className="size-4" />
        </button>

        {player.pendingCarryOverDecision && !readOnly && (
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

        {!readOnly && (
          <Button
            variant="destructive"
            onClick={() => setIsRemoveConfirmOpen(true)}
          >
            Retirar jugador
          </Button>
        )}
      </CardContent>

      {checkInToggle.dialog}
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
              ¿Retirar a {player.name} de la jornada?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Sus números quedarán disponibles de nuevo en los cartones, sin
              reembolso. Su saldo se conserva para la liquidación.
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
