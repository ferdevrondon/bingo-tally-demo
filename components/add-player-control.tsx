"use client"

import * as React from "react"
import { PlusIcon } from "lucide-react"

import { PlayerEditNumbersDialog } from "@/components/player-edit-numbers-dialog"
import { PlayerForm } from "@/components/player-form"
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
import { createPlayer } from "@/lib/data/player-actions"
import type { PlayerInput } from "@/lib/players"
import { useRoundDraft } from "@/lib/round-draft/context"
import { toDraftPlayer } from "@/lib/round-draft/players"
import { getActivePlayers } from "@/lib/round-draft/selectors"
import type { DraftPlayer } from "@/lib/round-draft/types"
import { writeSucceeded } from "@/lib/write-feedback"

export function AddPlayerControl() {
  const { state, addPlayer, setActivePlayer } = useRoundDraft()
  const [isAddPlayerOpen, setIsAddPlayerOpen] = React.useState(false)
  const [editingPlayerId, setEditingPlayerId] = React.useState<number | null>(null)

  const activeIds = new Set(getActivePlayers(state).map((p) => p.id))
  const inactivePlayers = state.players.filter((p) => !activeIds.has(p.id))
  const editingPlayer = state.players.find((p) => p.id === editingPlayerId) ?? null

  // The player is saved in the catalog first; its database id is the one the
  // draft uses, so the number-picking dialog can open for it right away.
  async function handleAddPlayer(input: PlayerInput) {
    const result = await createPlayer(input)
    if (!writeSucceeded(result)) return
    addPlayer(toDraftPlayer(result.data))
    setIsAddPlayerOpen(false)
    setEditingPlayerId(result.data.id)
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
