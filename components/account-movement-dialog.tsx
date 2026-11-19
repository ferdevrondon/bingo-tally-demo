"use client"

import * as React from "react"

import {
  AmountField,
  BalanceCard,
  FieldSection,
  FormMessage,
  NotesField,
  PanelBody,
  QuickAmounts,
  SELECTOR_CLASS,
  SelectField,
  SummaryFooter,
  SummaryRows,
} from "@/components/balance-dialog-parts"
import { BankSelect } from "@/components/bank-select"
import { ConfirmMovementDialog } from "@/components/confirm-movement-dialog"
import {
  ContactFields,
  contactText,
} from "@/components/movement-contact-fields"
import { PaymentMethodSelect } from "@/components/payment-method-select"
import { PayoutTypeChip, PayoutTypePills } from "@/components/payout-type-pills"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import type { Bank } from "@/lib/banks"
import type { PaymentMethod } from "@/lib/payment-methods"
import { DEFAULT_PAYOUT_TYPE, type PayoutType } from "@/lib/payout-types"
import { emailSchema } from "@/lib/players"
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
  /** The email / phone the move came from or went to ("" = none); saved on
   *  the move and copied to the player (*_payout_contact.sql,
   *  *_collection_contact.sql). */
  contactEmail?: string
  contactPhone?: string
  /** ERNIE / DAIRY (*_payout_type.sql); absent where it isn't asked yet. */
  payoutType?: PayoutType
  /** The player's missing name / nickname, typed in the settlement's
   *  dialog (uppercase): saved to the player before the move, never over
   *  one the player already has. */
  missingNames?: { name?: string; nickname?: string }
}

export interface MovementPlayer {
  name: string
  /** Shown in the settlement's dialog; "" = missing, asked there. */
  nickname?: string
  balance: number
  paymentMethod: PaymentMethod | null
  bank?: Bank | null
  /** The player's contact, prefilled in the contact fields. */
  email?: string
  phone?: string
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

// The state of "Recibir pago" / "Registrar pago", shared by the /players
// panel (AccountMovementForm) and the wide settlement dialog. `withTags`:
// the form asks for the payout type and the player's missing name / nickname.
function useMovementForm({
  direction,
  player,
  withTags,
  onConfirm,
  onDone,
}: {
  direction: MovementDirection
  player: MovementPlayer
  withTags: boolean
  onConfirm: (values: MovementValues) => Promise<boolean>
  onDone: () => void
}) {
  const [amount, setAmount] = React.useState(() =>
    suggestedAmount(direction, player.balance)
  )
  const [paymentMethod, setPaymentMethod] =
    React.useState<PaymentMethod | null>(player.paymentMethod ?? "cash")
  const [bank, setBank] = React.useState<Bank | null>(player.bank ?? null)
  const [note, setNote] = React.useState("")
  const [contactEmail, setContactEmail] = React.useState(player.email ?? "")
  const [contactPhone, setContactPhone] = React.useState(player.phone ?? "")
  const [payoutType, setPayoutType] =
    React.useState<PayoutType>(DEFAULT_PAYOUT_TYPE)
  // Only for what the player lacks; what they have is shown, not edited.
  const knownName = player.name.trim()
  const knownNickname = (player.nickname ?? "").trim()
  const [nameInput, setNameInput] = React.useState("")
  const [nicknameInput, setNicknameInput] = React.useState("")
  const [requestId] = React.useState(() => crypto.randomUUID())
  const [isConfirmOpen, setIsConfirmOpen] = React.useState(false)
  const [isPending, startTransition] = React.useTransition()

  const parsedAmount = Number.parseFloat(amount)
  const emailOk = emailSchema.safeParse(contactEmail).success
  const isValid =
    Number.isFinite(parsedAmount) &&
    parsedAmount > 0 &&
    paymentMethod !== null &&
    emailOk
  const balanceAfter = isValid
    ? player.balance + (direction === "in" ? parsedAmount : -parsedAmount)
    : player.balance
  const leavesOwing = direction === "out" && isValid && balanceAfter < 0
  const typedName = knownName ? "" : nameInput.trim().toUpperCase()
  const typedNickname = knownNickname ? "" : nicknameInput.trim().toUpperCase()
  const missingNames =
    withTags && (typedName || typedNickname)
      ? {
          ...(typedName ? { name: typedName } : {}),
          ...(typedNickname ? { nickname: typedNickname } : {}),
        }
      : null

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
        contactEmail: contactEmail.trim(),
        contactPhone: contactPhone.trim(),
        ...(withTags ? { payoutType } : {}),
        ...(missingNames ? { missingNames } : {}),
      })
      if (saved) onDone()
    })
  }

  const confirmation = isValid ? (
    <ConfirmMovementDialog
      open={isConfirmOpen}
      onOpenChange={setIsConfirmOpen}
      kind={direction === "in" ? "receive" : "payout"}
      amount={parsedAmount}
      playerName={knownName || typedName || player.name}
      playerNickname={knownNickname || typedNickname}
      paymentMethod={paymentMethod}
      bank={bank}
      contact={contactText(contactEmail, contactPhone)}
      payoutType={withTags ? payoutType : null}
      onConfirm={handleConfirm}
    />
  ) : null

  return {
    amount,
    setAmount,
    parsedAmount,
    paymentMethod,
    setPaymentMethod,
    bank,
    setBank,
    note,
    setNote,
    contactEmail,
    setContactEmail,
    contactPhone,
    setContactPhone,
    emailOk,
    payoutType,
    setPayoutType,
    knownName,
    knownNickname,
    nameInput,
    setNameInput,
    nicknameInput,
    setNicknameInput,
    isValid,
    isPending,
    balanceAfter,
    leavesOwing,
    openConfirm: () => setIsConfirmOpen(true),
    confirmation,
  }
}

type MovementForm = ReturnType<typeof useMovementForm>

function AmountFields({ form }: { form: MovementForm }) {
  return (
    <>
      <AmountField
        label="Monto"
        value={form.amount}
        onChange={form.setAmount}
        step={0.01}
      />
      <QuickAmounts
        options={PRESET_AMOUNTS.map((p) => ({ label: `$${p}`, amount: p }))}
        current={form.parsedAmount}
        onPick={(value) => form.setAmount(String(value))}
      />
    </>
  )
}

function MethodFields({ form }: { form: MovementForm }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <SelectField label="Método de pago" htmlFor="movement-payment-method">
        <PaymentMethodSelect
          id="movement-payment-method"
          value={form.paymentMethod}
          onChange={form.setPaymentMethod}
          className={SELECTOR_CLASS}
        />
      </SelectField>
      <SelectField label="Banco" htmlFor="movement-bank">
        <BankSelect
          id="movement-bank"
          value={form.bank}
          onChange={form.setBank}
          className={SELECTOR_CLASS}
        />
      </SelectField>
    </div>
  )
}

function Warnings({ form }: { form: MovementForm }) {
  if (!form.emailOk)
    return <FormMessage tone="destructive">El correo no es válido.</FormMessage>
  if (form.leavesOwing)
    return (
      <FormMessage tone="destructive">
        {`El pago es mayor a su saldo a favor: quedará debiendo ${formatMoney(-form.balanceAfter)}.`}
      </FormMessage>
    )
  return null
}

// "Recibir pago" (the player pays the house) and "Registrar pago" (the house
// pays the player) as a panel of the balance dialog in /players. Opens with
// the full balance, editable for a partial payment. Payouts have no limit: a
// warning shows when one leaves the player owing.
export function AccountMovementForm({
  direction,
  player,
  showBalance = true,
  onConfirm,
  onDone,
}: {
  direction: MovementDirection
  player: MovementPlayer
  /** Draw the balance card; false inside the balance dialog, which has its own. */
  showBalance?: boolean
  /** Resolves true when saved; the dialog closes then. */
  onConfirm: (values: MovementValues) => Promise<boolean>
  /** The move was saved: the dialog closes. */
  onDone: () => void
}) {
  const form = useMovementForm({
    direction,
    player,
    withTags: false,
    onConfirm,
    onDone,
  })

  return (
    <PanelBody>
      {showBalance && <BalanceCard balance={player.balance} />}
      <AmountFields form={form} />
      <MethodFields form={form} />

      <ContactFields
        idPrefix="movement"
        email={form.contactEmail}
        phone={form.contactPhone}
        emailOk={form.emailOk}
        onEmailChange={form.setContactEmail}
        onPhoneChange={form.setContactPhone}
      />

      <NotesField id="movement-note" value={form.note} onChange={form.setNote} />

      {form.isValid ? (
        <SummaryRows
          tone={form.leavesOwing ? "destructive" : "default"}
          rows={[
            { label: "Saldo actual", value: signedMoney(player.balance) },
            {
              label: direction === "in" ? "Cobro" : "Pago",
              value: `${direction === "in" ? "+" : "-"}${formatMoney(form.parsedAmount)}`,
            },
          ]}
          total={{ label: "Saldo final", value: signedMoney(form.balanceAfter) }}
        />
      ) : !form.emailOk ? (
        <FormMessage tone="destructive">El correo no es válido.</FormMessage>
      ) : (
        <FormMessage>Ingresa el monto y el método de pago.</FormMessage>
      )}
      {form.leavesOwing && (
        <FormMessage tone="destructive">
          {`El pago es mayor a su saldo a favor: quedará debiendo ${formatMoney(-form.balanceAfter)}.`}
        </FormMessage>
      )}

      <Button
        className="w-full rounded-xl"
        size="lg"
        disabled={!form.isValid || form.isPending}
        onClick={form.openConfirm}
      >
        {direction === "in" ? "Confirmar cobro" : "Confirmar pago"}
      </Button>

      {form.confirmation}
    </PanelBody>
  )
}

/** "Nombre" / "Nickname" of the player: what they have is shown read-only;
 *  a missing one is an input (uppercase as typed) that fills the player. */
function PlayerNameField({
  id,
  label,
  known,
  value,
  maxLength,
  onChange,
}: {
  id: string
  label: string
  /** The player's value; "" when missing. */
  known: string
  value: string
  maxLength: number
  onChange: (value: string) => void
}) {
  return (
    <SelectField label={known ? label : `${label} (falta)`} htmlFor={id}>
      {known ? (
        <Input
          id={id}
          value={known}
          readOnly
          tabIndex={-1}
          className="bg-muted/60 text-muted-foreground"
        />
      ) : (
        <Input
          id={id}
          value={value}
          maxLength={maxLength}
          autoComplete="off"
          placeholder={`Escribe el ${label.toLowerCase()}`}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
        />
      )}
    </SelectField>
  )
}

// The settlement's "Recibir pago" / "Registrar pago": a wide dialog (canvas
// "Opción B · Destinatario + Pago"). Left, who: the balance, the player's
// name and nickname (read-only; a missing one is asked and saved to the
// player) and the contact. Right, the payment: amount, method and bank, Tipo de pago, notes.
// A sticky footer shows before → after and confirms. Stacks on narrow screens.
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
  player: MovementPlayer
  /** Resolves true when saved; the dialog closes then. */
  onConfirm: (values: MovementValues) => Promise<boolean>
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:w-full sm:max-w-[860px]">
        <DialogHeader className="border-b border-dashed px-6 pt-5 pb-4">
          <DialogTitle className="text-lg">
            {direction === "in" ? "Recibir pago" : "Registrar pago"} ·{" "}
            {player.name}
          </DialogTitle>
          <DialogDescription>
            {direction === "in"
              ? "El jugador le entrega dinero a la casa."
              : "La casa le entrega dinero al jugador."}
          </DialogDescription>
        </DialogHeader>
        <MovementDialogBody
          direction={direction}
          player={player}
          onConfirm={onConfirm}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

function MovementDialogBody({
  direction,
  player,
  onConfirm,
  onDone,
}: {
  direction: MovementDirection
  player: MovementPlayer
  onConfirm: (values: MovementValues) => Promise<boolean>
  onDone: () => void
}) {
  const form = useMovementForm({
    direction,
    player,
    withTags: true,
    onConfirm,
    onDone,
  })
  const sign = direction === "in" ? "+" : "−"

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto sm:grid sm:grid-cols-[300px_minmax(0,1fr)]">
        <FieldSection
          title={direction === "out" ? "Destinatario" : "Jugador"}
          className="border-b px-5 py-4 sm:border-r sm:border-b-0 sm:px-6"
        >
          <BalanceCard balance={player.balance} compact />
          <PlayerNameField
            id="movement-player-name"
            label="Nombre"
            known={form.knownName}
            value={form.nameInput}
            maxLength={100}
            onChange={form.setNameInput}
          />
          <PlayerNameField
            id="movement-player-nickname"
            label="Nickname"
            known={form.knownNickname}
            value={form.nicknameInput}
            maxLength={50}
            onChange={form.setNicknameInput}
          />
          <ContactFields
            idPrefix="movement"
            stacked
            email={form.contactEmail}
            phone={form.contactPhone}
            emailOk={form.emailOk}
            onEmailChange={form.setContactEmail}
            onPhoneChange={form.setContactPhone}
          />
        </FieldSection>

        <FieldSection
          title={direction === "out" ? "Pago" : "Cobro"}
          className="px-5 py-4 sm:px-6"
        >
          <AmountFields form={form} />
          <MethodFields form={form} />
          <PayoutTypePills value={form.payoutType} onChange={form.setPayoutType} />
          <NotesField id="movement-note" value={form.note} onChange={form.setNote} />
          <Warnings form={form} />
        </FieldSection>
      </div>

      <SummaryFooter
        tone={form.leavesOwing ? "destructive" : "default"}
        items={[
          { label: "Saldo actual", value: signedMoney(player.balance) },
          {
            label: direction === "in" ? "Cobro" : "Pago",
            value: (
              <>
                {form.isValid ? `${sign}${formatMoney(form.parsedAmount)}` : "—"}
                <PayoutTypeChip value={form.payoutType} />
              </>
            ),
          },
          {
            label: "Saldo final",
            value: signedMoney(form.balanceAfter),
            strong: true,
          },
        ]}
        action={
          <Button
            size="lg"
            className="h-11 rounded-full px-8"
            disabled={!form.isValid || form.isPending}
            onClick={form.openConfirm}
          >
            {direction === "in" ? "Confirmar cobro" : "Confirmar pago"}
          </Button>
        }
      />

      {form.confirmation}
    </>
  )
}
