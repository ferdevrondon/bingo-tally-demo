"use client"

import { PlayerPlayBox } from "@/components/player-numbers-summary"
import { TicketsGrid, TicketsToolbar } from "@/components/tickets-board"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { balanceLabel } from "@/lib/round-draft/balance"
import { getPlayerColorClass } from "@/lib/round-draft/colors"
import { useRoundDraft } from "@/lib/round-draft/context"
import { getPlayerNumberSummary } from "@/lib/round-draft/selectors"

/** "Ver cartones" in /active-round: the same tickets board as /new-game
 *  (player select, Cartones/Lista, numbers, gifts and "Agregar cartón"), over
 *  the round in play. A number tapped in "Números disponibles" opens it with
 *  that number ringed where it is still free. With a player selected, their
 *  play (numbers, total and balance) shows above the tickets. */
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
  const playerIndex = state.players.findIndex((p) => p.id === state.activePlayerId)
  const player = playerIndex >= 0 ? state.players[playerIndex] : null

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
          {player && (
            <PlayerPlayBox
              playerName={player.name}
              numbers={getPlayerNumberSummary(state, player.id)}
              colorClass={getPlayerColorClass(playerIndex)}
              linePrice={state.round?.linePrice}
              trailing={
                player.balance !== 0 && (
                  <span
                    className={
                      player.balance < 0
                        ? "text-xs font-medium text-destructive"
                        : "text-xs font-medium text-success"
                    }
                  >
                    {balanceLabel(player.balance)}
                  </span>
                )
              }
            />
          )}
          <TicketsGrid highlightNumber={highlightNumber} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
