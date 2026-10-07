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
  isVip: boolean
}

export type PlayerInput = Omit<Player, "id">

// Shared by the form and the Server Actions (lib/data/player-actions.ts),
// which re-validate because they are reachable by direct POST.
export const playerInputSchema = z.object({
  name: z.string().trim().min(1, "Ingresa un nombre").toUpperCase(),
  nickname: z.string().trim().toUpperCase(),
  paymentMethod: z.enum(PAYMENT_METHODS).nullable(),
  bank: z.enum(BANKS).nullable(),
  isVip: z.boolean(),
})
