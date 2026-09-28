"use client"

import * as React from "react"
import { PlusIcon } from "lucide-react"
import { toast } from "sonner"

import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import {
  DataTable,
  type DataTableColumnDef,
  type DataRow,
} from "@/components/data-table"
import { useRole } from "@/components/house-provider"
import { RoundForm } from "@/components/round-form"
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
  createRoundTemplate,
  deactivateRoundTemplate,
  updateRoundTemplate,
} from "@/lib/data/round-actions"
import { formatMoney, type Round, type RoundInput } from "@/lib/rounds"
import { writeSucceeded } from "@/lib/write-feedback"

const columns: DataTableColumnDef[] = [
  { key: "name", header: "Nombre" },
  { key: "winnerCount", header: "Números ganadores" },
  { key: "linePrice", header: "Precio de línea" },
  { key: "prizes", header: "Premios" },
]

// /rounds: plantillas de ronda de la casa. El precio de línea y los premios se
// copian a la ronda cuando empieza, así que editarlos no cambia una ronda en curso.
export default function Rounds({ rounds }: { rounds: Round[] }) {
  const isAdmin = useRole() === "admin"
  const [isAddRoundOpen, setIsAddRoundOpen] = React.useState(false)
  const [editingRound, setEditingRound] = React.useState<Round | null>(null)
  const [deletingRound, setDeletingRound] = React.useState<Round | null>(null)

  const rows = React.useMemo<DataRow[]>(
    () =>
      rounds.map((round) => ({
        id: round.id,
        name: round.name,
        winnerCount: round.prizes.length,
        linePrice: formatMoney(round.linePrice),
        prizes: round.prizes.map(formatMoney).join(" · "),
      })),
    [rounds]
  )

  function findRound(id: DataRow["id"]) {
    return rounds.find((r) => r.id === Number(id)) ?? null
  }

  async function handleAddRound(input: RoundInput) {
    if (writeSucceeded(await createRoundTemplate(input))) {
      toast.success(`Ronda ${input.name} creada`)
      setIsAddRoundOpen(false)
    }
  }

  async function handleEditRound(input: RoundInput) {
    if (!editingRound) return
    if (writeSucceeded(await updateRoundTemplate(editingRound.id, input))) {
      toast.success("Cambios guardados")
      setEditingRound(null)
    }
  }

  async function handleDeleteRound() {
    if (!deletingRound) return
    if (writeSucceeded(await deactivateRoundTemplate(deletingRound.id))) {
      toast.success(`Ronda ${deletingRound.name} eliminada`)
      setDeletingRound(null)
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          {isAdmin && (
            <div className="flex justify-end px-4 lg:px-6">
              <Dialog open={isAddRoundOpen} onOpenChange={setIsAddRoundOpen}>
                <DialogTrigger render={<Button />}>
                  <PlusIcon />
                  Crear ronda
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Nueva ronda</DialogTitle>
                    <DialogDescription>
                      Completa los datos para agregar una ronda.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="overflow-y-auto p-6">
                    <RoundForm
                      variant="plain"
                      onSubmit={handleAddRound}
                      onCancel={() => setIsAddRoundOpen(false)}
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
            rowActions={
              isAdmin
                ? [
                    {
                      key: "edit",
                      label: "Editar",
                      onSelect: (row) => setEditingRound(findRound(row.id)),
                    },
                    {
                      key: "delete",
                      label: "Eliminar",
                      variant: "destructive",
                      separatorBefore: true,
                      onSelect: (row) => setDeletingRound(findRound(row.id)),
                    },
                  ]
                : undefined
            }
          />
        </div>
      </div>

      <Dialog
        open={editingRound !== null}
        onOpenChange={(open) => {
          if (!open) setEditingRound(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar ronda</DialogTitle>
            <DialogDescription>
              Los cambios aplican a las rondas que empiecen después; una ronda
              en curso conserva su precio.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto p-6">
            {editingRound && (
              <RoundForm
                key={editingRound.id}
                variant="plain"
                initialValues={editingRound}
                submitLabel="Guardar cambios"
                onSubmit={handleEditRound}
                onCancel={() => setEditingRound(null)}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={deletingRound !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingRound(null)
        }}
        title={`¿Eliminar la ronda ${deletingRound?.name ?? ""}?`}
        description="Dejará de aparecer al elegir la siguiente ronda. Las rondas ya jugadas se conservan."
        onConfirm={handleDeleteRound}
      />
    </div>
  )
}
