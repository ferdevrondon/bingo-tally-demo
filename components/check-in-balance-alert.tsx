"use client"

import { TriangleAlertIcon,} from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { useRoundDraft } from "@/lib/round-draft/context"
import { getActivePlayers } from "@/lib/round-draft/selectors"

export function CheckInBalanceAlert() {
  const { state } = useRoundDraft()
  const activePlayers = getActivePlayers(state)

  // Players still deciding their play for the new round aren't asked for a
  // check-in yet: they first keep or release their numbers.
  const pendingDecision = activePlayers.filter((p) => p.pendingCarryOverDecision)
  const pendingCheckIn = activePlayers.filter(
    (p) => !p.checkedIn && !p.pendingCarryOverDecision
  )

  if (pendingCheckIn.length === 0 && pendingDecision.length === 0) {
    return null
  }

  return (
    <>
      {pendingCheckIn.length > 0 && (
        <Alert className="border-none bg-destructive/10 text-destructive w-fit">
          <TriangleAlertIcon />
          <AlertTitle>
            {pendingCheckIn.length} jugador
            {pendingCheckIn.length === 1 ? "" : "es"} pendiente
            {pendingCheckIn.length === 1 ? "" : "s"} de check-in
          </AlertTitle>
          <AlertDescription>
            No puedes registrar números ganadores hasta que todos confirmen su
            check-in.
            <div className="mt-2 flex flex-wrap gap-1.5">
              {pendingCheckIn.map((p) => (
                <Badge key={p.id} className="bg-red-600 text-white">
                  {p.name}
                </Badge>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}
      {pendingDecision.length > 0 && (
        <Alert className="w-fit border-none bg-amber-600/10 text-amber-700 dark:bg-amber-400/10 dark:text-amber-400">
          <TriangleAlertIcon />
          <AlertTitle>
            {pendingDecision.length} jugador{pendingDecision.length === 1 ? "" : "es"}{" "}
            {pendingDecision.length === 1 ? "debe" : "deben"} decidir si mantiene
            {pendingDecision.length === 1 ? "" : "n"} o libera
            {pendingDecision.length === 1 ? "" : "n"} su jugada
          </AlertTitle>
        </Alert>
      )}
    </>
  )
}
