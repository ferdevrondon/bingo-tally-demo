"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { PlusIcon } from "lucide-react"
import { toast } from "sonner"

import {
  AccountMovementForm,
  type MovementDirection,
  type MovementValues,
} from "@/components/account-movement-dialog"
import { BalanceStatusDialog } from "@/components/balance-status-dialog"
import {
  BalanceTransferForm,
  type TransferValues,
} from "@/components/balance-transfer-form"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { PlayerBalanceDialog } from "@/components/player-balance-dialog"
import {
  RecentMovementsPanel,
  type CorrectionValues,
  type VoidTransferValues,
} from "@/components/recent-movements-panel"
import {
  DataTable,
  type DataTableColumnDef,
  type DataRow,
} from "@/components/data-table"
import { useRole } from "@/components/house-provider"
import { PlayerForm } from "@/components/player-form"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  accountStatusText,
  type BalanceStatus,
  type PlayerAccount,
} from "@/lib/accounts"
import {
  correctMovement,
  receivePayment,
  registerPayout,
  setBalanceStatus,
  transferBalance,
  voidTransfer,
} from "@/lib/data/account-actions"
import {
  GAME_ACTION_ERROR_MESSAGES,
  type GameActionResult,
} from "@/lib/data/game-action-result"
import {
  createPlayer,
  deactivatePlayer,
  updatePlayer,
} from "@/lib/data/player-actions"
import { BANK_OPTIONS_WITH_NONE, bankLabel, isBank, NO_BANK } from "@/lib/banks"
import {
  isPaymentMethod,
  PAYMENT_METHOD_OPTIONS,
  paymentMethodLabel,
} from "@/lib/payment-methods"
import { GiftHistoryButton, PlayerGiftsDialog } from "@/components/player-gifts-dialog"
import type { ActiveGiftedPlayers } from "@/lib/data/gifts"
import type { Player, PlayerInput } from "@/lib/players"
import { signedMoney } from "@/lib/round-draft/balance"
import { sortPlayersByName } from "@/lib/round-draft/selectors"
import { cn } from "@/lib/utils"
import { writeSucceeded } from "@/lib/write-feedback"

function toInput(player: Player): PlayerInput {
  return {
    name: player.name,
    nickname: player.nickname,
    paymentMethod: player.paymentMethod,
    bank: player.bank,
    phone: player.phone,
    email: player.email,
    isVip: player.isVip,
  }
}

type AccountDialog = {
  kind: "balance" | "status"
  player: Player
  account: PlayerAccount
} | null

/** A player with no account row yet has $0. */
function accountFrom(
  accounts: Map<number, PlayerAccount>,
  playerId: number
): PlayerAccount {
  return (
    accounts.get(playerId) ?? {
      playerId,
      balance: 0,
      status: null,
      note: null,
      inGame: false,
    }
  )
}

function succeeded(result: GameActionResult, message: string): boolean {
  if (result.ok) {
    toast.success(message)
    return true
  }
  if (result.error !== "session_replaced")
    toast.error(GAME_ACTION_ERROR_MESSAGES[result.error])
  return false
}

/** "Cobro / Pago" tab: the player pays the house or the house pays them. It
 *  opens on the direction that settles a debt (cobro) or a balance in favor
 *  (pago); each direction is its own form, so its amount starts fresh. */
function MoneyTab({
  player,
  account,
  onConfirm,
  onDone,
}: {
  player: Player
  account: PlayerAccount
  onConfirm: (
    direction: MovementDirection,
    values: MovementValues
  ) => Promise<boolean>
  onDone: () => void
}) {
  const [direction, setDirection] = React.useState<MovementDirection>(
    account.balance < 0 ? "in" : "out"
  )
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-4 flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          aria-pressed={direction === "in"}
          className={cn(
            "rounded-full font-normal",
            direction === "in" && "border-foreground/50 bg-muted font-medium"
          )}
          onClick={() => setDirection("in")}
        >
          Recibir pago
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          aria-pressed={direction === "out"}
          className={cn(
            "rounded-full font-normal",
            direction === "out" && "border-foreground/50 bg-muted font-medium"
          )}
          onClick={() => setDirection("out")}
        >
          Registrar pago
        </Button>
      </div>
      <AccountMovementForm
        key={direction}
        direction={direction}
        showBalance={false}
        player={{
          name: player.name,
          balance: account.balance,
          paymentMethod: player.paymentMethod,
          bank: player.bank,
          email: player.email,
          phone: player.phone,
        }}
        onConfirm={(values) => onConfirm(direction, values)}
        onDone={onDone}
      />
    </div>
  )
}

// /players: catálogo de jugadores de la casa con el saldo de su cuenta (pasa
// de una jornada a otra, Fase 4d) y su estado. Cobros, pagos y el estado del
// saldo se registran aquí en cualquier momento; si el jugador está en la
// jornada activa, el movimiento va a la jornada.
export default function PlayerPage({
  players,
  accounts,
  activeGifts = null,
}: {
  players: Player[]
  accounts: PlayerAccount[]
  /** Who received gifts in the active game session (lib/data/gifts.ts): they
   *  show the gift box button. null without an active game session. */
  activeGifts?: ActiveGiftedPlayers | null
}) {
  const router = useRouter()
  const isAdmin = useRole() === "admin"
  const gifted = React.useMemo(() => new Set(activeGifts?.playerIds ?? []), [activeGifts])
  // The player whose gifts of the active game session are open.
  const [giftsFor, setGiftsFor] = React.useState<{ id: number; name: string } | null>(null)
  const [isAddPlayerOpen, setIsAddPlayerOpen] = React.useState(false)
  const [editingPlayer, setEditingPlayer] = React.useState<Player | null>(null)
  const [deletingPlayer, setDeletingPlayer] = React.useState<Player | null>(
    null
  )
  const [accountDialog, setAccountDialog] = React.useState<AccountDialog>(null)
  const accountById = React.useMemo(
    () => new Map(accounts.map((a) => [a.playerId, a])),
    [accounts]
  )

  const rows = React.useMemo<DataRow[]>(
    () =>
      sortPlayersByName(players).map((player) => ({
        id: player.id,
        name: player.name,
        nickname: player.nickname,
        contact: [player.phone, player.email].filter(Boolean).join("\n") || "—",
        paymentMethod: isAdmin
          ? (player.paymentMethod ?? "")
          : paymentMethodLabel(player.paymentMethod),
        bank: isAdmin
          ? (player.bank ?? NO_BANK)
          : bankLabel(player.bank) || "—",
        isVip: player.isVip ? "VIP" : "—",
        balance: signedMoney(accountFrom(accountById, player.id).balance),
        status: accountFrom(accountById, player.id).inGame
          ? `${accountStatusText(accountFrom(accountById, player.id))} · En jornada`
          : accountStatusText(accountFrom(accountById, player.id)),
      })),
    [players, isAdmin, accountById]
  )

  const columns = React.useMemo<DataTableColumnDef[]>(
    () => [
      {
        key: "name",
        header: "Nombre",
        renderAfter: (row) =>
          gifted.has(Number(row.id)) ? (
            <GiftHistoryButton
              playerName={String(row.name)}
              onClick={() => setGiftsFor({ id: Number(row.id), name: String(row.name) })}
            />
          ) : null,
      },
      { key: "nickname", header: "Nickname", hideBelow: "md" },
      { key: "contact", header: "Contacto", type: "lines", hideBelow: "lg" },
      isAdmin
        ? {
            key: "paymentMethod",
            header: "Método de pago (salida)",
            type: "select",
            hideBelow: "xl",
            options: PAYMENT_METHOD_OPTIONS,
          }
        : {
            key: "paymentMethod",
            header: "Método de pago (salida)",
            hideBelow: "xl",
          },
      isAdmin
        ? {
            key: "bank",
            header: "Entidad bancaria (ingreso)",
            type: "select",
            hideBelow: "xl",
            options: BANK_OPTIONS_WITH_NONE,
          }
        : {
            key: "bank",
            header: "Entidad bancaria (ingreso)",
            hideBelow: "xl",
          },
      { key: "isVip", header: "VIP" },
      { key: "balance", header: "Saldo" },
      { key: "status", header: "Estado" },
    ],
    [isAdmin, gifted]
  )

  function findPlayer(id: DataRow["id"]) {
    return players.find((p) => p.id === Number(id)) ?? null
  }

  function openAccountDialog(
    kind: NonNullable<AccountDialog>["kind"],
    id: DataRow["id"]
  ) {
    const player = findPlayer(id)
    if (!player) return
    const account = accountFrom(accountById, player.id)
    if (kind === "status" && account.balance === 0) {
      toast.info(`${player.name} está al día: no hay saldo que marcar.`)
      return
    }
    setAccountDialog({ kind, player, account })
  }

  async function handleTransfer(values: TransferValues): Promise<boolean> {
    if (!accountDialog || accountDialog.kind !== "balance") return false
    return succeeded(
      await transferBalance({
        fromPlayerId: accountDialog.player.id,
        ...values,
      }),
      "Transferencia registrada"
    )
  }

  async function handleMovement(
    direction: MovementDirection,
    values: MovementValues
  ): Promise<boolean> {
    if (!accountDialog || accountDialog.kind !== "balance") return false
    const input = { playerId: accountDialog.player.id, ...values }
    return direction === "in"
      ? succeeded(await receivePayment(input), "Pago recibido")
      : succeeded(await registerPayout(input), "Pago registrado")
  }

  async function handleCorrection(values: CorrectionValues): Promise<boolean> {
    return succeeded(await correctMovement(values), "Movimiento corregido")
  }

  async function handleVoidTransfer(
    values: VoidTransferValues
  ): Promise<boolean> {
    return succeeded(await voidTransfer(values), "Transferencia anulada")
  }

  async function handleStatus(
    status: BalanceStatus,
    note: string | null,
    requestId: string
  ) {
    if (!accountDialog) return false
    return succeeded(
      await setBalanceStatus({
        playerId: accountDialog.player.id,
        status,
        note,
        requestId,
      }),
      "Estado guardado"
    )
  }

  async function handleAddPlayer(input: PlayerInput) {
    if (writeSucceeded(await createPlayer(input))) {
      toast.success(`${input.name} agregado`)
      setIsAddPlayerOpen(false)
    }
  }

  async function handleEditPlayer(input: PlayerInput) {
    if (!editingPlayer) return
    if (writeSucceeded(await updatePlayer(editingPlayer.id, input))) {
      toast.success("Cambios guardados")
      setEditingPlayer(null)
    }
  }

  async function handleDeletePlayer() {
    if (!deletingPlayer) return
    if (writeSucceeded(await deactivatePlayer(deletingPlayer.id))) {
      toast.success(`${deletingPlayer.name} eliminado`)
      setDeletingPlayer(null)
    }
  }

  async function handleCellChange(
    rowId: DataRow["id"],
    key: string,
    value: string
  ) {
    const player = findPlayer(rowId)
    if (!player) return
    let input: PlayerInput
    let message: string
    if (key === "paymentMethod" && isPaymentMethod(value)) {
      if (value === player.paymentMethod) return
      input = { ...toInput(player), paymentMethod: value }
      message = "Método de pago actualizado"
    } else if (key === "bank" && (isBank(value) || value === NO_BANK)) {
      const bank = isBank(value) ? value : null
      if (bank === player.bank) return
      input = { ...toInput(player), bank }
      message = "Entidad bancaria actualizada"
    } else {
      return
    }
    if (writeSucceeded(await updatePlayer(player.id, input))) {
      toast.success(message)
    } else {
      // The table already shows the new value; reload the saved one.
      router.refresh()
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          {isAdmin && (
            <div className="flex justify-end px-4 lg:px-6">
              <Dialog open={isAddPlayerOpen} onOpenChange={setIsAddPlayerOpen}>
                <DialogTrigger render={<Button />}>
                  <PlusIcon />
                  Agregar jugador
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Nuevo jugador</DialogTitle>
                    <DialogDescription>
                      Completa los datos para agregar un jugador.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="overflow-y-auto p-6">
                    <PlayerForm
                      variant="plain"
                      onSubmit={handleAddPlayer}
                      onCancel={() => setIsAddPlayerOpen(false)}
                    />
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}
          <DataTable
            data={rows}
            columns={columns}
            enableRowSelection={isAdmin}
            onCellChange={isAdmin ? handleCellChange : undefined}
            rowActions={
              isAdmin
                ? [
                    {
                      key: "balance",
                      label: "Gestionar saldo",
                      onSelect: (row) => openAccountDialog("balance", row.id),
                    },
                    {
                      key: "status",
                      label: "Estado del saldo",
                      onSelect: (row) => openAccountDialog("status", row.id),
                    },
                    {
                      key: "edit",
                      label: "Editar",
                      separatorBefore: true,
                      onSelect: (row) => setEditingPlayer(findPlayer(row.id)),
                    },
                    {
                      key: "delete",
                      label: "Eliminar",
                      variant: "destructive",
                      separatorBefore: true,
                      onSelect: (row) => setDeletingPlayer(findPlayer(row.id)),
                    },
                  ]
                : undefined
            }
          />
        </div>
      </div>

      {giftsFor && activeGifts && (
        <PlayerGiftsDialog
          gameSessionId={activeGifts.gameSessionId}
          gameNumber={activeGifts.gameNumber}
          playerId={giftsFor.id}
          playerName={giftsFor.name}
          open
          onOpenChange={(open) => {
            if (!open) setGiftsFor(null)
          }}
        />
      )}

      <Dialog
        open={editingPlayer !== null}
        onOpenChange={(open) => {
          if (!open) setEditingPlayer(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar jugador</DialogTitle>
            <DialogDescription>
              Actualiza los datos de {editingPlayer?.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto p-6">
            {editingPlayer && (
              <PlayerForm
                key={editingPlayer.id}
                variant="plain"
                initialValues={toInput(editingPlayer)}
                submitLabel="Guardar cambios"
                onSubmit={handleEditPlayer}
                onCancel={() => setEditingPlayer(null)}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {accountDialog && accountDialog.kind === "balance" && (
        <PlayerBalanceDialog
          open
          onOpenChange={(open) => !open && setAccountDialog(null)}
          name={accountDialog.player.name}
          balance={accountDialog.account.balance}
          tabs={[
            {
              value: "money",
              label: "Cobro / Pago",
              content: (
                <MoneyTab
                  player={accountDialog.player}
                  account={accountDialog.account}
                  onConfirm={handleMovement}
                  onDone={() => setAccountDialog(null)}
                />
              ),
            },
            {
              value: "transfer",
              label: "Transferencia",
              disabled: accountDialog.account.balance <= 0,
              content: (
                <BalanceTransferForm
                  from={{
                    id: accountDialog.player.id,
                    name: accountDialog.player.name,
                    balance: accountDialog.account.balance,
                  }}
                  candidates={players
                    .filter((p) => p.id !== accountDialog.player.id)
                    .map((p) => ({
                      id: p.id,
                      name: p.name,
                      balance: accountFrom(accountById, p.id).balance,
                    }))}
                  onConfirm={handleTransfer}
                  onDone={() => setAccountDialog(null)}
                />
              ),
            },
            {
              value: "movements",
              label: "Movimientos",
              content: (
                <RecentMovementsPanel
                  player={{
                    id: accountDialog.player.id,
                    name: accountDialog.player.name,
                    balance: accountDialog.account.balance,
                    inGame: accountDialog.account.inGame,
                  }}
                  onConfirm={handleCorrection}
                  onVoidTransfer={handleVoidTransfer}
                  onDone={() => setAccountDialog(null)}
                />
              ),
            },
          ]}
        />
      )}
      {accountDialog && accountDialog.kind === "status" && (
        <BalanceStatusDialog
          open
          onOpenChange={(open) => !open && setAccountDialog(null)}
          player={{
            name: accountDialog.player.name,
            balance: accountDialog.account.balance,
            status: accountDialog.account.status,
            note: accountDialog.account.note,
          }}
          onConfirm={handleStatus}
        />
      )}

      <ConfirmDeleteDialog
        open={deletingPlayer !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingPlayer(null)
        }}
        title={`¿Eliminar a ${deletingPlayer?.name ?? "este jugador"}?`}
        description="Dejará de aparecer en la lista y al iniciar jornadas. Su historial en jornadas anteriores se conserva."
        onConfirm={handleDeletePlayer}
      />
    </div>
  )
}
