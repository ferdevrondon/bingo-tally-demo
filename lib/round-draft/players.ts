import type { Player } from "@/lib/players"

import type { DraftPlayer } from "./types"

// A catalog player entering the draft. Balances start at 0: they are per game
// session (BACKEND_PLAN.md rule 7), not part of the catalog.
export function toDraftPlayer(
  player: Pick<Player, "id" | "name">
): DraftPlayer {
  return {
    id: player.id,
    name: player.name,
    positiveBalance: 0,
    negativeBalance: 0,
    checkedIn: false,
    pendingCarryOverDecision: false,
  }
}

// Brings a draft's players in line with the catalog (players created or
// renamed on /players after the draft started). Players missing from the
// catalog (deactivated) stay, since they may still own numbers. Returns the
// same array when nothing changed.
export function mergeCatalogPlayers(
  draftPlayers: DraftPlayer[],
  catalog: Pick<Player, "id" | "name">[]
): DraftPlayer[] {
  const catalogById = new Map(catalog.map((p) => [p.id, p]))
  let changed = false
  const merged = draftPlayers.map((p) => {
    const name = catalogById.get(p.id)?.name
    if (name === undefined || name === p.name) return p
    changed = true
    return { ...p, name }
  })
  const draftIds = new Set(draftPlayers.map((p) => p.id))
  for (const player of catalog) {
    if (draftIds.has(player.id)) continue
    changed = true
    merged.push(toDraftPlayer(player))
  }
  return changed ? merged : draftPlayers
}
