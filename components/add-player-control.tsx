"use client"

import * as React from "react"
import { PlusIcon } from "lucide-react"

import { PlayerEditNumbersDialog } from "@/components/player-edit-numbers-dialog"
import { PlayerForm, type NewPlayer } from "@/components/player-form"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useRoundDraft } from "@/lib/round-draft/context"
import { getActivePlayers } from "@/lib/round-draft/selectors"
import type { DraftPlayer } from "@/lib/round-draft/types"

function parseMoney(value: string): number {
  const parsed = Number.parseFloat(value.replace(/[^0-9.-]/g, ""))
  return Number.isFinite(parsed) ? parsed : 0
}

export function AddPlayerControl() {
  const { state, addPlayer, setActivePlayer } = useRoundDraft()
  const [isAddPlayerOpen, setIsAddPlayerOpen] = React.useState(false)
  const [editingPlayerId, setEditingPlayerId] = React.useState<number | null>(null)

  const activeIds = new Set(getActivePlayers(state).map((p) => p.id))
  const inactivePlayers = state.players.filter((p) => !activeIds.has(p.id))
  const editingPlayer = state.players.find((p) => p.id === editingPlayerId) ?? null

  function handleAddPlayer(player: NewPlayer) {
    // Mirrors the id ADD_PLAYER is about to assign (lib/round-draft/context.tsx),
    // so we know which player to open the number-picking dialog for right away.
    const nextId = Math.max(0, ...state.players.map((p) => p.id)) + 1
    addPlayer({
      name: player.name,
      positiveBalance: parseMoney(player.positiveBalance),
      negativeBalance: parseMoney(player.negativeBalance),
      checkedIn: false,
      pendingCarryOverDecision: false,
    })
    setIsAddPlayerOpen(false)
    setEditingPlayerId(nextId)
  }

  function handleSelectExisting(player: DraftPlayer) {
    setActivePlayer(player.id)
    setEditingPlayerId(player.id)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" />}>
          <PlusIcon />
          Agregar jugador
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => setIsAddPlayerOpen(true)}>
            <PlusIcon />
            Agregar nuevo
          </DropdownMenuItem>
          {inactivePlayers.length > 0 && <DropdownMenuSeparator />}
          {inactivePlayers.map((p) => (
            <DropdownMenuItem key={p.id} onClick={() => handleSelectExisting(p)}>
              {p.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isAddPlayerOpen} onOpenChange={setIsAddPlayerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo jugador</DialogTitle>
            <DialogDescription>
              Completa los datos para agregar un jugador a esta ronda.
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

      {editingPlayer && (
        <PlayerEditNumbersDialog
          player={editingPlayer}
          open
          onOpenChange={(open) => {
            if (!open) setEditingPlayerId(null)
          }}
        />
      )}
    </>
  )
}
