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
  Combobox,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { createPlayer } from "@/lib/data/player-actions"
import type { PlayerInput } from "@/lib/players"
import { useRoundDraft } from "@/lib/round-draft/context"
import {
  getActivePlayers,
  sortPlayersByName,
} from "@/lib/round-draft/selectors"
import type { DraftPlayer } from "@/lib/round-draft/types"
import { writeSucceeded } from "@/lib/write-feedback"

export function AddPlayerControl() {
  const { state, setActivePlayer } = useRoundDraft()
  const [isMenuOpen, setIsMenuOpen] = React.useState(false)
  const [isAddPlayerOpen, setIsAddPlayerOpen] = React.useState(false)
  const [editingPlayerId, setEditingPlayerId] = React.useState<number | null>(
    null
  )

  // Alphabetical; recomputed only when the game session changes, and the
  // search filters this list in the browser (no request per keystroke).
  const inactivePlayers = React.useMemo(() => {
    const activeIds = new Set(getActivePlayers(state).map((p) => p.id))
    return sortPlayersByName(state.players.filter((p) => !activeIds.has(p.id)))
  }, [state])
  const editingPlayer =
    state.players.find((p) => p.id === editingPlayerId) ?? null

  // The player is saved in the catalog first; the refreshed game session
  // brings them in, and the number-picking dialog opens for them then.
  async function handleAddPlayer(input: PlayerInput) {
    const result = await createPlayer(input)
    if (!writeSucceeded(result)) return
    setActivePlayer(result.data.id)
    setIsAddPlayerOpen(false)
    setEditingPlayerId(result.data.id)
  }

  function handleSelectExisting(player: DraftPlayer) {
    setIsMenuOpen(false)
    setActivePlayer(player.id)
    setEditingPlayerId(player.id)
  }

  return (
    <>
      <Popover open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <PopoverTrigger render={<Button variant="outline" />}>
          <PlusIcon />
          Agregar jugador
        </PopoverTrigger>
        <PopoverContent align="end" className="flex w-72 flex-col gap-1 p-1">
          <Button
            variant="ghost"
            className="justify-start"
            onClick={() => {
              setIsMenuOpen(false)
              setIsAddPlayerOpen(true)
            }}
          >
            <PlusIcon />
            Agregar nuevo
          </Button>
          {inactivePlayers.length > 0 && (
            <>
              <Separator />
              {/* Inline list inside the popover; `open` follows the popover
                  so the search resets each time it opens. */}
              <Combobox
                inline
                open={isMenuOpen}
                items={inactivePlayers}
                value={null}
                onValueChange={(player: DraftPlayer | null) => {
                  if (player) handleSelectExisting(player)
                }}
                itemToStringLabel={(player: DraftPlayer) => player.name}
              >
                <ComboboxInput
                  placeholder="Buscar jugador…"
                  showTrigger={false}
                  autoFocus
                  className="w-full"
                />
                <ComboboxEmpty className="flex empty:py-0">
                  Sin coincidencias
                </ComboboxEmpty>
                <ComboboxList className="max-h-64">
                  {(player: DraftPlayer) => (
                    <ComboboxItem key={player.id} value={player}>
                      {player.name}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </Combobox>
            </>
          )}
        </PopoverContent>
      </Popover>

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
