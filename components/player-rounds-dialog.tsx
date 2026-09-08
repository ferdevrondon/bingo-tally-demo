"use client"

import { AwardIcon, CheckIcon, XIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { DraftPlayer } from "@/lib/round-draft/types"
import { cn } from "@/lib/utils"

interface PlayerRoundSummary {
  id: number
  roundName: string
  winningNumber: number
  numbersPlayed: number[]
  wasWinner: boolean
  madeRecharge: boolean
  amountPaid: number
}

const mockRounds: PlayerRoundSummary[] = [
  {
    id: 1,
    roundName: "Ronda 1",
    winningNumber: 6,
    numbersPlayed: [1, 6, 9],
    wasWinner: true,
    madeRecharge: false,
    amountPaid: 30,
  },
  {
    id: 2,
    roundName: "Ronda 2",
    winningNumber: 8,
    numbersPlayed: [2, 4, 11],
    wasWinner: false,
    madeRecharge: true,
    amountPaid: 30,
  },
  {
    id: 3,
    roundName: "Ronda 3",
    winningNumber: 3,
    numbersPlayed: [3, 7],
    wasWinner: false,
    madeRecharge: false,
    amountPaid: 20,
  },
]

export function PlayerRoundsDialog({
  player,
  open,
  onOpenChange,
}: {
  player: DraftPlayer
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rondas de {player.name}</DialogTitle>
          <DialogDescription>Historial de participación en rondas anteriores.</DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[50vh] flex-col gap-3 overflow-y-auto px-6 pb-6">
          {mockRounds.map((round) => (
            <div key={round.id} className="flex flex-col gap-2 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{round.roundName}</span>
                <span className="flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                  <AwardIcon className="size-3.5" color="gold" />#{round.winningNumber}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Números jugados:</span>
                {round.numbersPlayed.map((n) => (
                  <Badge key={n} variant="outline" className="px-1.5">
                    {n}
                  </Badge>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  {round.wasWinner ? (
                    <CheckIcon className="size-3.5 text-green-600" />
                  ) : (
                    <XIcon className="size-3.5 text-muted-foreground" />
                  )}
                  {round.wasWinner ? "Ganador" : "No ganó"}
                </span>
                <span>{round.madeRecharge ? "Hizo recarga" : "Sin recarga"}</span>
                <span className={cn("font-medium", "text-foreground")}>
                  Pagó ${round.amountPaid}
                </span>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
