import { TriangleAlertIcon } from "lucide-react"

import { formatMoney } from "@/lib/rounds"

// Second look before recording a large cobro, pago or recarga (isLargeAmount
// in lib/movements.ts): a typo like 1000 for 100 is caught here instead of
// needing "Corregir movimiento" later.
export function LargeAmountWarning({
  amount,
  playerName,
  usual,
}: {
  amount: number
  playerName: string
  /** The player's usual amount, when known. */
  usual?: number | null
}) {
  return (
    <div
      role="alert"
      className="flex gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm"
    >
      <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
      <div className="flex flex-col gap-0.5">
        <span className="font-semibold">
          Vas a registrar {formatMoney(amount)} para {playerName}.
        </span>
        <span className="text-muted-foreground">
          {usual
            ? `Es mucho más que su último monto (${formatMoney(usual)}). `
            : "Es un monto alto. "}
          Revisa que esté bien escrito antes de confirmar.
        </span>
      </div>
    </div>
  )
}
