"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { getCurrentHouse } from "@/lib/data/house"
import { PLAYER_COLUMNS, toPlayer } from "@/lib/data/players"
import { rejectWrite } from "@/lib/data/reject-write"
import type { WriteResult } from "@/lib/data/write-result"
import { playerInputSchema, type Player, type PlayerInput } from "@/lib/players"
import { createClient } from "@/lib/supabase/server"

// Catalog writes for /players (and "Agregar nuevo" during a game). They run
// with the signed-in user's client, so RLS decides: only the house admin
// from their claimed login session can write. house_id always comes from the
// server, never from the caller.

const idSchema = z.number().int().positive()

function toRow(input: z.infer<typeof playerInputSchema>) {
  return {
    name: input.name,
    username: input.username || null,
    payment_method: input.paymentMethod,
    bank: input.bank,
    is_vip: input.isVip,
  }
}

export async function createPlayer(
  input: PlayerInput
): Promise<WriteResult<Player>> {
  const parsed = playerInputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "invalid" }
  const house = await getCurrentHouse()
  if (!house) return { ok: false, error: "read_only" }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("players")
    .insert({ house_id: house.houseId, ...toRow(parsed.data) })
    .select(PLAYER_COLUMNS)
    .single()
  if (error) return rejectWrite(supabase, error)

  refresh()
  return { ok: true, data: toPlayer(data) }
}

export async function updatePlayer(
  id: number,
  input: PlayerInput
): Promise<WriteResult<Player>> {
  const parsed = playerInputSchema.safeParse(input)
  if (!parsed.success || !idSchema.safeParse(id).success)
    return { ok: false, error: "invalid" }
  const house = await getCurrentHouse()
  if (!house) return { ok: false, error: "read_only" }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("players")
    .update(toRow(parsed.data))
    .eq("id", id)
    .eq("house_id", house.houseId)
    .select(PLAYER_COLUMNS)
    .maybeSingle()
  if (error || !data) return rejectWrite(supabase, error)

  refresh()
  return { ok: true, data: toPlayer(data) }
}

// Soft delete: the row stays because past game sessions reference it.
export async function deactivatePlayer(
  id: number
): Promise<WriteResult<{ id: number }>> {
  if (!idSchema.safeParse(id).success) return { ok: false, error: "invalid" }
  const house = await getCurrentHouse()
  if (!house) return { ok: false, error: "read_only" }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("players")
    .update({ active: false })
    .eq("id", id)
    .eq("house_id", house.houseId)
    .select("id")
    .maybeSingle()
  if (error || !data) return rejectWrite(supabase, error)

  refresh()
  return { ok: true, data: { id: data.id } }
}
