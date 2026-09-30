"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowRightIcon, PlayIcon, TriangleAlertIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { accountStatusText } from "@/lib/accounts"
import { getStartAlerts, type StartAlerts } from "@/lib/data/account-actions"
import { GAME_ACTION_ERROR_MESSAGES } from "@/lib/data/game-action-result"
import { startGameSession } from "@/lib/data/game-session-actions"
import { balanceLabel } from "@/lib/round-draft/balance"
import { cn } from "@/lib/utils"

// "Iniciar jornada": creates the house's game session (or reuses the active
// one) and goes to /new-game. First it checks what is still pending from
// earlier game sessions (players who owe, pending payouts, positive balances
// nobody decided on, open settlements) and warns about it; it never blocks.
export function StartGameSessionButton({ className }: { className?: string }) {
  const [isPending, startTransition] = React.useTransition()
  const [alerts, setAlerts] = React.useState<StartAlerts | null>(null)

  function start() {
    startTransition(async () => {
      const result = await startGameSession(crypto.randomUUID())
      if (!result.ok) toast.error(GAME_ACTION_ERROR_MESSAGES[result.error])
    })
  }

  function handleClick() {
    startTransition(async () => {
      const pending = await getStartAlerts()
      if (pending.players.length > 0 || pending.openSettlements.length > 0) setAlerts(pending)
      else start()
    })
  }

  return (
    <>
      <Button
        size="lg"
        className={cn("w-fit gap-2", className)}
        disabled={isPending}
        onClick={handleClick}
      >
        <PlayIcon className="size-5" />
        Iniciar jornada
        <ArrowRightIcon className="size-4" />
      </Button>

      <Dialog open={alerts !== null} onOpenChange={(open) => !open && setAlerts(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TriangleAlertIcon className="size-5 text-amber-600" aria-hidden="true" />
              Antes de empezar
            </DialogTitle>
            <DialogDescription>
              Hay saldos pendientes de jornadas anteriores. Puedes iniciar igual.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 px-6">
            {alerts && alerts.openSettlements.length > 0 && (
              <div className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Liquidaciones abiertas</span>
                {alerts.openSettlements.map((s) => (
                  <Link
                    key={s.gameSessionId}
                    href={`/games/${s.gameSessionId}/settlement`}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    Jornada #{s.number} · {s.unresolved} por resolver
                  </Link>
                ))}
              </div>
            )}
            {alerts && alerts.players.length > 0 && (
              <div className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Jugadores con saldo pendiente</span>
                <ul className="divide-y rounded-lg border">
                  {alerts.players.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                      <span>{p.name}</span>
                      <span className="flex flex-col items-end">
                        <span
                          className={cn(
                            "font-medium tabular-nums",
                            p.balance < 0 ? "text-destructive" : "text-green-600"
                          )}
                        >
                          {balanceLabel(p.balance)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {accountStatusText(p)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <DialogFooter className="flex-row flex-wrap justify-end gap-2">
            {alerts && alerts.openSettlements.length > 0 && (
              <Button variant="outline" nativeButton={false} render={<Link href="/settlement" />}>
                Ver liquidación
              </Button>
            )}
            <Button variant="outline" nativeButton={false} render={<Link href="/players" />}>
              Ver jugadores
            </Button>
            <Button
              disabled={isPending}
              onClick={() => {
                setAlerts(null)
                start()
              }}
            >
              Iniciar de todos modos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
