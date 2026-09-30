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
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { BALANCE_STATUS_LABELS, type BalanceStatus } from "@/lib/accounts"
import { balanceLabel } from "@/lib/round-draft/balance"

const DESCRIPTIONS: Record<BalanceStatus, string> = {
  play: "Deja su saldo en la casa para seguir jugando.",
  pending_payout: "Se le debía pagar pero no se pudo. Anota por qué.",
  owes: "No pagó ahora. Puedes anotar cuándo lo hará.",
}

// The status of a balance that isn't settled with money: a positive balance
// is left "Para jugar" or stays "Pendiente de pago" (note required); a debt
// stays "Debe" with an optional note ("paga el viernes").
export function BalanceStatusDialog({
  open,
  onOpenChange,
  player,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  player: { name: string; balance: number; status: BalanceStatus | null; note: string | null }
  /** Resolves true when saved; the dialog closes then. */
  onConfirm: (status: BalanceStatus, note: string | null, requestId: string) => Promise<boolean>
}) {
  const options: BalanceStatus[] = player.balance < 0 ? ["owes"] : ["play", "pending_payout"]
  const [status, setStatus] = React.useState<BalanceStatus>(options[0])
  const [note, setNote] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [requestId, setRequestId] = React.useState(() => crypto.randomUUID())
  const [isPending, startTransition] = React.useTransition()

  // Starts closed so a dialog mounted already open is reset too.
  const [wasOpen, setWasOpen] = React.useState(false)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setStatus(player.status && options.includes(player.status) ? player.status : options[0])
      setNote(player.note ?? "")
      setError(null)
      setRequestId(crypto.randomUUID())
    }
  }

  function handleConfirm() {
    const trimmed = note.trim()
    if (status === "pending_payout" && !trimmed) {
      setError("Anota por qué no se pudo pagar.")
      return
    }
    startTransition(async () => {
      if (await onConfirm(status, trimmed || null, requestId)) onOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Estado del saldo · {player.name}</DialogTitle>
          <DialogDescription>{balanceLabel(player.balance)}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 px-6">
          {options.length > 1 && (
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Estado">
              {options.map((option) => (
                <Button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={status === option}
                  variant={status === option ? "default" : "outline"}
                  onClick={() => {
                    setStatus(option)
                    setError(null)
                  }}
                >
                  {BALANCE_STATUS_LABELS[option]}
                </Button>
              ))}
            </div>
          )}
          <p className="text-sm text-muted-foreground">{DESCRIPTIONS[status]}</p>
          <Field data-invalid={error !== null}>
            <FieldLabel htmlFor="balance-status-note">
              Nota{status === "pending_payout" ? "" : " (opcional)"}
            </FieldLabel>
            <Textarea
              id="balance-status-note"
              value={note}
              maxLength={200}
              aria-invalid={error !== null}
              onChange={(e) => {
                setNote(e.target.value)
                setError(null)
              }}
              placeholder={status === "owes" ? "Paga el viernes" : "No localizado"}
            />
            {error && <FieldError>{error}</FieldError>}
          </Field>
        </div>
        <DialogFooter className="flex-row justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={isPending} onClick={handleConfirm}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
