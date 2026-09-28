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
import { useRoundDraft } from "@/lib/round-draft/context"
import type { DraftPlayer } from "@/lib/round-draft/types"

function formatBalance(value: number) {
  return `${value >= 0 ? "+" : "-"}$${Math.abs(value)}`
}

// Confirmation before a check-in with debt: the debt is taken as paid, which
// changes the player's balance (record_check_in, with the player's default
// payment method).
function CheckInDialog({
  player,
  onOpenChange,
  onConfirm,
}: {
  player: DraftPlayer | null
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  const debt = player?.negativeBalance ?? 0
  const balanceAfter = player ? player.positiveBalance : 0

  return (
    <Dialog open={player !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Check-in de {player?.name}</DialogTitle>
          <DialogDescription>
            Al confirmar, su deuda de ${debt} se toma como pagada y su saldo queda en{" "}
            {formatBalance(balanceAfter)}.
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

// Toggling check-in: undo when checked in; otherwise check in right away when
// there is no debt, or confirm first.
export function useCheckInToggle() {
  const { checkIn, undoCheckIn } = useRoundDraft()
  const [pendingPlayer, setPendingPlayer] = React.useState<DraftPlayer | null>(null)

  function toggle(player: DraftPlayer) {
    if (player.checkedIn) undoCheckIn(player.id)
    else if (player.negativeBalance > 0) setPendingPlayer(player)
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
