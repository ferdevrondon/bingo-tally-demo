"use client"

import { toast } from "sonner"

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
import { signedMoney } from "@/lib/round-draft/balance"
import { useRoundDraft } from "@/lib/round-draft/context"
import {
  removalPreview,
  removalSummaryParts,
} from "@/lib/round-draft/remove-player"
import { formatMoney } from "@/lib/rounds"
import { cn } from "@/lib/utils"

/** "Debe $30", "A favor $50" or "Al día". */
function balanceWords(balance: number): string {
  if (balance < 0) return `Debe ${formatMoney(-balance)}`
  if (balance > 0) return `A favor ${formatMoney(balance)}`
  return "Al día"
}

function BalanceRow({ label, balance }: { label: string; balance: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">
        <span
          className={cn(
            "font-semibold tabular-nums",
            balance >= 0 ? "text-success" : "text-destructive"
          )}
        >
          {signedMoney(balance)}
        </span>
        <span className="ml-1.5 text-xs text-muted-foreground">
          {balanceWords(balance)}
        </span>
      </span>
    </div>
  )
}

/** One line of the summary: a signed amount that moved the balance. */
function MoveRow({
  label,
  amount,
  hint,
  empty,
}: {
  label: string
  amount: number
  hint?: string
  /** Shown instead of $0. */
  empty?: string
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-muted-foreground">{label}</span>
        {amount === 0 && empty ? (
          <span className="text-xs text-muted-foreground">{empty}</span>
        ) : (
          <span className="font-medium tabular-nums">
            {signedMoney(amount)}
          </span>
        )}
      </div>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  )
}

/** Confirms removing a player from the game session ("Retirar jugador", or
 *  a player left with no numbers): shows the balance they opened the game
 *  session with and the one they leave with, then removes them and says so
 *  in a toast. public.remove_player logs the same two balances. */
export function RemovePlayerDialog({
  player,
  open,
  onOpenChange,
  reason = "manual",
  onConfirmed,
}: {
  player: { id: number; name: string }
  open: boolean
  onOpenChange: (open: boolean) => void
  /** "no-numbers": the player was left with no numbers (Editar jugada, or
   *  their last number tapped on the tickets). */
  reason?: "manual" | "no-numbers"
  onConfirmed?: () => void
}) {
  const { state, removePlayer } = useRoundDraft()
  const preview = removalPreview(state, player.id)
  const {
    openingBalance,
    recharges,
    played,
    prizes,
    payouts,
    transfers,
    refund,
  } = preview
  const { closingBalance } = preview

  function handleConfirm() {
    removePlayer(player.id)
    const parts = removalSummaryParts({
      ...preview,
      opening: openingBalance,
      closing: closingBalance,
    })
    const description = parts.join(" · ")
    toast.success(`${player.name} se retiró de la jornada`, {
      description: description.charAt(0).toUpperCase() + description.slice(1),
    })
    onOpenChange(false)
    onConfirmed?.()
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            ¿Retirar a {player.name} de la jornada?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {reason === "no-numbers"
              ? `${player.name} se queda sin números, así que se retira de la jornada. `
              : ""}
            Sus números quedarán disponibles de nuevo en los cartones y su saldo
            pasa a la liquidación.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
          <BalanceRow label="Comenzó la jornada con" balance={openingBalance} />
          <MoveRow label="Recargas" amount={recharges} />
          <MoveRow
            label="Jugadas"
            amount={-played}
            hint={
              refund > 0
                ? `Ya descuenta la devolución de ${formatMoney(refund)} de esta ronda`
                : undefined
            }
          />
          <MoveRow label="Premios" amount={prizes} empty="Sin premios" />
          {payouts !== 0 && (
            <MoveRow label="Pagos recibidos" amount={payouts} />
          )}
          {transfers !== 0 && (
            <MoveRow label="Transferencias" amount={transfers} />
          )}
          <div className="border-t pt-2">
            <BalanceRow label="Se retira con" balance={closingBalance} />
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive/10 text-destructive hover:bg-destructive/20"
            onClick={handleConfirm}
          >
            Retirar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
