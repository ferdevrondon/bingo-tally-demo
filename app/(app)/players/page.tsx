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
import data from "./data.json"
import PlayerPage from "@/components/player-page"

export default function Page() {
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
        <PlayerPage />
      </div>
    </div>
  )
}
