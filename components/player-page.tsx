"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { PlusIcon } from "lucide-react"
import { toast } from "sonner"

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
import {
  createPlayer,
  deactivatePlayer,
  updatePlayer,
} from "@/lib/data/player-actions"
import {
  isPaymentMethod,
  PAYMENT_METHOD_OPTIONS,
  paymentMethodLabel,
} from "@/lib/payment-methods"
import type { Player, PlayerInput } from "@/lib/players"
import { writeSucceeded } from "@/lib/write-feedback"

function toInput(player: Player): PlayerInput {
  return {
    name: player.name,
    username: player.username,
    paymentMethod: player.paymentMethod,
    isVip: player.isVip,
  }
}

// /players: catálogo de jugadores de la casa. Los saldos no se muestran
// aquí porque son por jornada (BACKEND_PLAN.md regla 7).
export default function PlayerPage({ players }: { players: Player[] }) {
  const router = useRouter()
  const isAdmin = useRole() === "admin"
  const [isAddPlayerOpen, setIsAddPlayerOpen] = React.useState(false)
  const [editingPlayer, setEditingPlayer] = React.useState<Player | null>(null)
  const [deletingPlayer, setDeletingPlayer] = React.useState<Player | null>(
    null
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
        isVip: player.isVip ? "VIP" : "—",
      })),
    [players, isAdmin]
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
      { key: "isVip", header: "VIP" },
    ],
    [isAdmin]
  )

  function findPlayer(id: DataRow["id"]) {
    return players.find((p) => p.id === Number(id)) ?? null
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
    if (!player || key !== "paymentMethod" || !isPaymentMethod(value)) return
    if (value === player.paymentMethod) return
    if (
      writeSucceeded(
        await updatePlayer(player.id, {
          ...toInput(player),
          paymentMethod: value,
        })
      )
    ) {
      toast.success("Método de pago actualizado")
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
                      key: "edit",
                      label: "Editar",
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
