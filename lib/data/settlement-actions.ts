"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import type { MovementInput } from "@/lib/data/account-actions"
import type { GameActionResult } from "@/lib/data/game-action-result"
import { rejectGameAction } from "@/lib/data/reject-game-action"
import { BANKS } from "@/lib/banks"
import { PAYMENT_METHODS } from "@/lib/payment-methods"
import type { SettlementMark } from "@/lib/settlement"
import { createClient } from "@/lib/supabase/server"

// Writes of the settlement screen (/games/[id]/settlement). The SQL functions
// check the admin, that the settlement is still open and resolve the player
// (settlements migration).

const idSchema = z.number().int().positive()

const movementSchema = z.object({
  gameSessionId: idSchema,
  playerId: idSchema,
  amount: z.number().positive(),
  paymentMethod: z.enum(PAYMENT_METHODS),
  bank: z.enum(BANKS).nullable(),
  note: z.string().trim().max(200).nullable(),
  requestId: z.uuid(),
})

type SettlementMovement = MovementInput & { gameSessionId: number }

async function move(
  fn: "settlement_receive" | "settlement_payout",
  input: SettlementMovement
): Promise<GameActionResult> {
  const parsed = movementSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "invalid" }
  const supabase = await createClient()
  const { error } = await supabase.rpc(fn, {
    p_game_session_id: parsed.data.gameSessionId,
    p_player_id: parsed.data.playerId,
    p_amount: parsed.data.amount,
    p_payment_method: parsed.data.paymentMethod,
    p_note: parsed.data.note as string,
    p_request_id: parsed.data.requestId,
    p_bank: parsed.data.bank as string,
  })
  if (error) return rejectGameAction(supabase, error)
  refresh()
  return { ok: true, data: undefined }
}

/** "Recibir pago" in the settlement: resolved once the player is at >= 0. */
export async function settlementReceive(input: SettlementMovement): Promise<GameActionResult> {
  return move("settlement_receive", input)
}

/** "Registrar pago" in the settlement: resolved once the player is at <= 0. */
export async function settlementPayout(input: SettlementMovement): Promise<GameActionResult> {
  return move("settlement_payout", input)
}

const markSchema = z.object({
  gameSessionId: idSchema,
  playerId: idSchema,
  resolution: z.enum(["play", "pending_payout", "owes"]),
  note: z.string().trim().max(200).nullable(),
  requestId: z.uuid(),
})

export async function settlementMark(input: {
  gameSessionId: number
  playerId: number
  resolution: SettlementMark
  note: string | null
  requestId: string
}): Promise<GameActionResult> {
  const parsed = markSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "invalid" }
  const supabase = await createClient()
  const { error } = await supabase.rpc("settlement_mark", {
    p_game_session_id: parsed.data.gameSessionId,
    p_player_id: parsed.data.playerId,
    p_resolution: parsed.data.resolution,
    p_note: parsed.data.note as string,
    p_request_id: parsed.data.requestId,
  })
  if (error) return rejectGameAction(supabase, error)
  refresh()
  return { ok: true, data: undefined }
}

/** "Cerrar liquidación": read-only from then on. */
export async function closeSettlement(input: {
  gameSessionId: number
  requestId: string
}): Promise<GameActionResult> {
  if (!idSchema.safeParse(input.gameSessionId).success || !z.uuid().safeParse(input.requestId).success)
    return { ok: false, error: "invalid" }
  const supabase = await createClient()
  const { error } = await supabase.rpc("close_settlement", {
    p_game_session_id: input.gameSessionId,
    p_request_id: input.requestId,
  })
  if (error) return rejectGameAction(supabase, error)
  refresh()
  return { ok: true, data: undefined }
}
