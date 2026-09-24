import { z } from "zod"

import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/payment-methods"

// A house player from the catalog (public.players). Balances are not here:
// they are per game session (game_session_players, BACKEND_PLAN.md rule 7).
export interface Player {
  id: number
  name: string
  username: string
  paymentMethod: PaymentMethod | null
  isVip: boolean
}

export type PlayerInput = Omit<Player, "id">

// Shared by the form and the Server Actions (lib/data/player-actions.ts),
// which re-validate because they are reachable by direct POST.
export const playerInputSchema = z.object({
  name: z.string().trim().min(1, "Ingresa un nombre"),
  username: z.string().trim(),
  paymentMethod: z.enum(PAYMENT_METHODS).nullable(),
  isVip: z.boolean(),
})
