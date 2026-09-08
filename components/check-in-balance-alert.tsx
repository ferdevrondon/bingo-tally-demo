"use client"

import { TriangleAlertIcon,} from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { useRoundDraft } from "@/lib/round-draft/context"
import { getActivePlayers } from "@/lib/round-draft/selectors"

export function CheckInBalanceAlert() {
  const { state } = useRoundDraft()
  const activePlayers = getActivePlayers(state)

  const pendingCheckIn = activePlayers.filter((p) => !p.checkedIn)
  const withNegativeBalance = activePlayers.filter((p) => p.negativeBalance > 0)

  if (pendingCheckIn.length === 0 && withNegativeBalance.length === 0) {
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
                <Badge key={p.id} className="bg-red-600">
                  {p.name}
                </Badge>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}
    </>
  )
}
