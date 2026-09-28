"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { balanceLabel } from "@/lib/round-draft/balance"
import { useRoundDraft } from "@/lib/round-draft/context"
import type { DraftPlayer } from "@/lib/round-draft/types"

// Check-in only confirms the player is in this round (business rule A): it
// moves no money and never blocks a negative balance. A player who owes gets
// a confirmation first, as a reminder of the debt.
function CheckInDialog({
  player,
  onOpenChange,
  onConfirm,
}: {
  player: DraftPlayer | null
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  return (
    <Dialog open={player !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Check-in de {player?.name}</DialogTitle>
          <DialogDescription>
            {player?.name} {balanceLabel(player?.balance ?? 0).toLowerCase()}. El check-in
            confirma que está en esta ronda; su saldo no cambia.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-row justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onConfirm}>Confirmar check-in</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Toggling check-in: undo when checked in; otherwise check in right away, or
// confirm first when the player owes.
export function useCheckInToggle() {
  const { checkIn, undoCheckIn } = useRoundDraft()
  const [pendingPlayer, setPendingPlayer] = React.useState<DraftPlayer | null>(null)

  function toggle(player: DraftPlayer) {
    if (player.checkedIn) undoCheckIn(player.id)
    else if (player.balance < 0) setPendingPlayer(player)
    else checkIn(player.id)
  }

  const dialog = (
    <CheckInDialog
      player={pendingPlayer}
      onOpenChange={(open) => {
        if (!open) setPendingPlayer(null)
      }}
      onConfirm={() => {
        if (pendingPlayer) checkIn(pendingPlayer.id)
        setPendingPlayer(null)
      }}
    />
  )

  return { toggle, dialog }
}
