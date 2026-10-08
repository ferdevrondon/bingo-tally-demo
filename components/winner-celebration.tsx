"use client"

import { CrownIcon, HouseIcon, TrophyIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { houseWinText, type AwardSummary } from "@/lib/round-draft/award-summary"
import { signedMoney } from "@/lib/round-draft/balance"
import { formatMoney } from "@/lib/rounds"

// Shown when the admin declares winning numbers: who won with which number,
// how much, and the balance before and after. It stays until the admin
// closes it (Continuar), and numbers declared meanwhile pile up in it.
export function WinnerCelebration({
  awards,
  allSlotsFilled,
  onContinue,
  onCloseRound,
}: {
  awards: AwardSummary[]
  allSlotsFilled: boolean
  onContinue: () => void
  onCloseRound: () => void
}) {
  return (
    <Dialog
      open={awards.length > 0}
      onOpenChange={(next, details) => {
        // Only the buttons and Esc close it, never a stray click outside.
        if (!next && details?.reason !== "outside-press") onContinue()
      }}
    >
      <DialogContent className="max-h-[90vh] w-[95%] sm:max-w-4xl">
        <DialogHeader className="items-center text-center">
          <TrophyIcon className="size-10 text-amber-500 motion-safe:animate-bounce" />
          <DialogTitle className="text-3xl">
            {awards.some((a) => a.winners.length > 0) ? "¡Tenemos ganadores!" : "Número declarado"}
          </DialogTitle>
          <DialogDescription>Así queda el pago de cada número ganador.</DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-col gap-5 overflow-y-auto p-6">
          {awards.map((award) => (
            <section
              key={award.slotIndex}
              className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b pb-5 last:border-b-0 last:pb-0"
            >
              <div className="flex shrink-0 flex-col items-center gap-1 pt-3">
                <div className="relative flex size-14 items-center justify-center rounded-full border-2 border-green-500/50 bg-gradient-to-br from-green-300 to-green-600 shadow-inner">
                  <CrownIcon className="absolute -top-4 size-5 fill-green-400 text-green-600" />
                  <div className="flex size-10 items-center justify-center rounded-full bg-white text-lg font-bold text-green-700">
                    {award.number}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Premio {formatMoney(award.prize)}
                </div>
              </div>

              {award.winners.length > 0 && (
                <div className="flex min-w-0 flex-1 flex-wrap gap-3">
                  {award.winners.map((winner, i) => (
                    <div
                      key={winner.playerId}
                      style={{ animationDelay: `${i * 150}ms` }}
                      className="w-44 shrink-0 rounded-2xl border bg-gradient-to-br from-amber-100 to-background p-3 fill-mode-both motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:fade-in motion-safe:duration-500 dark:from-amber-500/15"
                    >
                      <div className="truncate text-base font-bold">{winner.name}</div>
                      <div className="text-xs text-muted-foreground">
                        con el #{award.number}
                        {winner.plays > 1 && ` en ${winner.plays} cartones`}
                        {winner.gifts > 0 &&
                          ` (${winner.gifts} regalo${winner.gifts === 1 ? "" : "s"})`}
                      </div>
                      <div className="mt-1 text-2xl font-bold text-green-600 tabular-nums">
                        gana {formatMoney(winner.amount)}
                      </div>
                      <div className="text-xs tabular-nums">
                        saldo de {signedMoney(winner.balanceBefore)} a{" "}
                        <strong>{signedMoney(winner.balanceAfter)}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {award.house.tickets > 0 && (
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <HouseIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                  {houseWinText(award.house)}
                </p>
              )}
            </section>
          ))}
        </div>

        <DialogFooter className="flex-row justify-end gap-2 bg-muted p-5">
          <Button variant="outline" onClick={onContinue}>
            Continuar
          </Button>
          {allSlotsFilled && (
            <Button onClick={onCloseRound}>Cerrar ronda y comenzar la siguiente</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
