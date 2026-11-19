"use client"

import { PlusIcon } from "lucide-react"
import * as React from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createPlayer } from "@/lib/data/player-actions"
import {
  findNicknameOwner,
  findSamePlayer,
  offersCreatePlayer,
  playerInputSchema,
} from "@/lib/players"
import { cn } from "@/lib/utils"
import { writeSucceeded } from "@/lib/write-feedback"

// The quick "Agregar jugador" of the live game (/new-game, /active-round):
// only the name and the nickname, in a popover. Everything else (phone,
// email, payment method, bank, VIP) is filled in later in /players; the cash
// dialogs also ask for the contact.

type NamedPlayer = { id: number; name: string; nickname?: string }

export function QuickAddPlayerForm({
  initialName = "",
  players,
  onCreated,
  onUseExisting,
  onCancel,
}: {
  /** Prefills "Nombre", e.g. from the text typed in the player search. */
  initialName?: string
  /** The house's players, to warn before creating a duplicate. */
  players: readonly NamedPlayer[]
  onCreated: (playerId: number) => void
  onUseExisting: (playerId: number) => void
  onCancel: () => void
}) {
  const [name, setName] = React.useState(initialName.toUpperCase())
  const [nickname, setNickname] = React.useState("")
  const [isPending, startTransition] = React.useTransition()
  const nameId = React.useId()
  const nicknameId = React.useId()

  const same = findSamePlayer(name, players)
  // Nicknames are unique among the house's active players.
  const nicknameOwner = findNicknameOwner(nickname, players)
  const canSubmit = name.trim() !== "" && !nicknameOwner && !isPending

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!canSubmit) return
    const parsed = playerInputSchema.safeParse({
      name,
      nickname,
      paymentMethod: null,
      bank: null,
      phone: "",
      email: "",
      isVip: false,
    })
    if (!parsed.success) return
    startTransition(async () => {
      const result = await createPlayer(parsed.data)
      if (writeSucceeded(result)) onCreated(result.data.id)
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation()
          onCancel()
        }
      }}
      className="flex flex-col gap-3"
    >
      <p className="font-heading text-sm font-medium">Nuevo jugador</p>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={nameId} className="text-xs font-medium text-muted-foreground">
          Nombre
        </label>
        <Input
          id={nameId}
          value={name}
          maxLength={100}
          autoFocus
          autoComplete="off"
          placeholder="Ej. ANA TORRES"
          aria-describedby={same ? `${nameId}-same` : undefined}
          onChange={(e) => setName(e.target.value.toUpperCase())}
        />
        {same && (
          <p id={`${nameId}-same`} className="text-xs text-warning-solid">
            Ya existe {same.name} ·{" "}
            <button
              type="button"
              className="font-medium text-primary underline-offset-2 hover:underline"
              onClick={() => onUseExisting(same.id)}
            >
              Usar este
            </button>
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={nicknameId} className="text-xs font-medium text-muted-foreground">
          Nickname (opcional)
        </label>
        <Input
          id={nicknameId}
          value={nickname}
          maxLength={50}
          autoComplete="off"
          placeholder="Ej. ANITA"
          aria-invalid={nicknameOwner !== null}
          aria-describedby={nicknameOwner ? `${nicknameId}-taken` : undefined}
          onChange={(e) => setNickname(e.target.value.toUpperCase())}
        />
        {nicknameOwner && (
          <p id={`${nicknameId}-taken`} className="text-xs text-destructive">
            Ese nickname ya lo usa {nicknameOwner.name}. Elige otro.
          </p>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Teléfono, correo y banco se completan después en Jugadores.
      </p>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={!canSubmit}>
          {same ? "Crear de todos modos" : "Agregar"}
        </Button>
      </div>
    </form>
  )
}

/** "+ Crear jugador «ANA»" at the end of a player search, when the typed name
 *  is new. A plain button: choosing it never selects a player. */
export function CreatePlayerOption({
  query,
  players,
  onCreate,
  className,
}: {
  query: string
  players: readonly { name: string }[]
  onCreate: (name: string) => void
  className?: string
}) {
  if (!offersCreatePlayer(query, players)) return null
  const name = query.trim().toUpperCase()
  return (
    <button
      type="button"
      // Keep the input focused until the click lands (the list would close).
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onCreate(name)}
      className={cn(
        "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium text-primary hover:bg-accent focus-visible:bg-accent focus-visible:outline-none",
        className
      )}
    >
      <PlusIcon className="size-4 shrink-0" />
      <span className="truncate">Crear jugador «{name}»</span>
    </button>
  )
}
