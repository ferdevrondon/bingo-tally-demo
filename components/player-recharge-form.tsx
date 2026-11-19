"use client"

import * as React from "react"

import {
  AmountField,
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
import {
  ContactFields,
  contactText,
} from "@/components/movement-contact-fields"
import { PaymentMethodSelect } from "@/components/payment-method-select"
import { PayoutTypePills } from "@/components/payout-type-pills"
import { Button } from "@/components/ui/button"
import type { Bank } from "@/lib/banks"
import type { PaymentMethod } from "@/lib/payment-methods"
import { DEFAULT_PAYOUT_TYPE, type PayoutType } from "@/lib/payout-types"
import { emailSchema } from "@/lib/players"
import { signedMoney } from "@/lib/round-draft/balance"
import { useRoundDraft } from "@/lib/round-draft/context"
import { getLastRechargeActivity } from "@/lib/round-draft/selectors"
import type { DraftPlayer } from "@/lib/round-draft/types"
import { formatMoney } from "@/lib/rounds"

const PRESET_AMOUNTS = [10, 20, 40, 50, 100, 200]

// "Recarga" tab of the balance dialog (live game): the player pays the house.
// The rail (name and balance) is drawn by the dialog.
export function PlayerRechargeForm({
  player,
  onDone,
}: {
  player: DraftPlayer
  /** The recharge was sent: the dialog closes. */
  onDone: () => void
}) {
  const { state, rechargeBalance } = useRoundDraft()
  const [amount, setAmount] = React.useState("")
  // Prefilled from the player's catalog data.
  const [paymentMethod, setPaymentMethod] =
    React.useState<PaymentMethod | null>(player.paymentMethod ?? "cash")
  const [bank, setBank] = React.useState<Bank | null>(player.bank ?? null)
  const [note, setNote] = React.useState("")
  const [payoutType, setPayoutType] =
    React.useState<PayoutType>(DEFAULT_PAYOUT_TYPE)
  const [contactEmail, setContactEmail] = React.useState(player.email)
  const [contactPhone, setContactPhone] = React.useState(player.phone)
  // One recharge per dialog opening: a double click reuses the same request.
  const [requestKey] = React.useState(() => crypto.randomUUID())
  const [isConfirmOpen, setIsConfirmOpen] = React.useState(false)

  const netBalance = player.balance
  const parsedAmount = Number.parseFloat(amount)
  const hasAmount = Number.isFinite(parsedAmount) && parsedAmount > 0
  const emailOk = emailSchema.safeParse(contactEmail).success
  const isValid = hasAmount && paymentMethod !== null && emailOk

  const lastRecharge = getLastRechargeActivity(state, player.id)

  // The form's button opens the confirmation; confirming records the recharge.
  function handleConfirm() {
    if (!isValid || paymentMethod === null) return
    rechargeBalance(
      player.id,
      parsedAmount,
      paymentMethod,
      bank,
      note.trim() || null,
      requestKey,
      { contactEmail: contactEmail.trim(), contactPhone: contactPhone.trim() },
      payoutType
    )
    onDone()
  }

  return (
    <PanelBody>
      <AmountField
        label="Monto a agregar"
        inputMode="numeric"
        value={amount}
        onChange={setAmount}
      />
      <QuickAmounts
        options={PRESET_AMOUNTS.map((p) => ({ label: `$${p}`, amount: p }))}
        current={parsedAmount}
        onPick={(value) => setAmount(String(value))}
      />

      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Método de pago" htmlFor="recharge-payment-method">
          <PaymentMethodSelect
            id="recharge-payment-method"
            value={paymentMethod}
            onChange={setPaymentMethod}
            className={SELECTOR_CLASS}
          />
        </SelectField>
        <SelectField label="Banco" htmlFor="recharge-bank">
          <BankSelect
            id="recharge-bank"
            value={bank}
            onChange={setBank}
            className={SELECTOR_CLASS}
          />
        </SelectField>
      </div>

      <PayoutTypePills value={payoutType} onChange={setPayoutType} />

      <ContactFields
        idPrefix="recharge"
        email={contactEmail}
        phone={contactPhone}
        emailOk={emailOk}
        onEmailChange={setContactEmail}
        onPhoneChange={setContactPhone}
      />

      <NotesField id="recharge-note" value={note} onChange={setNote} />

      {!emailOk ? (
        <FormMessage tone="destructive">El correo no es válido.</FormMessage>
      ) : hasAmount ? (
        <SummaryRows
          rows={[
            { label: "Saldo actual", value: signedMoney(netBalance) },
            { label: "Recarga", value: `+${formatMoney(parsedAmount)}` },
          ]}
          total={{
            label: "Saldo final",
            value: signedMoney(netBalance + parsedAmount),
          }}
        />
      ) : (
        <FormMessage>Selecciona o ingresa un monto para agregar.</FormMessage>
      )}

      <Button
        className="w-full rounded-xl"
        size="lg"
        disabled={!isValid}
        onClick={() => setIsConfirmOpen(true)}
      >
        Confirmar recarga
      </Button>

      {isValid && (
        <ConfirmMovementDialog
          open={isConfirmOpen}
          onOpenChange={setIsConfirmOpen}
          kind="recharge"
          amount={parsedAmount}
          playerName={player.name}
          paymentMethod={paymentMethod}
          bank={bank}
          contact={contactText(contactEmail, contactPhone)}
          payoutType={payoutType}
          usual={lastRecharge?.amount ?? null}
          onConfirm={handleConfirm}
        />
      )}
    </PanelBody>
  )
}
