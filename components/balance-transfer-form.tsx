"use client"

import * as React from "react"

import {
  AmountField,
  FormMessage,
  NotesField,
  PanelBody,
  QuickAmounts,
  SelectField,
  SummaryRows,
} from "@/components/balance-dialog-parts"
import { ConfirmMovementDialog } from "@/components/confirm-movement-dialog"
import { PlayerCombobox } from "@/components/tickets-board"
import { Button } from "@/components/ui/button"
import { signedMoney } from "@/lib/round-draft/balance"
import { formatMoney } from "@/lib/rounds"

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

const PRESET_AMOUNTS = [10, 20, 50]

// "Transferencia" tab of the balance dialog: a player hands part of their
// balance in favor to another one. It is not cash (the house neither collects nor pays anything),
// so it asks for no payment method or bank. Only up to the sender's balance;
// the receiver can have any balance (a debt goes down).
export function BalanceTransferForm({
  from,
  candidates,
  onConfirm,
  onDone,
}: {
  from: TransferPlayer
  /** The players that can receive it (everyone but the sender). */
  candidates: TransferPlayer[]
  /** Resolves true when saved; the dialog closes then. */
  onConfirm: (values: TransferValues) => Promise<boolean>
  /** The transfer was saved: the dialog closes. */
  onDone: () => void
}) {
  const [toPlayerId, setToPlayerId] = React.useState<number | null>(null)
  const [amount, setAmount] = React.useState("")
  const [note, setNote] = React.useState("")
  const [requestId] = React.useState(() => crypto.randomUUID())
  const [isConfirmOpen, setIsConfirmOpen] = React.useState(false)
  const [isPending, startTransition] = React.useTransition()

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
      if (saved) onDone()
    })
  }

  const presets = [
    ...PRESET_AMOUNTS.filter((preset) => preset <= from.balance).map((p) => ({
      label: `$${p}`,
      amount: p,
    })),
    ...(hasBalance
      ? [{ label: `Todo ${formatMoney(from.balance)}`, amount: from.balance }]
      : []),
  ]
  const delta = hasAmount ? parsedAmount : 0

  return (
    <PanelBody>
      <SelectField label="Enviar a">
        <PlayerCombobox
          players={candidates}
          value={toPlayerId}
          onChange={setToPlayerId}
          disabled={!hasBalance}
          placeholder="Busca un jugador"
          className="w-full"
        />
      </SelectField>

      <AmountField
        label="Monto a transferir"
        value={amount}
        onChange={setAmount}
        step={0.01}
        disabled={!hasBalance}
        hint={`Disponible ${formatMoney(Math.max(from.balance, 0))}`}
      />
      <QuickAmounts
        options={presets}
        current={parsedAmount}
        onPick={(value) => setAmount(String(value))}
      />

      <NotesField
        id="transfer-note"
        value={note}
        onChange={setNote}
        disabled={!hasBalance}
      />

      <SummaryRows
        rows={[
          {
            label: `Saldo de ${from.name}`,
            value: `${signedMoney(from.balance)} → ${signedMoney(from.balance - delta)}`,
          },
          {
            label: `Saldo de ${receiver?.name ?? "destino"}`,
            value: receiver
              ? `${signedMoney(receiver.balance)} → ${signedMoney(receiver.balance + delta)}`
              : "— → —",
          },
        ]}
      />
      {!hasBalance ? (
        <FormMessage>Solo se puede transferir saldo a favor.</FormMessage>
      ) : exceeds ? (
        <FormMessage tone="destructive">
          {`No puede transferir más que su saldo a favor (${formatMoney(from.balance)}).`}
        </FormMessage>
      ) : !isValid ? (
        <FormMessage>Elige a quién y cuánto.</FormMessage>
      ) : null}

      <Button
        className="w-full rounded-xl"
        size="lg"
        disabled={!isValid || isPending}
        onClick={() => setIsConfirmOpen(true)}
      >
        Confirmar transferencia
      </Button>

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
    </PanelBody>
  )
}
