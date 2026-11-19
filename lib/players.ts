import { z } from "zod"

import { BANKS, type Bank } from "@/lib/banks"
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/payment-methods"

// A house player from the catalog (public.players). Balances are not here:
// they are per game session (game_session_players, BACKEND_PLAN.md rule 7).
export interface Player {
  id: number
  /** Always uppercase (a trigger normalizes it in the database). */
  name: string
  /** Uppercase too; "" when the player has none. */
  nickname: string
  paymentMethod: PaymentMethod | null
  /** The player's bank (Phase 6a2), optional. */
  bank: Bank | null
  /** Contact, optional; "" when the player has none. */
  phone: string
  /** Lowercase (the database trigger normalizes it); "" when none. */
  email: string
  isVip: boolean
}

export type PlayerInput = Omit<Player, "id">

// Shared by the form and the Server Actions (lib/data/player-actions.ts),
// which re-validate because they are reachable by direct POST. Only the name
// is required.
/** A player's contact, shared by the player form and "Registrar pago". */
export const phoneSchema = z.string().trim().max(30, "El teléfono puede tener hasta 30 caracteres")
export const emailSchema = z.union([
  z.literal(""),
  z.string().trim().toLowerCase().pipe(z.email("Ingresa un correo válido").max(254)),
])

export const playerInputSchema = z.object({
  name: z.string().trim().min(1, "Ingresa un nombre").toUpperCase(),
  nickname: z.string().trim().toUpperCase(),
  paymentMethod: z.enum(PAYMENT_METHODS).nullable(),
  bank: z.enum(BANKS).nullable(),
  phone: phoneSchema,
  email: emailSchema,
  isVip: z.boolean(),
})

/** Lowercase and without accents, so "maria" finds "MARÍA". */
export function normalizeSearchText(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim()
}

/** Whether a player matches the search text in the name, nickname, phone or
 *  email. An empty search matches everyone. */
export function playerMatchesQuery(
  player: Pick<Player, "name" | "nickname" | "phone" | "email">,
  query: string
): boolean {
  const needle = normalizeSearchText(query)
  if (needle === "") return true
  return [player.name, player.nickname, player.phone, player.email].some((field) =>
    normalizeSearchText(field).includes(needle)
  )
}

/** The player whose name is the same as `name` once accents, case and spaces
 *  are ignored ("ana torres" finds "ANA TORRES"), or null. The quick "Agregar
 *  jugador" warns with it before creating a duplicate. */
export function findSamePlayer<P extends { name: string }>(
  name: string,
  players: readonly P[]
): P | null {
  const wanted = normalizeSearchText(name).replace(/\s+/g, " ")
  if (!wanted) return null
  return (
    players.find(
      (p) => normalizeSearchText(p.name).replace(/\s+/g, " ") === wanted
    ) ?? null
  )
}

/** Whether a player search for `query` offers "+ Crear jugador «…»": there
 *  is text and no player has exactly that name. */
export function offersCreatePlayer(
  query: string,
  players: readonly { name: string }[]
): boolean {
  return query.trim() !== "" && findSamePlayer(query, players) === null
}

/** The other player that already uses `nickname` (as stored: trimmed and
 *  uppercase), or null. Nicknames are unique among a house's active players
 *  (*_unique_player_nickname.sql); the forms warn with this before saving.
 *  `exceptId` is the player being edited. */
export function findNicknameOwner<P extends { id: number; nickname?: string | null }>(
  nickname: string,
  players: readonly P[],
  exceptId?: number
): P | null {
  const wanted = nickname.trim().toUpperCase()
  if (!wanted) return null
  return (
    players.find(
      (p) => p.id !== exceptId && (p.nickname ?? "").trim().toUpperCase() === wanted
    ) ?? null
  )
}
