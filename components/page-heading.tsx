"use client"

import React from "react"
import { Calendar, CirclePower } from "lucide-react"

import { HouseCashIcon } from "@/components/house-hand-icon"
import { useHouse } from "@/components/house-provider"
import { Button } from "@/components/ui/button"
import { useNow } from "@/hooks/use-now"
import { formatHouseDate } from "@/lib/game-report/format"
import { signedMoney } from "@/lib/round-draft/balance"
import { useRoundDraft } from "@/lib/round-draft/context"
import { cn } from "@/lib/utils"
import { EndGameDialog } from "./end-game-dialog"

export default function PageHeadingWithActions() {
  const { state, readOnly } = useRoundDraft()
  const timeZone = useHouse()?.timezone
  // The date is formatted on the client only, so the server HTML can't differ.
  const mounted = useNow() !== null
  const [isEndGameOpen, setIsEndGameOpen] = React.useState(false)
  // "La casa": the house result so far, hidden until asked for (players may
  // be looking at the screen).
  const [isHouseOpen, setIsHouseOpen] = React.useState(false)
  const housePanelId = React.useId()
  return (
    <div className="container mx-auto px-4 py-4 md:px-6 2xl:max-w-[1400px]">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="scroll-m-20 text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
            Jornada #{state.gameNumber}
          </h2>
          <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span className="first-letter:uppercase">
                {mounted && timeZone ? formatHouseDate(state.gameStartedAt, timeZone) : " "}
              </span>
            </div>
          </div>
        </div>

        {!readOnly && (
          // The house on top (it opens to show the house result), the amount
          // between it and "Terminar jornada" below.
          <div className="flex flex-col items-center gap-2 self-end md:self-auto">
            <Button
              variant="ghost"
              className={cn(
                "size-[72px] p-1 hover:bg-primary/5",
                isHouseOpen ? "text-success" : "text-primary"
              )}
              aria-expanded={isHouseOpen}
              aria-controls={housePanelId}
              aria-label={isHouseOpen ? "Ocultar ganancia de la casa" : "Ver ganancia de la casa"}
              title={isHouseOpen ? "Ocultar ganancia de la casa" : "Ver ganancia de la casa"}
              onClick={() => setIsHouseOpen((open) => !open)}
            >
              <HouseCashIcon open={isHouseOpen} className="size-16" />
            </Button>
            <div
              id={housePanelId}
              className={cn(
                "grid w-full transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none",
                isHouseOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              )}
              aria-hidden={!isHouseOpen}
            >
              <div className="overflow-hidden">
                <div className="flex flex-col items-center gap-0.5 pb-1">
                  <span
                    className={cn(
                      "text-3xl font-extrabold tabular-nums",
                      state.houseBalance >= 0 ? "text-success" : "text-destructive"
                    )}
                  >
                    {signedMoney(state.houseBalance)}
                  </span>
                  <span className="text-xs text-muted-foreground">Ganancia de la casa</span>
                </div>
              </div>
            </div>
            <Button
              variant="destructive"
              className="w-full pointer-coarse:h-10"
              onClick={() => setIsEndGameOpen(true)}
            >
              <CirclePower />
              Terminar jornada
            </Button>
            <EndGameDialog open={isEndGameOpen} onOpenChange={setIsEndGameOpen} />
          </div>
        )}
      </div>
    </div>
  )
}
