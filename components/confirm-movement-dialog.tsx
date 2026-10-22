"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { bankLabel, type Bank } from "@/lib/banks"
import { isLargeAmount } from "@/lib/movements"
import { paymentMethodLabel, type PaymentMethod } from "@/lib/payment-methods"
import { formatMoney } from "@/lib/rounds"

const KIND_LABELS = { recharge: "Recarga", receive: "Cobro", payout: "Pago" } as const

// The last look before any cash move is recorded (recarga in the live game,
// "Recibir pago", "Registrar pago"): a typo like 1000 for 100 is caught here
// instead of needing a correction in "Últimos movimientos" later. Confirming
// is what records the move.
export function ConfirmMovementDialog({
  open,
  onOpenChange,
  kind,
  amount,
  playerName,
  paymentMethod,
  bank,
  usual = null,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  kind: keyof typeof KIND_LABELS
  amount: number
  playerName: string
  paymentMethod: PaymentMethod | null
  bank: Bank | null
  /** The player's usual amount, when known (marks a large amount). */
  usual?: number | null
  onConfirm: () => void
}) {
  const details = [
    KIND_LABELS[kind],
    paymentMethod ? paymentMethodLabel(paymentMethod) : null,
    bank ? bankLabel(bank) : null,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Confirmas esta transacción?</AlertDialogTitle>
          <AlertDialogDescription>
            Vas a registrar{" "}
            <span className="font-semibold text-foreground tabular-nums">{formatMoney(amount)}</span>{" "}
            para <span className="font-semibold text-foreground">{playerName}</span>.
          </AlertDialogDescription>
          <p className="text-sm text-muted-foreground">{details}</p>
          {isLargeAmount(amount, usual) && (
            <p className="text-sm font-medium text-destructive">
              Es un monto alto: revisa que esté bien escrito.
            </p>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              onConfirm()
              onOpenChange(false)
            }}
          >
            Sí, registrar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
