"use client"

import * as React from "react"
import { PlusIcon } from "lucide-react"

import { DataTable } from "@/components/data-table"
import { PlayerForm, type NewPlayer } from "@/components/player-form"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import data from "@/app/(app)/players/data.json"

export default function PlayerPage() {
  const [players, setPlayers] = React.useState(data)
  const [isAddPlayerOpen, setIsAddPlayerOpen] = React.useState(false)

  function handleAddPlayer(player: NewPlayer) {
    setPlayers((prev) => [
      ...prev,
      {
        id: Math.max(0, ...prev.map((p) => p.id)) + 1,
        Nombre: player.name,
        usuario: player.username,
        "metodo de pago": player.paymentMethod,
        "saldo positivo": player.positiveBalance,
        "saldo negativo": player.negativeBalance,
      },
    ])
    setIsAddPlayerOpen(false)
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
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
          <DataTable
            data={players}
            columns={[
              { key: "Nombre", header: "Nombre" },
              { key: "usuario", header: "Usuario" },
              {
                key: "metodo de pago",
                header: "Método de pago",
                type: "select", // <- columna tipo selector
                options: [
                  { label: "Paypal", value: "Paypal" },
                  { label: "Tarjeta de crédito", value: "Tarjeta de crédito" },
                  { label: "Transferencia", value: "Transferencia" },
                  { label: "Efectivo", value: "Efectivo" },
                ],
              },
              {
                key: "saldo positivo",
                header: "Saldo positivo",
                color: "green",
                textSize: "lg",
              },
              {
                key: "saldo negativo",
                header: "Saldo negativo",
                color: "red",
                textSize: "lg",
              },
            ]}
            rowActions={[
              {
                key: "edit",
                label: "Editar",
                onSelect: (row) => console.log("editar", row),
              },
              {
                key: "duplicate",
                label: "Duplicar",
                onSelect: (row) => console.log("duplicar", row),
              },
              {
                key: "delete",
                label: "Eliminar",
                variant: "destructive",
                separatorBefore: true,
                onSelect: (row) => console.log("eliminar", row),
              },
            ]}
          />
        </div>
      </div>
    </div>
  )
}
