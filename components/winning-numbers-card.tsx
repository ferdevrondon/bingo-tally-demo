"use client"

import * as React from "react"
import Link from "next/link"

import { CloseRoundDialog } from "@/components/close-round-dialog"
import { WinnerCelebration } from "@/components/winner-celebration"
import { WinningNumberBall } from "@/components/winning-number-ball"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { fireConfetti } from "@/lib/confetti"
import { buildAwardSummary, type AwardSummary } from "@/lib/round-draft/award-summary"
import { cn } from "@/lib/utils"
import { useRoundDraft } from "@/lib/round-draft/context"
import { getActivePlayers, getHouseWin, getSlotWinners } from "@/lib/round-draft/selectors"

export function WinningNumbersCard() {
  const { state, readOnly, awardPrize } = useRoundDraft()
  const [isCloseOpen, setIsCloseOpen] = React.useState(false)
  const [awards, setAwards] = React.useState<AwardSummary[]>([])
  const [celebrating, setCelebrating] = React.useState(false)

  // The summaries belong to one round: start over when the next one begins.
  const [awardsRound, setAwardsRound] = React.useState(state.roundsPlayed)
  if (awardsRound !== state.roundsPlayed) {
    setAwardsRound(state.roundsPlayed)
    setAwards([])
    setCelebrating(false)
  }

  if (!state.round) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Números ganadores</CardTitle>
        </CardHeader>
        <CardContent>
          {readOnly ? (
            <p className="text-sm text-muted-foreground">
              Todavía no se eligió la ronda.
            </p>
          ) : (
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
          )}
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

  // Who has won each number so far: the summaries made here first (instant),
  // then what the activity says (survives a refresh and reaches observers).
  const derivedWinners = getSlotWinners(state)
  const slotWinners = state.round.prizes.map((_, i) => {
    const local = awards.find((a) => a.slotIndex === i)
    return local
      ? local.winners.map((w) => ({ name: w.name, amount: w.amount }))
      : (derivedWinners[i] ?? null)
  })

  return (
    <Card className="w-fit  p-4 flex-row self-start bg-gradient-to-br from-primary/25 via-primary/5 to-background dark:from-primary/30 dark:via-background dark:to-background">
      {/* <CardHeader className="flex justify-center items-center" style={{ containerType: "normal" }}>
        <CardTitle className="whitespace-nowrap text-center"> Ronda {state.round.name}</CardTitle>
      </CardHeader> */}
      <CardContent className="flex flex-col gap-4">
       
        <div
          className={cn(
            "flex flex-wrap gap-x-6 gap-y-4 pt-2 justify-center-safe",
            blocked && !readOnly && "pointer-events-none opacity-50"
          )}
        >
          {state.round.prizes.map((prize, i) => (
            <WinningNumberBall
              key={`${state.roundsPlayed}-${i}`}
              slotIndex={i}
              prize={prize}
              value={state.winningNumbers[i] ?? null}
              usedNumbers={usedNumbers}
              readOnly={readOnly}
              winners={slotWinners[i]}
              house={
                state.winningNumbers[i] != null
                  ? getHouseWin(state, state.winningNumbers[i]!, prize)
                  : null
              }
              onSubmit={(number) => {
                // The summary uses the state from before the award. The
                // celebration waits until every winning number is in.
                const summary = buildAwardSummary(state, i, number)
                setAwards((prev) => [...prev.filter((a) => a.slotIndex !== i), summary])
                awardPrize(i, number)
                const filled = state.winningNumbers.filter((n) => n !== null).length + 1
                if (filled >= state.round!.prizes.length) {
                  setCelebrating(true)
                  void fireConfetti()
                }
              }}
            />
          ))}
         
        </div>

        {allSlotsFilled && !readOnly && (
          <Button onClick={() => setIsCloseOpen(true)}>
            Cerrar ronda y comenzar la siguiente
          </Button>
        )}
      </CardContent>
      <WinnerCelebration
        awards={celebrating ? [...awards].sort((a, b) => a.slotIndex - b.slotIndex) : []}
        allSlotsFilled={allSlotsFilled}
        onContinue={() => setCelebrating(false)}
        onCloseRound={() => {
          setCelebrating(false)
          setIsCloseOpen(true)
        }}
      />
      <CloseRoundDialog open={isCloseOpen} onOpenChange={setIsCloseOpen} />
    </Card>
  )
}
