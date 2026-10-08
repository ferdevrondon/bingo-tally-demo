"use client"

import * as React from "react"

import { BankSelect } from "@/components/bank-select"
import { PaymentMethodSelect } from "@/components/payment-method-select"
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
import { balanceLabel, signedMoney } from "@/lib/round-draft/balance"
import { formatMoney } from "@/lib/rounds"
import { cn } from "@/lib/utils"

export type MovementDirection = "in" | "out"

export interface MovementValues {
  amount: number
  paymentMethod: PaymentMethod
  bank: Bank | null
  note: string | null
  /** One per dialog opening: a double click records the move once. */
  requestId: string
}

const PRESET_AMOUNTS = [10, 20, 50, 100, 200]

/** The full balance the move would settle, or "" when it goes the other way. */
function suggestedAmount(direction: MovementDirection, balance: number): string {
  if (direction === "in" && balance < 0) return String(-balance)
  if (direction === "out" && balance > 0) return String(balance)
  return ""
}

// "Recibir pago" (the player pays the house) and "Registrar pago" (the house
// pays the player). Opens with the full balance, editable for a partial
// payment. Payouts have no limit: a warning shows when one leaves the player
// owing.
export function AccountMovementDialog({
  open,
  onOpenChange,
  direction,
  player,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  direction: MovementDirection
  player: {
    name: string
    balance: number
    paymentMethod: PaymentMethod | null
    bank?: Bank | null
  }
  /** Resolves true when saved; the dialog closes then. */
  onConfirm: (values: MovementValues) => Promise<boolean>
}) {
  const [amount, setAmount] = React.useState("")
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod | null>(null)
  const [bank, setBank] = React.useState<Bank | null>(null)
  const [note, setNote] = React.useState("")
  const [requestId, setRequestId] = React.useState(() => crypto.randomUUID())
  const [isPending, startTransition] = React.useTransition()

  // Reset each time the dialog opens (state adjusted during render).
  // Starts closed so a dialog mounted already open is reset too.
  const [wasOpen, setWasOpen] = React.useState(false)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setAmount(suggestedAmount(direction, player.balance))
      setPaymentMethod(player.paymentMethod ?? "cash")
      setBank(player.bank ?? null)
      setNote("")
      setRequestId(crypto.randomUUID())
    }
  }

  const parsedAmount = Number.parseFloat(amount)
  const isValid = Number.isFinite(parsedAmount) && parsedAmount > 0 && paymentMethod !== null
  const balanceAfter = isValid
    ? player.balance + (direction === "in" ? parsedAmount : -parsedAmount)
    : player.balance
  const leavesOwing = direction === "out" && isValid && balanceAfter < 0

  function handleConfirm() {
    if (!isValid || paymentMethod === null || isPending) return
    startTransition(async () => {
      const saved = await onConfirm({
        amount: parsedAmount,
        paymentMethod,
        bank,
        note: note.trim() || null,
        requestId,
      })
      if (saved) onOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm gap-0 p-0">
        <DialogHeader className="p-6">
          <DialogTitle className="text-xl">
            {direction === "in" ? "Recibir pago" : "Registrar pago"} · {player.name}
          </DialogTitle>
          <DialogDescription>
            {direction === "in"
              ? "El jugador le entrega dinero a la casa."
              : "La casa le entrega dinero al jugador."}
          </DialogDescription>
        </DialogHeader>

        <Separator className="border-t border-dashed border-border bg-transparent" />

        <div className="flex flex-col gap-5 p-6">
          <div>
            <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Saldo actual
            </div>
            <div
              className={cn(
                "text-2xl font-bold tabular-nums",
                player.balance >= 0 ? "text-green-600" : "text-destructive"
              )}
            >
              {balanceLabel(player.balance)}
            </div>
          </div>

          <div>
            <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Monto
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-muted-foreground">$</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step={0.01}
                placeholder="0"
                aria-label="Monto"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full min-w-0 appearance-none border-none bg-transparent text-4xl font-bold tabular-nums text-foreground outline-none placeholder:text-muted-foreground [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
            </div>
          </div>

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

          <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="movement-bank" className="whitespace-nowrap">
                Banco
              </FieldLabel>
              <BankSelect id="movement-bank" value={bank} onChange={setBank} />
            </Field>
            <Field>
              <FieldLabel htmlFor="movement-payment-method" className="whitespace-nowrap">
                Método
              </FieldLabel>
              <PaymentMethodSelect
                id="movement-payment-method"
                value={paymentMethod}
                onChange={setPaymentMethod}
              />
            </Field>
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="movement-note">Nota (opcional)</FieldLabel>
              <Input
                id="movement-note"
                value={note}
                maxLength={200}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ej. referencia"
              />
            </Field>
          </div>

          <p className={cn("text-xs", leavesOwing ? "text-destructive" : "text-muted-foreground")}>
            {!isValid
              ? "Ingresa el monto y el método de pago."
              : leavesOwing
                ? `El pago es mayor a su saldo a favor: quedará debiendo ${formatMoney(-balanceAfter)}.`
                : `Su saldo quedará en ${signedMoney(balanceAfter)}.`}
          </p>
        </div>

        <DialogFooter className="bg-muted p-6">
          <Button className="w-full" size="lg" disabled={!isValid || isPending} onClick={handleConfirm}>
            {direction === "in" ? "Confirmar cobro" : "Confirmar pago"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
