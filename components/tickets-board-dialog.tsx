"use client"

import { TicketsGrid, TicketsToolbar } from "@/components/tickets-board"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useRoundDraft } from "@/lib/round-draft/context"

/** "Ver cartones" in /active-round: the same tickets board as /new-game
 *  (player select, Cartones/Lista, numbers, gifts and "Agregar cartón"), over
 *  the round in play. A number tapped in "Números disponibles" opens it with
 *  that number ringed where it is still free. */
export function TicketsBoardDialog({
  open,
  onOpenChange,
  highlightNumber = null,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  highlightNumber?: number | null
}) {
  const { state, readOnly } = useRoundDraft()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[95%] sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>
            {state.round
              ? `Cartones · Ronda ${state.round.seq} · ${state.round.name}`
              : "Cartones"}
          </DialogTitle>
          <DialogDescription>
            {highlightNumber !== null
              ? `El ${highlightNumber} está marcado donde sigue libre.`
              : readOnly
                ? "Los cartones de la ronda en curso."
                : "Elige un jugador y toca un número para asignarlo o quitarlo."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-6 overflow-y-auto p-6">
          <TicketsToolbar />
          <TicketsGrid highlightNumber={highlightNumber} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
