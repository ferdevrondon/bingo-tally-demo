"use client"

import React from "react"
import { Calendar, CirclePower } from "lucide-react"

import { useHouse } from "@/components/house-provider"
import { Button } from "@/components/ui/button"
import { useNow } from "@/hooks/use-now"
import { formatHouseDate } from "@/lib/game-report/format"
import { useRoundDraft } from "@/lib/round-draft/context"
import { EndGameDialog } from "./end-game-dialog"

export default function PageHeadingWithActions() {
  const { state, readOnly } = useRoundDraft()
  const timeZone = useHouse()?.timezone
  // The date is formatted on the client only, so the server HTML can't differ.
  const mounted = useNow() !== null
  const [isEndGameOpen, setIsEndGameOpen] = React.useState(false)
  return (
    <div className="container mx-auto px-4 py-4 md:px-6 2xl:max-w-[1400px]">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl">
            Jornada #{state.gameNumber}
          </h1>
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
          <div className="flex justify-end">
            <Button variant="destructive" onClick={() => setIsEndGameOpen(true)}>
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
