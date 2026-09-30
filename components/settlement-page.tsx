"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowLeftIcon, CheckCircle2Icon, ChevronDownIcon, LockIcon } from "lucide-react"
import { toast } from "sonner"

import { AccountMovementDialog, type MovementValues } from "@/components/account-movement-dialog"
import { BalanceStatusDialog } from "@/components/balance-status-dialog"
import { useRole } from "@/components/house-provider"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { BalanceStatus } from "@/lib/accounts"
import {
  GAME_ACTION_ERROR_MESSAGES,
  type GameActionResult,
} from "@/lib/data/game-action-result"
import {
  closeSettlement,
  settlementMark,
  settlementPayout,
  settlementReceive,
} from "@/lib/data/settlement-actions"
import { balanceLabel, signedMoney } from "@/lib/round-draft/balance"
import { formatMoney } from "@/lib/rounds"
import {
  resolutionText,
  settlementGroup,
  shownBalance,
  type Settlement,
  type SettlementGroup,
  type SettlementPlayer,
} from "@/lib/settlement"
import { cn } from "@/lib/utils"

type OpenDialog =
  | { kind: "in" | "out"; player: SettlementPlayer }
  | { kind: "status"; player: SettlementPlayer; status: BalanceStatus }
  | null

const GROUP_TITLES: Record<SettlementGroup, string> = {
  collect: "Por cobrar",
  pay: "Por pagar · decide qué pasa con su saldo a favor",
  done: "Completados",
}

function succeeded(result: GameActionResult, message: string): boolean {
  if (result.ok) {
    toast.success(message)
    return true
  }
  if (result.error !== "session_replaced") toast.error(GAME_ACTION_ERROR_MESSAGES[result.error])
  return false
}

function SummaryCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string
  value: string
  detail: string
  tone?: "danger" | "success"
}) {
  return (
    <div className="rounded-xl border bg-muted/30 p-3">
      <div className="text-xs tracking-wide text-muted-foreground uppercase">{label}</div>
      <div
        className={cn(
          "text-xl font-semibold tabular-nums",
          tone === "danger" && "text-destructive",
          tone === "success" && "text-green-600"
        )}
      >
        {value}
      </div>
      <div className="text-xs text-muted-foreground">{detail}</div>
    </div>
  )
}

function DetailItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{signedMoney(value)}</span>
    </div>
  )
}

// /games/[id]/settlement: the task list of an ended game session (Phase 4d2).
// Players are grouped by what's left to do — collect, pay, done — and move to
// "Completados" once resolved. Closing keeps the record read-only.
export function SettlementPage({ settlement }: { settlement: Settlement }) {
  const isAdmin = useRole() === "admin"
  const isOpen = settlement.status === "open"
  const canAct = isAdmin && isOpen
  const [dialog, setDialog] = React.useState<OpenDialog>(null)
  const [expanded, setExpanded] = React.useState<Set<number>>(() => new Set())
  const [isCloseOpen, setIsCloseOpen] = React.useState(false)
  // One request per confirmation dialog: a double click closes once.
  const [closeRequestId, setCloseRequestId] = React.useState(() => crypto.randomUUID())
  const [isPending, startTransition] = React.useTransition()

  const groups: Record<SettlementGroup, SettlementPlayer[]> = { collect: [], pay: [], done: [] }
  for (const player of settlement.players) groups[settlementGroup(player)].push(player)
  // Resolved players go last, in the order they were resolved.
  groups.done.sort((a, b) => (a.resolvedAt ?? "").localeCompare(b.resolvedAt ?? ""))

  const unresolved = groups.collect.length + groups.pay.length
  const sum = (players: SettlementPlayer[]) =>
    players.reduce((total, p) => total + Math.abs(shownBalance(p, settlement.status)), 0)
  const pendingPayouts = settlement.players.filter((p) => p.resolution === "pending_payout")

  function toggle(playerId: number) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(playerId)) next.delete(playerId)
      else next.add(playerId)
      return next
    })
  }

  async function handleMovement(values: MovementValues): Promise<boolean> {
    if (!dialog || dialog.kind === "status") return false
    const input = { gameSessionId: settlement.gameSessionId, playerId: dialog.player.playerId, ...values }
    return dialog.kind === "in"
      ? succeeded(await settlementReceive(input), "Pago recibido")
      : succeeded(await settlementPayout(input), "Pago registrado")
  }

  async function handleStatus(status: BalanceStatus, note: string | null, requestId: string) {
    if (!dialog || dialog.kind !== "status") return false
    return succeeded(
      await settlementMark({
        gameSessionId: settlement.gameSessionId,
        playerId: dialog.player.playerId,
        resolution: status,
        note,
        requestId,
      }),
      "Estado guardado"
    )
  }

  function markForPlay(player: SettlementPlayer) {
    startTransition(async () => {
      succeeded(
        await settlementMark({
          gameSessionId: settlement.gameSessionId,
          playerId: player.playerId,
          resolution: "play",
          note: null,
          requestId: crypto.randomUUID(),
        }),
        `${player.name} deja su saldo para jugar`
      )
    })
  }

  function handleClose() {
    startTransition(async () => {
      if (
        succeeded(
          await closeSettlement({
            gameSessionId: settlement.gameSessionId,
            requestId: closeRequestId,
          }),
          "Liquidación cerrada"
        )
      )
        setIsCloseOpen(false)
    })
  }

  function actions(player: SettlementPlayer, group: SettlementGroup) {
    if (!canAct) return null
    const balance = player.currentBalance
    return (
      <div className="flex flex-wrap gap-2">
        {balance < 0 && (
          <Button size="sm" onClick={() => setDialog({ kind: "in", player })}>
            Recibir pago
          </Button>
        )}
        {balance > 0 && (
          <Button size="sm" onClick={() => setDialog({ kind: "out", player })}>
            Registrar pago
          </Button>
        )}
        {group === "collect" && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setDialog({ kind: "status", player, status: "owes" })}
          >
            Queda debiendo
          </Button>
        )}
        {group === "pay" && (
          <>
            <Button size="sm" variant="outline" disabled={isPending} onClick={() => markForPlay(player)}>
              Para jugar
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDialog({ kind: "status", player, status: "pending_payout" })}
            >
              Pendiente de pago
            </Button>
          </>
        )}
      </div>
    )
  }

  function row(player: SettlementPlayer, group: SettlementGroup) {
    const balance = shownBalance(player, settlement.status)
    const isExpanded = expanded.has(player.playerId)
    return (
      <li
        key={player.playerId}
        className={cn(
          "flex flex-col gap-3 border-b p-4 last:border-b-0",
          group === "done" && "animate-in fade-in slide-in-from-top-2 duration-300"
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              {group === "done" && (
                <CheckCircle2Icon className="size-4 text-green-600" aria-hidden="true" />
              )}
              <span className="font-medium">{player.name}</span>
              {player.inGame && <Badge variant="secondary">En jornada</Badge>}
              <span
                className={cn(
                  "font-semibold tabular-nums",
                  balance < 0 ? "text-destructive" : balance > 0 ? "text-green-600" : "text-muted-foreground"
                )}
              >
                {balanceLabel(balance)}
              </span>
            </div>
            {group === "done" && (
              <span className="text-sm text-muted-foreground">{resolutionText(player)}</span>
            )}
            {group !== "done" && (player.received > 0 || player.paid > 0) && (
              <span className="text-sm text-muted-foreground">
                {player.received > 0 && `Pagó ${formatMoney(player.received)} de su deuda. `}
                {player.paid > 0 && `Se le pagaron ${formatMoney(player.paid)}.`}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {actions(player, group)}
            <Button
              size="sm"
              variant="ghost"
              aria-expanded={isExpanded}
              onClick={() => toggle(player.playerId)}
            >
              Detalle
              <ChevronDownIcon className={cn("transition-transform", isExpanded && "rotate-180")} />
            </Button>
          </div>
        </div>
        {isExpanded && (
          <div className="grid grid-cols-1 gap-x-6 gap-y-1 rounded-lg bg-muted/40 p-3 text-sm sm:grid-cols-2">
            <DetailItem label="Entró con" value={player.openingBalance} />
            <DetailItem label="Jugó" value={player.played} />
            <DetailItem label="Premios" value={player.prizes} />
            <DetailItem label="Recargas en la jornada" value={player.recharges} />
            <DetailItem label="Pagos en la jornada" value={-player.payouts} />
            <DetailItem label="Terminó con" value={player.closingBalance} />
            <DetailItem label="Cobrado en la liquidación" value={player.received} />
            <DetailItem label="Pagado en la liquidación" value={-player.paid} />
          </div>
        )}
      </li>
    )
  }

  return (
    <div className="flex flex-col gap-6 py-4 md:py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button
            variant="link"
            className="h-auto p-0 text-muted-foreground"
            nativeButton={false}
            render={<Link href="/settlement" />}
          >
            <ArrowLeftIcon />
            Liquidaciones
          </Button>
          <h1 className="text-2xl font-semibold">Liquidación · Jornada #{settlement.number}</h1>
          <p className="text-sm text-muted-foreground">
            Terminó el {settlement.endedAtLabel} · {settlement.players.length} jugadores
          </p>
        </div>
        {isOpen ? (
          <Badge
            className={cn(
              "h-7 px-3",
              unresolved > 0
                ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                : "bg-green-500/15 text-green-700 dark:text-green-400"
            )}
          >
            {unresolved > 0 ? `${unresolved} por resolver` : "Todo resuelto"}
          </Badge>
        ) : (
          <Badge variant="secondary" className="h-7 gap-1 px-3">
            <LockIcon className="size-3" />
            Cerrada el {settlement.closedAtLabel}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryCard
          label="Por cobrar"
          value={formatMoney(sum(groups.collect))}
          detail={`${groups.collect.length} jugador${groups.collect.length === 1 ? "" : "es"}`}
          tone="danger"
        />
        <SummaryCard
          label="Por pagar"
          value={formatMoney(sum(groups.pay))}
          detail={`${groups.pay.length} jugador${groups.pay.length === 1 ? "" : "es"}`}
          tone="success"
        />
        <SummaryCard
          label="Pendientes de pago"
          value={formatMoney(sum(pendingPayouts))}
          detail={`${pendingPayouts.length} jugador${pendingPayouts.length === 1 ? "" : "es"}`}
        />
        <SummaryCard
          label="Completados"
          value={`${groups.done.length} de ${settlement.players.length}`}
          detail={unresolved === 0 ? "Nada por resolver" : `Faltan ${unresolved}`}
        />
      </div>

      {(["collect", "pay", "done"] as const).map(
        (group) =>
          groups[group].length > 0 && (
            <section key={group} className="flex flex-col gap-2">
              <h2 className="text-sm font-medium text-muted-foreground">{GROUP_TITLES[group]}</h2>
              <ul className="rounded-xl border">{groups[group].map((p) => row(p, group))}</ul>
            </section>
          )
      )}

      {canAct && (
        <div className="flex justify-end border-t pt-4">
          <Button
            variant={unresolved > 0 ? "outline" : "default"}
            onClick={() => {
              setCloseRequestId(crypto.randomUUID())
              setIsCloseOpen(true)
            }}
          >
            <LockIcon />
            Cerrar liquidación
          </Button>
        </div>
      )}

      {dialog && dialog.kind !== "status" && (
        <AccountMovementDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          direction={dialog.kind}
          player={{
            name: dialog.player.name,
            balance: dialog.player.currentBalance,
            paymentMethod: dialog.player.paymentMethod,
            bank: dialog.player.bank,
          }}
          onConfirm={handleMovement}
        />
      )}
      {dialog && dialog.kind === "status" && (
        <BalanceStatusDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          player={{
            name: dialog.player.name,
            balance: dialog.player.currentBalance,
            status: dialog.status,
            note: dialog.player.note,
          }}
          onConfirm={handleStatus}
        />
      )}

      <AlertDialog open={isCloseOpen} onOpenChange={setIsCloseOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cerrar la liquidación?</AlertDialogTitle>
            <AlertDialogDescription>
              {unresolved > 0
                ? `Quedan ${unresolved} jugador${unresolved === 1 ? "" : "es"} sin resolver; quedarán así en el registro. `
                : "Todos los jugadores están resueltos. "}
              Después solo se podrá consultar; los cobros y pagos siguientes se hacen desde Jugadores.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button disabled={isPending} onClick={handleClose}>
              Cerrar liquidación
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
