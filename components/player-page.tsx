"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { PlusIcon } from "lucide-react"
import { toast } from "sonner"

import { AccountMovementDialog, type MovementValues } from "@/components/account-movement-dialog"
import { BalanceStatusDialog } from "@/components/balance-status-dialog"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
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
import { accountStatusText, type BalanceStatus, type PlayerAccount } from "@/lib/accounts"
import {
  receivePayment,
  registerPayout,
  setBalanceStatus,
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
import { BANK_OPTIONS, bankLabel, isBank } from "@/lib/banks"
import {
  isPaymentMethod,
  PAYMENT_METHOD_OPTIONS,
  paymentMethodLabel,
} from "@/lib/payment-methods"
import type { Player, PlayerInput } from "@/lib/players"
import { signedMoney } from "@/lib/round-draft/balance"
import { writeSucceeded } from "@/lib/write-feedback"

function toInput(player: Player): PlayerInput {
  return {
    name: player.name,
    username: player.username,
    paymentMethod: player.paymentMethod,
    bank: player.bank,
    isVip: player.isVip,
  }
}

type AccountDialog = { kind: "in" | "out" | "status"; player: Player; account: PlayerAccount } | null

/** A player with no account row yet has $0. */
function accountFrom(accounts: Map<number, PlayerAccount>, playerId: number): PlayerAccount {
  return accounts.get(playerId) ?? { playerId, balance: 0, status: null, note: null, inGame: false }
}

function succeeded(result: GameActionResult, message: string): boolean {
  if (result.ok) {
    toast.success(message)
    return true
  }
  if (result.error !== "session_replaced") toast.error(GAME_ACTION_ERROR_MESSAGES[result.error])
  return false
}

// /players: catálogo de jugadores de la casa con el saldo de su cuenta (pasa
// de una jornada a otra, Fase 4d) y su estado. Cobros, pagos y el estado del
// saldo se registran aquí en cualquier momento; si el jugador está en la
// jornada activa, el movimiento va a la jornada.
export default function PlayerPage({
  players,
  accounts,
}: {
  players: Player[]
  accounts: PlayerAccount[]
}) {
  const router = useRouter()
  const isAdmin = useRole() === "admin"
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
      players.map((player) => ({
        id: player.id,
        name: player.name,
        username: player.username,
        paymentMethod: isAdmin
          ? (player.paymentMethod ?? "")
          : paymentMethodLabel(player.paymentMethod),
        bank: isAdmin ? (player.bank ?? "") : bankLabel(player.bank) || "—",
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
      { key: "name", header: "Nombre" },
      { key: "username", header: "Usuario" },
      isAdmin
        ? {
            key: "paymentMethod",
            header: "Método de pago",
            type: "select",
            options: PAYMENT_METHOD_OPTIONS,
          }
        : { key: "paymentMethod", header: "Método de pago" },
      isAdmin
        ? { key: "bank", header: "Entidad bancaria", type: "select", options: BANK_OPTIONS }
        : { key: "bank", header: "Entidad bancaria" },
      { key: "isVip", header: "VIP" },
      { key: "balance", header: "Saldo" },
      { key: "status", header: "Estado" },
    ],
    [isAdmin]
  )

  function findPlayer(id: DataRow["id"]) {
    return players.find((p) => p.id === Number(id)) ?? null
  }

  function openAccountDialog(kind: "in" | "out" | "status", id: DataRow["id"]) {
    const player = findPlayer(id)
    if (!player) return
    const account = accountFrom(accountById, player.id)
    if (kind === "status" && account.balance === 0) {
      toast.info(`${player.name} está al día: no hay saldo que marcar.`)
      return
    }
    setAccountDialog({ kind, player, account })
  }

  async function handleMovement(values: MovementValues): Promise<boolean> {
    if (!accountDialog || accountDialog.kind === "status") return false
    const input = { playerId: accountDialog.player.id, ...values }
    return accountDialog.kind === "in"
      ? succeeded(await receivePayment(input), "Pago recibido")
      : succeeded(await registerPayout(input), "Pago registrado")
  }

  async function handleStatus(status: BalanceStatus, note: string | null, requestId: string) {
    if (!accountDialog) return false
    return succeeded(
      await setBalanceStatus({ playerId: accountDialog.player.id, status, note, requestId }),
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
    } else if (key === "bank" && isBank(value)) {
      if (value === player.bank) return
      input = { ...toInput(player), bank: value }
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
                      key: "receive",
                      label: "Recibir pago",
                      onSelect: (row) => openAccountDialog("in", row.id),
                    },
                    {
                      key: "payout",
                      label: "Registrar pago",
                      onSelect: (row) => openAccountDialog("out", row.id),
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

      {accountDialog && accountDialog.kind !== "status" && (
        <AccountMovementDialog
          open
          onOpenChange={(open) => !open && setAccountDialog(null)}
          direction={accountDialog.kind}
          player={{
            name: accountDialog.player.name,
            balance: accountDialog.account.balance,
            paymentMethod: accountDialog.player.paymentMethod,
            bank: accountDialog.player.bank,
          }}
          onConfirm={handleMovement}
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
