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

const KIND_LABELS = {
  recharge: "Recarga",
  receive: "Cobro",
  payout: "Pago",
  transfer: "Transferencia de saldo",
} as const

// The last look before any cash move is recorded (recarga in the live game,
// "Recibir pago", "Registrar pago") or a balance is handed to another player: a typo like 1000 for 100 is caught here
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
  toPlayerName,
  contact = null,
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
  /** kind "transfer": the player who receives it (`playerName` gives it). */
  toPlayerName?: string
  /** kind "payout": the email / phone it went to, when given. */
  contact?: string | null
  /** The player's usual amount, when known (marks a large amount). */
  usual?: number | null
  onConfirm: () => void
}) {
  const details = [
    KIND_LABELS[kind],
    paymentMethod ? paymentMethodLabel(paymentMethod) : null,
    bank ? bankLabel(bank) : null,
    contact,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Confirmas esta transacción?</AlertDialogTitle>
          <AlertDialogDescription>
            {kind === "transfer" ? "Vas a transferir" : "Vas a registrar"}{" "}
            <span className="font-semibold text-foreground tabular-nums">{formatMoney(amount)}</span>{" "}
            {kind === "transfer" ? (
              <>
                de <span className="font-semibold text-foreground">{playerName}</span> a{" "}
                <span className="font-semibold text-foreground">{toPlayerName}</span>.
              </>
            ) : (
              <>
                para <span className="font-semibold text-foreground">{playerName}</span>.
              </>
            )}
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
            {kind === "transfer" ? "Sí, transferir" : "Sí, registrar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
