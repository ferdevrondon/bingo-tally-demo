"use client"

import React from "react"
import { BadgeDollarSign, Calendar, CirclePower } from "lucide-react"

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
                {mounted && timeZone
                  ? formatHouseDate(state.gameStartedAt, timeZone)
                  : " "}
              </span>
            </div>
          </div>
        </div>

        {!readOnly && (
          <>
            <Button
              variant="destructive"
              className="self-end md:self-auto pointer-coarse:h-10"
              onClick={() => setIsEndGameOpen(true)}
            >
              <CirclePower />
              Terminar jornada
            </Button>
            <EndGameDialog
              open={isEndGameOpen}
              onOpenChange={setIsEndGameOpen}
            />

            {/* "La casa": a tab pinned to the right edge, below the app header.
                Tapping it slides it out to the left and shows the house result. */}
            <button
              type="button"
              // Green with a gold coin; red while open if the house is losing.
              className={cn(
                "fixed top-18 right-0 z-30 flex h-14 items-center gap-2 rounded-l-full py-2 pr-4 pl-3 text-white shadow-md transition-colors duration-300 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-reduce:transition-none lg:top-[calc(var(--header-height)+1rem)]",
                isHouseOpen && state.houseBalance < 0
                  ? "bg-red-500 hover:bg-red-600"
                  : "bg-emerald-500 hover:bg-emerald-600"
              )}
              aria-expanded={isHouseOpen}
              aria-label={
                isHouseOpen
                  ? "Ocultar ganancia de la casa"
                  : "Ver ganancia de la casa"
              }
              title={
                isHouseOpen
                  ? "Ocultar ganancia de la casa"
                  : "Ver ganancia de la casa"
              }
              onClick={() => setIsHouseOpen((open) => !open)}
            >
              <BadgeDollarSign
                aria-hidden="true"
                className={cn(
                  "size-9 shrink-0 transition-[color,rotate] duration-300 motion-reduce:transition-none",
                  "text-yellow-300",
                  isHouseOpen && "rotate-[-12deg]"
                )}
              />
              <span
                className={cn(
                  "grid transition-[grid-template-columns] duration-300 ease-out motion-reduce:transition-none",
                  isHouseOpen ? "grid-cols-[1fr]" : "grid-cols-[0fr]"
                )}
                aria-hidden={!isHouseOpen}
              >
                <span className="overflow-hidden">
                  <span
                    className={cn(
                      "flex flex-col items-start pr-1 whitespace-nowrap transition-opacity duration-300 motion-reduce:transition-none",
                      isHouseOpen ? "opacity-100" : "opacity-0"
                    )}
                  >
                    <span
                      className={cn(
                        "text-2xl leading-tight font-extrabold tabular-nums",
                        "text-white"
                      )}
                    >
                      {signedMoney(state.houseBalance)}
                    </span>
                    <span
                      className={cn(
                        "text-[11px] font-medium",
                        state.houseBalance < 0
                          ? "text-red-950/80"
                          : "text-emerald-950/80"
                      )}
                    >
                      Ganancia de la casa
                    </span>
                  </span>
                </span>
              </span>
            </button>
          </>
        )}
      </div>
    </div>
  )
}
