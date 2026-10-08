"use client"

import * as React from "react"

import { BankSelect } from "@/components/bank-select"
import { PaymentMethodChips } from "@/components/payment-method-chips"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import type { Bank } from "@/lib/banks"
import type { PaymentMethod } from "@/lib/payment-methods"
import { formatRelativeTime } from "@/lib/format-relative-time"
import { signedMoney } from "@/lib/round-draft/balance"
import { useRoundDraft } from "@/lib/round-draft/context"
import { getLastRechargeActivity } from "@/lib/round-draft/selectors"
import type { DraftPlayer } from "@/lib/round-draft/types"
import { cn } from "@/lib/utils"

const PRESET_AMOUNTS = [10, 20,40, 50, 100, 200]

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
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod | null>(null)
  const [bank, setBank] = React.useState<Bank | null>(null)
  const [note, setNote] = React.useState("")
  // One recharge per dialog opening: a double click reuses the same request.
  const [requestKey, setRequestKey] = React.useState(() => crypto.randomUUID())

  // Reset the form each time the dialog opens (adjusting state during render
  // instead of in an effect, per React's "you might not need an effect"). The
  // payment method is prefilled from the player's catalog data.
  const [wasOpen, setWasOpen] = React.useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setAmount("")
      setPaymentMethod(player.paymentMethod ?? "cash")
      setBank(player.bank ?? null)
      setNote("")
      setRequestKey(crypto.randomUUID())
    }
  }

  const netBalance = player.balance
  const parsedAmount = Number.parseFloat(amount)
  const isValid = Number.isFinite(parsedAmount) && parsedAmount > 0 && paymentMethod !== null

  const lastRecharge = getLastRechargeActivity(state, player.id)

  function handleConfirm() {
    if (!isValid || paymentMethod === null) return
    rechargeBalance(player.id, parsedAmount, paymentMethod, bank, note.trim() || null, requestKey)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 p-0">
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

        <div className="flex min-h-0 flex-col gap-6 overflow-y-auto p-6">
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

          {parsedAmount > 0 ? (
            <>
              <Field>
                <FieldLabel id="recharge-payment-method">Método</FieldLabel>
                <PaymentMethodChips
                  aria-labelledby="recharge-payment-method"
                  value={paymentMethod}
                  onChange={setPaymentMethod}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="recharge-bank">Banco</FieldLabel>
                <BankSelect id="recharge-bank" value={bank} onChange={setBank} />
              </Field>
              <Field>
                <FieldLabel htmlFor="recharge-note">Nota (opcional)</FieldLabel>
                <Input
                  id="recharge-note"
                  value={note}
                  maxLength={200}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ej. referencia"
                />
              </Field>
            </>
          ) : null}

          <p className="text-xs text-muted-foreground">
            {Number.isFinite(parsedAmount) && parsedAmount > 0
              ? `Su saldo quedará en ${signedMoney(netBalance + parsedAmount)}.`
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
