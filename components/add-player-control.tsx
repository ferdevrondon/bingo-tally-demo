"use client"

import * as React from "react"
import { PlusIcon } from "lucide-react"

import { PlayerEditNumbersDialog } from "@/components/player-edit-numbers-dialog"
import {
  CreatePlayerOption,
  QuickAddPlayerForm,
} from "@/components/quick-add-player"
import { Button } from "@/components/ui/button"
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
import { useRoundDraft } from "@/lib/round-draft/context"
import {
  getActivePlayers,
  sortPlayersByName,
} from "@/lib/round-draft/selectors"
import type { DraftPlayer } from "@/lib/round-draft/types"

export function AddPlayerControl() {
  const { state, setActivePlayer } = useRoundDraft()
  const [isMenuOpen, setIsMenuOpen] = React.useState(false)
  // The popover shows the search list, or the quick add form (with the name
  // typed in the search, when it came from "+ Crear jugador «…»").
  const [newPlayerName, setNewPlayerName] = React.useState<string | null>(null)
  const [query, setQuery] = React.useState("")
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

  // A new player is saved in the catalog first (the quick add); the
  // refreshed game session brings them in, and the number-picking dialog
  // opens for them then. An existing one goes straight there.
  function handlePlayerReady(playerId: number) {
    setIsMenuOpen(false)
    setNewPlayerName(null)
    setActivePlayer(playerId)
    setEditingPlayerId(playerId)
  }

  return (
    <>
      <Popover
        open={isMenuOpen}
        onOpenChange={(open) => {
          setIsMenuOpen(open)
          if (!open) {
            setNewPlayerName(null)
            setQuery("")
          }
        }}
      >
        <PopoverTrigger render={<Button variant="outline" />}>
          <PlusIcon />
          Agregar jugador
        </PopoverTrigger>
        {newPlayerName !== null ? (
          <PopoverContent align="end" className="w-80">
            <QuickAddPlayerForm
              key={newPlayerName}
              initialName={newPlayerName}
              players={state.players}
              onCreated={handlePlayerReady}
              onUseExisting={handlePlayerReady}
              onCancel={() => setNewPlayerName(null)}
            />
          </PopoverContent>
        ) : (
          <PopoverContent align="end" className="flex w-72 flex-col gap-1 p-1">
            <Button
              variant="ghost"
              className="justify-start"
              onClick={() => setNewPlayerName("")}
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
                    if (player) handlePlayerReady(player.id)
                  }}
                  onInputValueChange={(text: string) => setQuery(text)}
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
            <CreatePlayerOption
              query={query}
              players={state.players}
              onCreate={(name) => setNewPlayerName(name)}
            />
          </PopoverContent>
        )}
      </Popover>

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
