"use client"

import * as React from "react"
import Link from "next/link"

import { CloseRoundDialog } from "@/components/close-round-dialog"
import { WinningNumberBall } from "@/components/winning-number-ball"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { useRoundDraft } from "@/lib/round-draft/context"
import { getActivePlayers } from "@/lib/round-draft/selectors"

export function WinningNumbersCard() {
  const { state, awardPrize } = useRoundDraft()
  const [isCloseOpen, setIsCloseOpen] = React.useState(false)

  if (!state.round) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Números ganadores</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Selecciona una ronda en{" "}
            <Button
              variant="link"
              className="h-auto p-0"
              nativeButton={false}
              render={<Link href="/new-game" />}
            >
              Nueva jornada
            </Button>{" "}
            para habilitar los números ganadores.
          </p>
        </CardContent>
      </Card>
    )
  }

  // Winning numbers wait until every player with numbers is in the round
  // (check-in, rule A); a negative balance never blocks.
  const activePlayers = getActivePlayers(state)
  const pendingCheckIn = activePlayers.filter((p) => !p.checkedIn)
  const pendingCarryOver = activePlayers.filter((p) => p.pendingCarryOverDecision)
  const blocked = pendingCheckIn.length > 0 || pendingCarryOver.length > 0
  const usedNumbers = new Set(
    state.winningNumbers.filter((n): n is number => n !== null)
  )
  const allSlotsFilled =
    state.winningNumbers.length > 0 && state.winningNumbers.every((n) => n !== null)

  return (
    <Card className="w-fit  p-4 flex-row self-start bg-gradient-to-br from-primary/25 via-primary/5 to-background dark:from-primary/30 dark:via-background dark:to-background">
      {/* <CardHeader className="flex justify-center items-center" style={{ containerType: "normal" }}>
        <CardTitle className="whitespace-nowrap text-center"> Ronda {state.round.name}</CardTitle>
      </CardHeader> */}
      <CardContent className="flex flex-col gap-4">
       
        <div
          className={cn(
            "flex flex-wrap gap-x-6 gap-y-4 pt-2 justify-center-safe",
            blocked && "pointer-events-none opacity-50"
          )}
        >
          {state.round.prizes.map((prize, i) => (
            <WinningNumberBall
              key={`${state.roundsPlayed}-${i}`}
              slotIndex={i}
              prize={prize}
              value={state.winningNumbers[i] ?? null}
              usedNumbers={usedNumbers}
              onSubmit={(number) => awardPrize(i, number)}
            />
          ))}
         
        </div>

        {allSlotsFilled && (
          <Button onClick={() => setIsCloseOpen(true)}>
            Cerrar ronda y comenzar la siguiente
          </Button>
        )}
      </CardContent>
      <CloseRoundDialog open={isCloseOpen} onOpenChange={setIsCloseOpen} />
    </Card>
  )
}
