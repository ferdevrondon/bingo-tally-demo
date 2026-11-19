"use client"

import { SelectField } from "@/components/balance-dialog-parts"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

// "Correo" and "Teléfono" of a cash move: the same two fields in "Recibir
// pago", "Registrar pago" and the live game's recharge, prefilled from the
// player. Saved on the move and copied to the player; an empty field never
// clears the player's contact (*_payout_contact.sql, *_collection_contact.sql).
export function ContactFields({
  idPrefix,
  stacked = false,
  email,
  phone,
  emailOk,
  onEmailChange,
  onPhoneChange,
}: {
  idPrefix: string
  /** One column (a narrow side column) instead of two. */
  stacked?: boolean
  email: string
  phone: string
  emailOk: boolean
  onEmailChange: (value: string) => void
  onPhoneChange: (value: string) => void
}) {
  return (
    <div className={cn("grid gap-3", stacked ? "grid-cols-1" : "grid-cols-2")}>
      <SelectField
        label="Correo (opcional)"
        htmlFor={`${idPrefix}-contact-email`}
      >
        <Input
          id={`${idPrefix}-contact-email`}
          type="email"
          inputMode="email"
          autoComplete="off"
          value={email}
          maxLength={254}
          aria-invalid={!emailOk}
          onChange={(e) => onEmailChange(e.target.value)}
          placeholder="correo@ejemplo.com"
        />
      </SelectField>
      <SelectField
        label="Teléfono (opcional)"
        htmlFor={`${idPrefix}-contact-phone`}
      >
        <Input
          id={`${idPrefix}-contact-phone`}
          type="tel"
          inputMode="tel"
          autoComplete="off"
          value={phone}
          maxLength={30}
          onChange={(e) => onPhoneChange(e.target.value)}
          placeholder="Ej. 555 123 4567"
        />
      </SelectField>
    </div>
  )
}

/** "correo · teléfono" for the confirmation, or null when both are empty. */
export function contactText(email: string, phone: string): string | null {
  return (
    [email.trim().toLowerCase(), phone.trim()].filter(Boolean).join(" · ") ||
    null
  )
}
