"use client"

import * as React from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useRoundDraft } from "@/lib/round-draft/context"
import type { DraftPlayer } from "@/lib/round-draft/types"
import { cn } from "@/lib/utils"

const PRESET_AMOUNTS = [10, 20, 50, 100]

export function PlayerRechargeDialog({
  player,
  open,
  onOpenChange,
}: {
  player: DraftPlayer
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { rechargeBalance } = useRoundDraft()
  const [amount, setAmount] = React.useState("")

  React.useEffect(() => {
    if (open) setAmount("")
  }, [open])

  const netBalance = player.positiveBalance - player.negativeBalance
  const parsedAmount = Number.parseFloat(amount)
  const isValid = Number.isFinite(parsedAmount) && parsedAmount > 0

  function handleConfirm() {
    if (!isValid) return
    rechargeBalance(player.id, parsedAmount)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Recarga de {player.name}</DialogTitle>
          <DialogDescription>
            Saldo actual:{" "}
            <span
              className={cn(
                "font-semibold",
                netBalance >= 0 ? "text-green-600" : "text-destructive"
              )}
            >
              {netBalance >= 0 ? "+" : "-"}${Math.abs(netBalance)}
            </span>
            {player.negativeBalance > 0 && " · se abonará primero a la deuda pendiente"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-6">
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="Monto a recargar"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="text-center text-2xl font-semibold"
          />
          <div className="flex flex-wrap justify-center gap-2">
            {PRESET_AMOUNTS.map((preset) => (
              <Badge
                key={preset}
                variant={parsedAmount === preset ? "default" : "outline"}
                render={<button type="button" />}
                onClick={() => setAmount(String(preset))}
                className="cursor-pointer px-3 py-1 text-sm"
              >
                ${preset}
              </Badge>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button disabled={!isValid} onClick={handleConfirm}>
            Confirmar recarga
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
