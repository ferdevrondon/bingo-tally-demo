"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { formatRelativeTime } from "@/lib/format-relative-time"
import { useRoundDraft } from "@/lib/round-draft/context"
import { getLastRechargeActivity } from "@/lib/round-draft/selectors"
import type { DraftPlayer } from "@/lib/round-draft/types"
import { cn } from "@/lib/utils"

const PRESET_AMOUNTS = [10, 20, 50, 100, 200]

export function PlayerRechargeDialog({
  player,
  open,
  onOpenChange,
}: {
  player: DraftPlayer
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { state, rechargeBalance } = useRoundDraft()
  const [amount, setAmount] = React.useState("")

  // Reset the form each time the dialog opens (adjusting state during render
  // instead of in an effect, per React's "you might not need an effect").
  const [wasOpen, setWasOpen] = React.useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setAmount("")
  }

  const netBalance = player.positiveBalance - player.negativeBalance
  const parsedAmount = Number.parseFloat(amount)
  const isValid = Number.isFinite(parsedAmount) && parsedAmount > 0

  const lastRecharge = getLastRechargeActivity(state, player.id)

  function handleConfirm() {
    if (!isValid) return
    rechargeBalance(player.id, parsedAmount)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm gap-0 p-0">
        <DialogHeader className="flex-row items-center gap-3 p-6">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-lg border-2 border-foreground/70 text-lg font-bold">
            {player.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col gap-0.5">
            <DialogTitle className="text-xl">{player.name}</DialogTitle>
            <DialogDescription>
              {lastRecharge
                ? `Última recarga: ${formatRelativeTime(lastRecharge.timestamp)}`
                : "Sin recargas previas"}
            </DialogDescription>
          </div>
        </DialogHeader>

        <Separator className="border-t border-dashed border-border bg-transparent" />

        <div className="flex flex-col gap-6 p-6">
          <div>
            <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Saldo actual
            </div>
            <div
              className={cn(
                "text-4xl font-bold tabular-nums",
                netBalance >= 0 ? "text-green-600" : "text-destructive"
              )}
            >
              {netBalance >= 0 ? "+" : "-"}${Math.abs(netBalance)}
            </div>
          </div>

          <div>
            <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Monto a agregar
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-muted-foreground">$</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full min-w-0 appearance-none border-none bg-transparent text-4xl font-bold tabular-nums text-foreground outline-none placeholder:text-muted-foreground [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
            </div>
          </div>

          <Separator />

          <div className="flex flex-wrap gap-2">
            {PRESET_AMOUNTS.map((preset) => (
              <Button
                key={preset}
                type="button"
                variant={parsedAmount === preset ? "default" : "outline"}
                className="rounded-lg"
                onClick={() => setAmount(String(preset))}
              >
                ${preset}
              </Button>
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            {player.negativeBalance > 0
              ? "Se abonará primero a la deuda pendiente."
              : "Selecciona o ingresa un monto para agregar."}
          </p>
        </div>

        <DialogFooter className="p-6  bg-muted">
          <Button className="w-full" size="lg" disabled={!isValid} onClick={handleConfirm}>
            Confirmar recarga
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
