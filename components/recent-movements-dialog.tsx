"use client"

import * as React from "react"
import { Undo2Icon } from "lucide-react"

import { useHouse } from "@/components/house-provider"
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
import { bankLabel } from "@/lib/banks"
import { formatHouseDateTime } from "@/lib/game-report/format"
import {
  correctionDelta,
  toCashMoves,
  toTransferMoves,
  type CashMove,
  type TransferMove,
} from "@/lib/movements"
import { paymentMethodLabel } from "@/lib/payment-methods"
import { signedMoney } from "@/lib/round-draft/balance"
import { formatMoney } from "@/lib/rounds"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

const MOVES_SHOWN = 10

export interface VoidTransferValues {
  transferId: string
  reason: string
  /** One per chosen transfer: a double click voids it once. */
  requestId: string
}

/** What the list shows: a cobro / pago or a transfer of balance. */
type MoveItem =
  | { kind: "cash"; move: CashMove }
  | { kind: "transfer"; move: TransferMove; counterpartyName: string }

export interface CorrectionValues {
  movementId: number
  amount: number
  reason: string
  /** One per chosen move: a double click records the correction once. */
  requestId: string
}

async function fetchMoves(houseId: number, playerId: number, inGame: boolean) {
  const supabase = createClient()
  const [rows, latest] = await Promise.all([
    supabase
      .from("activity_log")
      .select(
        "id, created_at, type, amount, payment_method, bank, note, game_session_id, settlement_id, corrects_id, transfer_id, counterparty_player_id"
      )
      .eq("house_id", houseId)
      .eq("player_id", playerId)
      .in("type", ["recharge", "payout", "balance_transfer"])
      .order("id", { ascending: false })
      .limit(MOVES_SHOWN * 3),
    supabase
      .from("game_sessions")
      .select("id, status, started_at")
      .eq("house_id", houseId)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])
  if (rows.error) throw rows.error
  if (latest.error) throw latest.error
  const settlementIds = [
    ...new Set(rows.data.flatMap((r) => (r.settlement_id === null ? [] : [r.settlement_id]))),
  ]
  const open =
    settlementIds.length === 0
      ? { data: [], error: null }
      : await supabase
          .from("settlements")
          .select("game_session_id")
          .in("game_session_id", settlementIds)
          .eq("status", "open")
  if (open.error) throw open.error
  const context = {
    latestGameSession: latest.data
      ? { id: latest.data.id, status: latest.data.status, startedAt: latest.data.started_at }
      : null,
    openSettlements: new Set(open.data.map((s) => s.game_session_id)),
    inGame,
  }
  const transfers = toTransferMoves(rows.data, context)
  const counterpartyIds = [...new Set(transfers.map((t) => t.counterpartyId))]
  const names =
    counterpartyIds.length === 0
      ? { data: [], error: null }
      : await supabase.from("players").select("id, name").in("id", counterpartyIds)
  if (names.error) throw names.error
  const nameById = new Map(names.data.map((p) => [p.id, p.name]))
  const items: MoveItem[] = [
    ...toCashMoves(rows.data, context).map((move): MoveItem => ({ kind: "cash", move })),
    ...transfers.map(
      (move): MoveItem => ({
        kind: "transfer",
        move,
        counterpartyName: nameById.get(move.counterpartyId) ?? "otro jugador",
      })
    ),
  ]
  return items.sort((a, b) => b.move.id - a.move.id).slice(0, MOVES_SHOWN)
}

function transferTitle(move: TransferMove, counterpartyName: string): string {
  return `${formatMoney(move.amount)} ${move.direction === "out" ? "a" : "de"} ${counterpartyName}`
}

function moveTitle(move: CashMove): string {
  return `${move.type === "recharge" ? "Cobro" : "Pago"} de ${formatMoney(move.amount)}`
}

// "Últimos movimientos" (/players, the live player card and its recharge
// dialog): the player's latest cobros, pagos and transfers of balance. The ones that can still be
// corrected carry an arrow: the admin picks one, types the correct amount
// (not a +/-) and the reason; the database adds a correction linked to it, so
// the reports show the correct amount and nothing pretends a payment happened.
export function RecentMovementsDialog({
  open,
  onOpenChange,
  player,
  onConfirm,
  onVoidTransfer,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  player: { id: number; name: string; balance: number; inGame: boolean }
  /** Resolves true when saved; the dialog closes then. */
  onConfirm: (values: CorrectionValues) => Promise<boolean>
  /** Voids a transfer of balance; without it transfers are only listed. */
  onVoidTransfer?: (values: VoidTransferValues) => Promise<boolean>
}) {
  const house = useHouse()
  const [moves, setMoves] = React.useState<MoveItem[] | null>(null)
  const [loadFailed, setLoadFailed] = React.useState(false)
  const [selected, setSelected] = React.useState<CashMove | null>(null)
  const [selectedTransfer, setSelectedTransfer] = React.useState<
    (TransferMove & { counterpartyName: string }) | null
  >(null)
  const [amount, setAmount] = React.useState("")
  const [reason, setReason] = React.useState("")
  const [requestId, setRequestId] = React.useState(() => crypto.randomUUID())
  const [isPending, startTransition] = React.useTransition()

  const houseId = house?.houseId ?? null
  React.useEffect(() => {
    if (!open || houseId === null) return
    let cancelled = false
    fetchMoves(houseId, player.id, player.inGame).then(
      (result) => !cancelled && setMoves(result),
      () => !cancelled && setLoadFailed(true)
    )
    return () => {
      cancelled = true
    }
  }, [open, houseId, player.id, player.inGame])

  // Reset each time the dialog opens (state adjusted during render).
  const [wasOpen, setWasOpen] = React.useState(false)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setMoves(null)
      setLoadFailed(false)
      setSelected(null)
      setSelectedTransfer(null)
    }
  }

  function chooseTransfer(move: TransferMove, counterpartyName: string) {
    setSelectedTransfer({ ...move, counterpartyName })
    setReason("")
    setRequestId(crypto.randomUUID())
  }

  function handleVoid() {
    if (selectedTransfer === null || !onVoidTransfer || reason.trim() === "" || isPending) return
    startTransition(async () => {
      const saved = await onVoidTransfer({
        transferId: selectedTransfer.transferId,
        reason: reason.trim(),
        requestId,
      })
      if (saved) onOpenChange(false)
    })
  }

  function choose(move: CashMove) {
    setSelected(move)
    setAmount("")
    setReason("")
    setRequestId(crypto.randomUUID())
  }

  const parsedAmount = Number.parseFloat(amount)
  const isValid =
    selected !== null &&
    Number.isFinite(parsedAmount) &&
    parsedAmount >= 0 &&
    parsedAmount !== selected.amount &&
    reason.trim() !== ""
  const balanceAfter =
    selected && Number.isFinite(parsedAmount) && parsedAmount >= 0
      ? player.balance + correctionDelta(selected, parsedAmount)
      : null

  function handleConfirm() {
    if (!isValid || selected === null || isPending) return
    startTransition(async () => {
      const saved = await onConfirm({
        movementId: selected.id,
        amount: parsedAmount,
        reason: reason.trim(),
        requestId,
      })
      if (saved) onOpenChange(false)
    })
  }

  const timeZone = house?.timezone ?? "UTC"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 p-0">
        <DialogHeader className="p-6">
          <DialogTitle className="text-xl">
            {selectedTransfer
              ? "Anular transferencia"
              : selected
                ? "Corregir movimiento"
                : "Últimos movimientos"}{" "}
            · {player.name}
          </DialogTitle>
          <DialogDescription>
            {selectedTransfer
              ? "La transferencia se conserva y queda su anulación con el motivo; el saldo vuelve a cada jugador."
              : selected
                ? "Escribe el monto que debió registrarse. El movimiento original se conserva y queda la corrección con su motivo."
                : "Toca un movimiento con la flecha para corregirlo o anularlo."}
          </DialogDescription>
        </DialogHeader>

        <Separator className="border-t border-dashed border-border bg-transparent" />

        {selected === null && selectedTransfer === null ? (
          <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto p-6">
            {loadFailed ? (
              <p className="text-sm text-destructive">No se pudieron cargar los movimientos.</p>
            ) : moves === null ? (
              <p className="text-sm text-muted-foreground">Cargando movimientos…</p>
            ) : moves.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {player.name} no tiene cobros, pagos ni transferencias registrados.
              </p>
            ) : (
              moves.map((item) => {
                if (item.kind === "transfer") {
                  const { move } = item
                  const voidable = !move.closed && move.voided === null && onVoidTransfer !== undefined
                  const details = (
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex items-baseline justify-between gap-2">
                        <span
                          className={cn(
                            "font-semibold tabular-nums",
                            move.voided && "line-through"
                          )}
                        >
                          Transferencia {move.direction === "out" ? "a" : "de"}{" "}
                          {item.counterpartyName}: {formatMoney(move.amount)}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatHouseDateTime(move.createdAt, timeZone)}
                        </span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {move.note || "Saldo entre jugadores (no es efectivo)"}
                      </span>
                      {move.voided && (
                        <span className="text-xs font-medium">Anulada · {move.voided.reason}</span>
                      )}
                    </span>
                  )
                  return voidable ? (
                    <button
                      key={`t-${move.id}`}
                      type="button"
                      onClick={() => chooseTransfer(move, item.counterpartyName)}
                      aria-label={`Anular: transferencia ${transferTitle(move, item.counterpartyName)}`}
                      className="flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted"
                    >
                      {details}
                      <Undo2Icon className="size-4 shrink-0 text-primary" />
                    </button>
                  ) : (
                    <div key={`t-${move.id}`} className="flex items-center gap-3 rounded-lg border p-3">
                      {details}
                    </div>
                  )
                }
                const move = item.move
                const correctable = !move.closed && move.correction === null
                const details = (
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex items-baseline justify-between gap-2">
                      <span
                        className={cn(
                          "font-semibold tabular-nums",
                          move.correction && "line-through"
                        )}
                      >
                        {moveTitle(move)}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatHouseDateTime(move.createdAt, timeZone)}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {[
                        move.paymentMethod ? paymentMethodLabel(move.paymentMethod) : null,
                        move.bank ? bankLabel(move.bank) : null,
                        move.note,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </span>
                    {move.correction && (
                      <span className="text-xs font-medium">
                        Corregido a {formatMoney(move.correction.amount)} · {move.correction.reason}
                      </span>
                    )}
                  </span>
                )
                // Only a move that can still be corrected is a button, with the arrow.
                return correctable ? (
                  <button
                    key={`c-${move.id}`}
                    type="button"
                    onClick={() => choose(move)}
                    aria-label={`Corregir: ${moveTitle(move)}`}
                    className="flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted"
                  >
                    {details}
                    <Undo2Icon className="size-4 shrink-0 text-primary" />
                  </button>
                ) : (
                  <div key={`c-${move.id}`} className="flex items-center gap-3 rounded-lg border p-3">
                    {details}
                  </div>
                )
              })
            )}
          </div>
        ) : selectedTransfer !== null ? (
          <div className="flex flex-col gap-5 p-6">
            <div className="flex items-center justify-between gap-2 rounded-lg border p-3">
              <div>
                <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Registrada
                </div>
                <div className="font-semibold tabular-nums">
                  {transferTitle(selectedTransfer, selectedTransfer.counterpartyName)}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedTransfer(null)}>
                Volver
              </Button>
            </div>

            <Field>
              <FieldLabel htmlFor="void-transfer-reason">Motivo</FieldLabel>
              <Input
                id="void-transfer-reason"
                value={reason}
                maxLength={200}
                autoFocus
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ej. se equivocó de jugador"
              />
            </Field>

            <p className="text-xs text-muted-foreground">
              Se anula para los dos jugadores. No se puede si el dinero ya cambió de jornada o si quien
              lo recibió ya no tiene ese saldo.
            </p>
          </div>
        ) : selected !== null ? (
          <div className="flex flex-col gap-5 p-6">
            <div className="flex items-center justify-between gap-2 rounded-lg border p-3">
              <div>
                <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Registrado
                </div>
                <div className="font-semibold tabular-nums">{moveTitle(selected)}</div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
                Volver
              </Button>
            </div>

            <div>
              <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Monto correcto
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-muted-foreground">$</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={0.01}
                  placeholder="0"
                  aria-label="Monto correcto"
                  value={amount}
                  autoFocus
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full min-w-0 appearance-none border-none bg-transparent text-4xl font-bold tabular-nums text-foreground outline-none placeholder:text-muted-foreground [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Pon 0 si el movimiento no debió registrarse.
              </p>
            </div>

            <Field>
              <FieldLabel htmlFor="correction-reason">Motivo</FieldLabel>
              <Input
                id="correction-reason"
                value={reason}
                maxLength={200}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ej. se escribió 1000 en vez de 100"
              />
            </Field>

            <p className="text-xs text-muted-foreground">
              {!Number.isFinite(parsedAmount) || parsedAmount < 0
                ? "Ingresa el monto correcto y el motivo."
                : parsedAmount === selected.amount
                  ? "Es el mismo monto que se registró."
                  : `Su saldo pasará de ${signedMoney(player.balance)} a ${signedMoney(balanceAfter ?? player.balance)}.`}
            </p>
          </div>
        ) : null}

        {selectedTransfer && (
          <DialogFooter>
            <Button
              className="w-full"
              size="lg"
              variant="destructive"
              disabled={reason.trim() === "" || isPending}
              onClick={handleVoid}
            >
              Anular transferencia
            </Button>
          </DialogFooter>
        )}
        {selected && (
          <DialogFooter>
            <Button
              className="w-full"
              size="lg"
              disabled={!isValid || isPending}
              onClick={handleConfirm}
            >
              {Number.isFinite(parsedAmount) && parsedAmount >= 0
                ? `Corregir a ${formatMoney(parsedAmount)}`
                : "Corregir"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
