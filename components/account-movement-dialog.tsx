"use client"

import * as React from "react"

import {
  AmountField,
  BalanceCard,
  FormMessage,
  NotesField,
  PanelBody,
  QuickAmounts,
  SELECTOR_CLASS,
  SelectField,
  SummaryRows,
} from "@/components/balance-dialog-parts"
import { BankSelect } from "@/components/bank-select"
import { ConfirmMovementDialog } from "@/components/confirm-movement-dialog"
import { PaymentMethodSelect } from "@/components/payment-method-select"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import type { Bank } from "@/lib/banks"
import type { PaymentMethod } from "@/lib/payment-methods"
import { signedMoney } from "@/lib/round-draft/balance"
import { formatMoney } from "@/lib/rounds"

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
function suggestedAmount(
  direction: MovementDirection,
  balance: number
): string {
  if (direction === "in" && balance < 0) return String(-balance)
  if (direction === "out" && balance > 0) return String(balance)
  return ""
}

// "Recibir pago" (the player pays the house) and "Registrar pago" (the house
// pays the player). Opens with the full balance, editable for a partial
// payment. Payouts have no limit: a warning shows when one leaves the player
// owing.
export function AccountMovementForm({
  direction,
  player,
  showBalance = true,
  onConfirm,
  onDone,
}: {
  direction: MovementDirection
  player: {
    name: string
    balance: number
    paymentMethod: PaymentMethod | null
    bank?: Bank | null
  }
  /** Draw the balance card; false inside the balance dialog, which has its own. */
  showBalance?: boolean
  /** Resolves true when saved; the dialog closes then. */
  onConfirm: (values: MovementValues) => Promise<boolean>
  /** The move was saved: the dialog closes. */
  onDone: () => void
}) {
  const [amount, setAmount] = React.useState(() =>
    suggestedAmount(direction, player.balance)
  )
  const [paymentMethod, setPaymentMethod] =
    React.useState<PaymentMethod | null>(player.paymentMethod ?? "cash")
  const [bank, setBank] = React.useState<Bank | null>(player.bank ?? null)
  const [note, setNote] = React.useState("")
  const [requestId] = React.useState(() => crypto.randomUUID())
  const [isConfirmOpen, setIsConfirmOpen] = React.useState(false)
  const [isPending, startTransition] = React.useTransition()

  const parsedAmount = Number.parseFloat(amount)
  const isValid =
    Number.isFinite(parsedAmount) && parsedAmount > 0 && paymentMethod !== null
  const balanceAfter = isValid
    ? player.balance + (direction === "in" ? parsedAmount : -parsedAmount)
    : player.balance
  const leavesOwing = direction === "out" && isValid && balanceAfter < 0
  // The form's button opens the confirmation; confirming records the move.
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
      if (saved) onDone()
    })
  }

  return (
    <PanelBody>
      {showBalance && <BalanceCard balance={player.balance} />}
      <AmountField
        label="Monto"
        value={amount}
        onChange={setAmount}
        step={0.01}
      />
      <QuickAmounts
        options={PRESET_AMOUNTS.map((p) => ({ label: `$${p}`, amount: p }))}
        current={parsedAmount}
        onPick={(value) => setAmount(String(value))}
      />

      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Método de pago" htmlFor="movement-payment-method">
          <PaymentMethodSelect
            id="movement-payment-method"
            value={paymentMethod}
            onChange={setPaymentMethod}
            className={SELECTOR_CLASS}
          />
        </SelectField>
        <SelectField label="Banco" htmlFor="movement-bank">
          <BankSelect
            id="movement-bank"
            value={bank}
            onChange={setBank}
            className={SELECTOR_CLASS}
          />
        </SelectField>
      </div>

      <NotesField id="movement-note" value={note} onChange={setNote} />

      {isValid ? (
        <SummaryRows
          tone={leavesOwing ? "destructive" : "default"}
          rows={[
            { label: "Saldo actual", value: signedMoney(player.balance) },
            {
              label: direction === "in" ? "Cobro" : "Pago",
              value: `${direction === "in" ? "+" : "-"}${formatMoney(parsedAmount)}`,
            },
          ]}
          total={{ label: "Saldo final", value: signedMoney(balanceAfter) }}
        />
      ) : (
        <FormMessage>Ingresa el monto y el método de pago.</FormMessage>
      )}
      {leavesOwing && (
        <FormMessage tone="destructive">
          {`El pago es mayor a su saldo a favor: quedará debiendo ${formatMoney(-balanceAfter)}.`}
        </FormMessage>
      )}

      <Button
        className="w-full rounded-xl"
        size="lg"
        disabled={!isValid || isPending}
        onClick={() => setIsConfirmOpen(true)}
      >
        {direction === "in" ? "Confirmar cobro" : "Confirmar pago"}
      </Button>

      {isValid && (
        <ConfirmMovementDialog
          open={isConfirmOpen}
          onOpenChange={setIsConfirmOpen}
          kind={direction === "in" ? "receive" : "payout"}
          amount={parsedAmount}
          playerName={player.name}
          paymentMethod={paymentMethod}
          bank={bank}
          onConfirm={handleConfirm}
        />
      )}
    </PanelBody>
  )
}

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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm gap-0 p-0">
        <DialogHeader className="p-6">
          <DialogTitle className="text-xl">
            {direction === "in" ? "Recibir pago" : "Registrar pago"} ·{" "}
            {player.name}
          </DialogTitle>
          <DialogDescription>
            {direction === "in"
              ? "El jugador le entrega dinero a la casa."
              : "La casa le entrega dinero al jugador."}
          </DialogDescription>
        </DialogHeader>

        <Separator className="border-t border-dashed border-border bg-transparent" />

        <div className="min-h-0 overflow-y-auto p-6">
          <AccountMovementForm
            direction={direction}
            player={player}
            onConfirm={onConfirm}
            onDone={() => onOpenChange(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
