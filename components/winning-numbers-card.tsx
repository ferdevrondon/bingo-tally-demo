"use client"

import Link from "next/link"

import { WinningNumberBall } from "@/components/winning-number-ball"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { useRoundDraft } from "@/lib/round-draft/context"
import { getActivePlayers } from "@/lib/round-draft/selectors"

export function WinningNumbersCard() {
  const { state, awardPrize } = useRoundDraft()

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
              render={<Link href="/nueva-jornada" />}
            >
              Nueva jornada
            </Button>{" "}
            para habilitar los números ganadores.
          </p>
        </CardContent>
      </Card>
    )
  }

  const activePlayers = getActivePlayers(state)
  const pendingCheckIn = activePlayers.filter((p) => !p.checkedIn)
  const withNegativeBalance = activePlayers.filter((p) => p.negativeBalance > 0)
  const blocked = pendingCheckIn.length > 0 || withNegativeBalance.length > 0
  const usedNumbers = new Set(
    state.winningNumbers.filter((n): n is number => n !== null)
  )

  return (
    <Card className="w-fit self-start">
      <CardHeader className="block" style={{ containerType: "normal" }}>
        <CardTitle className="whitespace-nowrap">Números ganadores — {state.round.name}</CardTitle>
      </CardHeader>
      <CardContent>
        {blocked && (
          <p className="mb-2 text-sm text-muted-foreground">
            No puedes registrar números ganadores hasta que todos confirmen su check-in.
          </p>
        )}
        <div
          className={cn(
            "flex flex-wrap gap-x-6 gap-y-4 pt-2",
            blocked && "pointer-events-none opacity-50"
          )}
        >
          {state.round.prizes.map((prize, i) => (
            <WinningNumberBall
              key={i}
              slotIndex={i}
              prizeAmount={prize}
              value={state.winningNumbers[i] ?? null}
              usedNumbers={usedNumbers}
              onSubmit={(number) => awardPrize(i, number)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
