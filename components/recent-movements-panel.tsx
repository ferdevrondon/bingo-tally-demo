"use client"

import * as React from "react"
import {
  ArrowDownLeftIcon,
  ArrowLeftRightIcon,
  ArrowUpRightIcon,
  Undo2Icon,
} from "lucide-react"

import { AmountField, PanelBody } from "@/components/balance-dialog-parts"
import { useHouse } from "@/components/house-provider"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { bankLabel } from "@/lib/banks"
import { formatHouseDate, formatHouseTime } from "@/lib/game-report/format"
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
    ...new Set(
      rows.data.flatMap((r) =>
        r.settlement_id === null ? [] : [r.settlement_id]
      )
    ),
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
      ? {
          id: latest.data.id,
          status: latest.data.status,
          startedAt: latest.data.started_at,
        }
      : null,
    openSettlements: new Set(open.data.map((s) => s.game_session_id)),
    inGame,
  }
  const transfers = toTransferMoves(rows.data, context)
  const counterpartyIds = [...new Set(transfers.map((t) => t.counterpartyId))]
  const names =
    counterpartyIds.length === 0
      ? { data: [], error: null }
      : await supabase
          .from("players")
          .select("id, name")
          .in("id", counterpartyIds)
  if (names.error) throw names.error
  const nameById = new Map(names.data.map((p) => [p.id, p.name]))
  const items: MoveItem[] = [
    ...toCashMoves(rows.data, context).map((move): MoveItem => ({
      kind: "cash",
      move,
    })),
    ...transfers.map((move): MoveItem => ({
      kind: "transfer",
      move,
      counterpartyName: nameById.get(move.counterpartyId) ?? "otro jugador",
    })),
  ]
  return items.sort((a, b) => b.move.id - a.move.id).slice(0, MOVES_SHOWN)
}

function transferTitle(move: TransferMove, counterpartyName: string): string {
  return `${formatMoney(move.amount)} ${move.direction === "out" ? "a" : "de"} ${counterpartyName}`
}

function moveTitle(move: CashMove): string {
  return `${move.type === "recharge" ? "Cobro" : "Pago"} de ${formatMoney(move.amount)}`
}

const ROW_TONES = {
  in: "bg-success/10 text-success",
  out: "bg-warning/15 text-warning-solid",
  transfer: "bg-accent text-accent-foreground",
} as const

interface MoveRowData {
  key: string
  tone: keyof typeof ROW_TONES
  icon: React.ComponentType<{ className?: string }>
  title: string
  /** "Método · Banco · hora". */
  subline: string
  /** Extra line: the correction or the voiding. */
  status: string | null
  /** Signed, e.g. "+$50". */
  amount: string
  positive: boolean
  /** The move was corrected or voided: its amount is shown struck through. */
  struck: boolean
  /** The arrow, or why there is none. */
  action:
    | { kind: "arrow"; label: string; onClick: () => void }
    | { kind: "none"; reason: string }
}

// A flat row: tinted round icon, title and subline, signed amount and the
// correction arrow (a muted dash with the reason when it can't be corrected).
function MoveRow({ row }: { row: MoveRowData }) {
  const Icon = row.icon
  return (
    <li className="flex items-center gap-3 py-3">
      <span
        className={cn(
          "flex size-[30px] shrink-0 items-center justify-center rounded-full",
          ROW_TONES[row.tone]
        )}
      >
        <Icon className="size-4" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[13px] font-medium">{row.title}</span>
        <span className="truncate text-xs text-muted-foreground">
          {row.subline}
        </span>
        {row.status && (
          <span className="truncate text-xs font-medium">{row.status}</span>
        )}
      </span>
      <span
        className={cn(
          "shrink-0 text-[13px] font-medium tabular-nums",
          row.positive && "text-success",
          row.struck && "text-muted-foreground line-through"
        )}
      >
        {row.amount}
      </span>
      {row.action.kind === "arrow" ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={row.action.label}
          onClick={row.action.onClick}
        >
          <Undo2Icon className="text-primary" />
        </Button>
      ) : (
        <span
          title={row.action.reason}
          aria-label={row.action.reason}
          role="img"
          className="flex size-8 shrink-0 items-center justify-center text-muted-foreground"
        >
          —
        </span>
      )}
    </li>
  )
}

const CLOSED_REASON =
  "Ya no se puede corregir: el dinero ya pasó a otra jornada o liquidación."

// "Movimientos" tab of the balance dialog (components/player-balance-dialog.tsx,
// /players and the live player card): the player's latest cobros, pagos and transfers of balance. The ones that can still be
// corrected carry an arrow: the admin picks one, types the correct amount
// (not a +/-) and the reason; the database adds a correction linked to it, so
// the reports show the correct amount and nothing pretends a payment happened.
export function RecentMovementsPanel({
  player,
  onConfirm,
  onVoidTransfer,
  onDone,
}: {
  player: { id: number; name: string; balance: number; inGame: boolean }
  /** Resolves true when saved; the dialog closes then. */
  onConfirm: (values: CorrectionValues) => Promise<boolean>
  /** Voids a transfer of balance; without it transfers are only listed. */
  onVoidTransfer?: (values: VoidTransferValues) => Promise<boolean>
  /** A correction or voiding was saved: the dialog closes. */
  onDone: () => void
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
    if (houseId === null) return
    let cancelled = false
    fetchMoves(houseId, player.id, player.inGame).then(
      (result) => !cancelled && setMoves(result),
      () => !cancelled && setLoadFailed(true)
    )
    return () => {
      cancelled = true
    }
  }, [houseId, player.id, player.inGame])

  function chooseTransfer(move: TransferMove, counterpartyName: string) {
    setSelectedTransfer({ ...move, counterpartyName })
    setReason("")
    setRequestId(crypto.randomUUID())
  }

  function handleVoid() {
    if (
      selectedTransfer === null ||
      !onVoidTransfer ||
      reason.trim() === "" ||
      isPending
    )
      return
    startTransition(async () => {
      const saved = await onVoidTransfer({
        transferId: selectedTransfer.transferId,
        reason: reason.trim(),
        requestId,
      })
      if (saved) onDone()
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
      if (saved) onDone()
    })
  }

  const timeZone = house?.timezone ?? "UTC"

  // The list, one day header per house day (newest first).
  const groups: { day: string; rows: MoveRowData[] }[] = []
  for (const item of moves ?? []) {
    const time = formatHouseTime(item.move.createdAt, timeZone)
    let row: MoveRowData
    if (item.kind === "transfer") {
      const move = item.move
      const out = move.direction === "out"
      const voidable =
        !move.closed && move.voided === null && onVoidTransfer !== undefined
      row = {
        key: `t-${move.id}`,
        tone: "transfer",
        icon: ArrowLeftRightIcon,
        title: `Transferencia ${out ? "a" : "de"} ${item.counterpartyName}`,
        subline: ["No es efectivo", move.note, time]
          .filter(Boolean)
          .join(" · "),
        status: move.voided ? `Anulada · ${move.voided.reason}` : null,
        amount: `${out ? "-" : "+"}${formatMoney(move.amount)}`,
        positive: !out,
        struck: move.voided !== null,
        action: voidable
          ? {
              kind: "arrow",
              label: `Anular: transferencia ${transferTitle(move, item.counterpartyName)}`,
              onClick: () => chooseTransfer(move, item.counterpartyName),
            }
          : {
              kind: "none",
              reason: move.voided
                ? "Ya fue anulada."
                : move.closed
                  ? "Ya no se puede anular: el dinero ya pasó a otra jornada."
                  : "No se puede anular desde aquí.",
            },
      }
    } else {
      const move = item.move
      const incoming = move.type === "recharge"
      const correctable = !move.closed && move.correction === null
      row = {
        key: `c-${move.id}`,
        tone: incoming ? "in" : "out",
        icon: incoming ? ArrowDownLeftIcon : ArrowUpRightIcon,
        title: incoming ? "Cobro" : "Pago",
        subline: [
          move.paymentMethod ? paymentMethodLabel(move.paymentMethod) : null,
          move.bank ? bankLabel(move.bank) : null,
          move.note,
          time,
        ]
          .filter(Boolean)
          .join(" · "),
        status: move.correction
          ? `Corregido a ${formatMoney(move.correction.amount)} · ${move.correction.reason}`
          : null,
        amount: `${incoming ? "+" : "-"}${formatMoney(move.amount)}`,
        positive: incoming,
        struck: move.correction !== null,
        action: correctable
          ? {
              kind: "arrow",
              label: `Corregir: ${moveTitle(move)}`,
              onClick: () => choose(move),
            }
          : {
              kind: "none",
              reason: move.correction ? "Ya fue corregido." : CLOSED_REASON,
            },
      }
    }
    const day = formatHouseDate(item.move.createdAt, timeZone)
    const last = groups[groups.length - 1]
    if (last?.day === day) last.rows.push(row)
    else groups.push({ day, rows: [row] })
  }

  return (
    <PanelBody>
      <p className="text-xs text-muted-foreground">
        {selectedTransfer
          ? "Anular transferencia: se conserva y queda su anulación con el motivo; el saldo vuelve a cada jugador."
          : selected
            ? "Corregir movimiento: escribe el monto que debió registrarse. El original se conserva y queda la corrección con su motivo."
            : "Toca la flecha de un movimiento para corregirlo o anularlo."}
      </p>

      {selected === null && selectedTransfer === null ? (
        loadFailed ? (
          <p className="text-sm text-destructive">
            No se pudieron cargar los movimientos.
          </p>
        ) : moves === null ? (
          <p className="text-sm text-muted-foreground">Cargando movimientos…</p>
        ) : moves.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {player.name} no tiene cobros, pagos ni transferencias registrados.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {groups.map((group) => (
              <section key={group.day}>
                <h3 className="text-[11px] font-medium text-muted-foreground first-letter:uppercase">
                  {group.day}
                </h3>
                <ul className="divide-y">
                  {group.rows.map((row) => (
                    <MoveRow key={row.key} row={row} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )
      ) : selectedTransfer !== null ? (
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between gap-2 rounded-xl bg-muted/50 p-3">
            <div>
              <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Registrada
              </div>
              <div className="font-semibold tabular-nums">
                {transferTitle(
                  selectedTransfer,
                  selectedTransfer.counterpartyName
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedTransfer(null)}
            >
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
            Se anula para los dos jugadores. No se puede si el dinero ya cambió
            de jornada o si quien lo recibió ya no tiene ese saldo.
          </p>
        </div>
      ) : selected !== null ? (
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between gap-2 rounded-xl bg-muted/50 p-3">
            <div>
              <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Registrado
              </div>
              <div className="font-semibold tabular-nums">
                {moveTitle(selected)}
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
              Volver
            </Button>
          </div>

          <AmountField
            label="Monto correcto"
            value={amount}
            onChange={setAmount}
            step={0.01}
            autoFocus
            hint="Pon 0 si el movimiento no debió registrarse."
          />

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
        <Button
          className="w-full rounded-xl"
          size="lg"
          variant="destructive"
          disabled={reason.trim() === "" || isPending}
          onClick={handleVoid}
        >
          Anular transferencia
        </Button>
      )}
      {selected && (
        <Button
          className="w-full rounded-xl"
          size="lg"
          disabled={!isValid || isPending}
          onClick={handleConfirm}
        >
          {Number.isFinite(parsedAmount) && parsedAmount >= 0
            ? `Corregir a ${formatMoney(parsedAmount)}`
            : "Corregir"}
        </Button>
      )}
    </PanelBody>
  )
}
