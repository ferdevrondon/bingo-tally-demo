"use client"

import * as React from "react"
import { PlusIcon } from "lucide-react"

import { DataTable } from "@/components/data-table"
import { RoundForm, type NewRound } from "@/components/round-form"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import data from "@/app/rounds/data.json"

export default function Rounds() {
  const [rounds, setRounds] = React.useState(data)
  const [isAddRoundOpen, setIsAddRoundOpen] = React.useState(false)

  function handleAddRound(round: NewRound) {
    setRounds((prev) => [
      ...prev,
      {
        id: Math.max(0, ...prev.map((r) => r.id)) + 1,
        Nombre: round.name,
        "Numeros ganadores": round.winnerCount,
        Premios: round.prizes.join(", "),
      },
    ])
    setIsAddRoundOpen(false)
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
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
          <DataTable
            data={rounds}
            columns={[
              { key: "Nombre", header: "Nombre" },
              { key: "Numeros ganadores", header: "Números ganadores" },
              { key: "Premios", header: "Premios" },
            ]}
          />
        </div>
      </div>
    </div>
  )
}
