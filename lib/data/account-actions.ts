"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { BALANCE_STATUSES, needsAttention, type BalanceStatus } from "@/lib/accounts"
import { accountFor, fetchPlayerAccounts } from "@/lib/data/accounts"
import type { GameActionResult } from "@/lib/data/game-action-result"
import { getCurrentHouse } from "@/lib/data/house"
import { rejectGameAction } from "@/lib/data/reject-game-action"
import { BANKS, type Bank } from "@/lib/banks"
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/payment-methods"
import { createClient } from "@/lib/supabase/server"

// Money in and out of a player's account at any time (/players), and the
// status of their balance. The SQL functions route a move to the active game
// session when the player is in it (Phase 4d1).

const movementSchema = z.object({
  playerId: z.number().int().positive(),
  amount: z.number().positive(),
  paymentMethod: z.enum(PAYMENT_METHODS),
  bank: z.enum(BANKS).nullable(),
  note: z.string().trim().max(200).nullable(),
  requestId: z.uuid(),
})

export type MovementInput = {
  playerId: number
  amount: number
  paymentMethod: PaymentMethod
  /** The bank of this move ("Entidad bancaria (ingreso)"), stored on its row. */
  bank: Bank | null
  note: string | null
  requestId: string
}

async function move(
  fn: "record_account_recharge" | "record_account_payout",
  input: MovementInput
): Promise<GameActionResult> {
  const parsed = movementSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "invalid" }
  const supabase = await createClient()
  const { error } = await supabase.rpc(fn, {
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

/** "Recibir pago": the player pays the house. */
export async function receivePayment(input: MovementInput): Promise<GameActionResult> {
  return move("record_account_recharge", input)
}

/** "Registrar pago": the house pays the player (no limit). */
export async function registerPayout(input: MovementInput): Promise<GameActionResult> {
  return move("record_account_payout", input)
}

const statusSchema = z.object({
  playerId: z.number().int().positive(),
  status: z.enum(BALANCE_STATUSES),
  note: z.string().trim().max(200).nullable(),
  requestId: z.uuid(),
})

export async function setBalanceStatus(input: {
  playerId: number
  status: BalanceStatus
  note: string | null
  requestId: string
}): Promise<GameActionResult> {
  const parsed = statusSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "invalid" }
  const supabase = await createClient()
  const { error } = await supabase.rpc("set_balance_status", {
    p_player_id: parsed.data.playerId,
    p_status: parsed.data.status,
    p_note: parsed.data.note as string,
    p_request_id: parsed.data.requestId,
  })
  if (error) return rejectGameAction(supabase, error)
  refresh()
  return { ok: true, data: undefined }
}

export interface StartAlerts {
  players: {
    id: number
    name: string
    balance: number
    status: BalanceStatus | null
    note: string | null
  }[]
  openSettlements: { gameSessionId: number; number: number; unresolved: number }[]
}

// What "Iniciar jornada" warns about before starting a new game session:
// players who owe, are pending a payout or have a positive balance nobody
// decided on, and settlements still open with unresolved players.
export async function getStartAlerts(): Promise<StartAlerts> {
  const house = await getCurrentHouse()
  if (!house) return { players: [], openSettlements: [] }
  const supabase = await createClient()
  // Resuming the active game session: nothing to warn about again.
  const { data: active } = await supabase
    .from("game_sessions")
    .select("id")
    .eq("house_id", house.houseId)
    .eq("status", "active")
    .maybeSingle()
  if (active) return { players: [], openSettlements: [] }

  const [accounts, players, settlements] = await Promise.all([
    fetchPlayerAccounts(supabase, house.houseId),
    supabase.from("players").select("id, name").eq("house_id", house.houseId).eq("active", true),
    supabase
      .from("settlements")
      .select("game_session_id, game_sessions(number), settlement_players(resolution)")
      .eq("house_id", house.houseId)
      .eq("status", "open"),
  ])
  if (players.error) throw players.error
  if (settlements.error) throw settlements.error

  return {
    players: players.data
      .map((p) => ({ ...accountFor(accounts, p.id), id: p.id, name: p.name }))
      .filter((p) => !p.inGame && needsAttention(p))
      .map(({ id, name, balance, status, note }) => ({ id, name, balance, status, note }))
      .sort((a, b) => a.balance - b.balance),
    openSettlements: settlements.data
      .map((s) => ({
        gameSessionId: s.game_session_id,
        number: s.game_sessions?.number ?? 0,
        unresolved: s.settlement_players.filter((p) => p.resolution === null).length,
      }))
      .filter((s) => s.unresolved > 0),
  }
}
