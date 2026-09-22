"use client"

import { AwardIcon, CheckIcon, GiftIcon, XIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export interface GamePlayerRound {
  id: number
  roundName: string
  numbersPlayed: number[]
  cost: number
  recharge: number
  wonPrize: boolean
  prizeAmount?: number
  hadGiftedNumber: boolean
}

function formatAmount(amount: number) {
  return `$${amount.toLocaleString("en-US")}`
}

export function GamePlayerRoundsDialog({
  playerName,
  rounds,
  open,
  onOpenChange,
}: {
  playerName: string
  rounds: GamePlayerRound[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rondas de {playerName}</DialogTitle>
          <DialogDescription>
            Historial de participación en esta jornada.
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[50vh] flex-col gap-3 overflow-y-auto px-6 pb-6">
          {rounds.map((round) => (
            <div key={round.id} className="flex flex-col gap-2 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{round.roundName}</span>
                {round.wonPrize && (
                  <span className="flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                    <AwardIcon className="size-3.5" color="gold" />
                    {formatAmount(round.prizeAmount ?? 0)}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Números jugados:</span>
                {round.numbersPlayed.map((n) => (
                  <Badge key={n} variant="outline" className="px-1.5">
                    {n}
                  </Badge>
                ))}
                {round.hadGiftedNumber && (
                  <span
                    title="Número regalado"
                    className="flex items-center gap-1 text-red-700 dark:text-red-400"
                  >
                    <GiftIcon className="size-3.5" />
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  {round.wonPrize ? (
                    <CheckIcon className="size-3.5 text-green-600" />
                  ) : (
                    <XIcon className="size-3.5 text-muted-foreground" />
                  )}
                  {round.wonPrize ? "Ganador" : "No ganó"}
                </span>
                <span>
                  {round.recharge > 0
                    ? `Recargó ${formatAmount(round.recharge)}`
                    : "Sin recarga"}
                </span>
                <span className="font-medium text-foreground">
                  Pagó {formatAmount(round.cost)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
