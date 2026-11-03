"use client"

import * as React from "react"

import { ConfirmMovementDialog } from "@/components/confirm-movement-dialog"
import { PlayerCombobox } from "@/components/tickets-board"
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
import { balanceLabel, signedMoney } from "@/lib/round-draft/balance"
import { formatMoney } from "@/lib/rounds"
import { cn } from "@/lib/utils"

export interface TransferPlayer {
  id: number
  name: string
  /** Signed balance: where their money lives right now (the game session
   *  while they play, otherwise their account). */
  balance: number
}

export interface TransferValues {
  toPlayerId: number
  amount: number
  note: string | null
  /** One per dialog opening: a double click records the transfer once. */
  requestId: string
}

const PRESET_AMOUNTS = [10, 20, 50, 100, 200]

// "Transferir saldo": a player hands part of their balance in favor to
// another one. It is not cash (the house neither collects nor pays anything),
// so it asks for no payment method or bank. Only up to the sender's balance;
// the receiver can have any balance (a debt goes down).
export function BalanceTransferDialog({
  open,
  onOpenChange,
  from,
  candidates,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  from: TransferPlayer
  /** The players that can receive it (everyone but the sender). */
  candidates: TransferPlayer[]
  /** Resolves true when saved; the dialog closes then. */
  onConfirm: (values: TransferValues) => Promise<boolean>
}) {
  const [toPlayerId, setToPlayerId] = React.useState<number | null>(null)
  const [amount, setAmount] = React.useState("")
  const [note, setNote] = React.useState("")
  const [requestId, setRequestId] = React.useState(() => crypto.randomUUID())
  const [isConfirmOpen, setIsConfirmOpen] = React.useState(false)
  const [isPending, startTransition] = React.useTransition()

  // Reset each time the dialog opens (state adjusted during render).
  const [wasOpen, setWasOpen] = React.useState(false)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setToPlayerId(null)
      setAmount("")
      setNote("")
      setRequestId(crypto.randomUUID())
      setIsConfirmOpen(false)
    }
  }

  const receiver = candidates.find((p) => p.id === toPlayerId) ?? null
  const hasBalance = from.balance > 0
  const parsedAmount = Number.parseFloat(amount)
  const hasAmount = Number.isFinite(parsedAmount) && parsedAmount > 0
  const exceeds = hasAmount && parsedAmount > from.balance
  const isValid = hasAmount && !exceeds && receiver !== null && hasBalance

  function handleConfirm() {
    if (!isValid || receiver === null || isPending) return
    startTransition(async () => {
      const saved = await onConfirm({
        toPlayerId: receiver.id,
        amount: parsedAmount,
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
          <DialogTitle className="text-xl">Transferir saldo · {from.name}</DialogTitle>
          <DialogDescription>
            Pasa parte de su saldo a favor a otro jugador. No es dinero que entra ni sale de la casa.
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
                from.balance >= 0 ? "text-success" : "text-destructive"
              )}
            >
              {balanceLabel(from.balance)}
            </div>
            {!hasBalance && (
              <p className="mt-1 text-xs text-muted-foreground">
                Solo se puede transferir saldo a favor.
              </p>
            )}
          </div>

          <Field>
            <FieldLabel>Para</FieldLabel>
            <PlayerCombobox
              players={candidates}
              value={toPlayerId}
              onChange={setToPlayerId}
              disabled={!hasBalance}
              placeholder="Busca un jugador"
              className="w-full"
            />
          </Field>

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
                disabled={!hasBalance}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full min-w-0 appearance-none border-none bg-transparent text-4xl font-bold tabular-nums text-foreground outline-none placeholder:text-muted-foreground [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {PRESET_AMOUNTS.filter((preset) => preset <= from.balance).map((preset) => (
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
            {hasBalance && (
              <Button
                type="button"
                variant={parsedAmount === from.balance ? "default" : "outline"}
                className="rounded-lg"
                onClick={() => setAmount(String(from.balance))}
              >
                Todo ({formatMoney(from.balance)})
              </Button>
            )}
          </div>

          <Field>
            <FieldLabel htmlFor="transfer-note">Nota (opcional)</FieldLabel>
            <Input
              id="transfer-note"
              value={note}
              maxLength={200}
              disabled={!hasBalance}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ej. para cubrir su cartón"
            />
          </Field>

          <div
            className={cn(
              "rounded-lg border border-dashed p-3 text-xs",
              exceeds ? "border-destructive text-destructive" : "text-muted-foreground"
            )}
          >
            {exceeds ? (
              `No puede transferir más que su saldo a favor (${formatMoney(from.balance)}).`
            ) : isValid && receiver !== null ? (
              <ul className="flex flex-col gap-1">
                <li>
                  {from.name}: {signedMoney(from.balance)} →{" "}
                  <span className="font-semibold text-foreground">
                    {signedMoney(from.balance - parsedAmount)}
                  </span>
                </li>
                <li>
                  {receiver.name}: {signedMoney(receiver.balance)} →{" "}
                  <span className="font-semibold text-foreground">
                    {signedMoney(receiver.balance + parsedAmount)}
                  </span>
                </li>
              </ul>
            ) : (
              "Elige a quién y cuánto."
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            className="w-full"
            size="lg"
            disabled={!isValid || isPending}
            onClick={() => setIsConfirmOpen(true)}
          >
            Confirmar transferencia
            {isValid && ` de ${formatMoney(parsedAmount)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
      {isValid && receiver !== null && (
        <ConfirmMovementDialog
          open={isConfirmOpen}
          onOpenChange={setIsConfirmOpen}
          kind="transfer"
          amount={parsedAmount}
          playerName={from.name}
          toPlayerName={receiver.name}
          paymentMethod={null}
          bank={null}
          onConfirm={handleConfirm}
        />
      )}
    </Dialog>
  )
}
