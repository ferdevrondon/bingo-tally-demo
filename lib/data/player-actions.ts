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
    nickname: input.nickname || null,
    payment_method: input.paymentMethod,
    bank: input.bank,
    phone: input.phone || null,
    email: input.email || null,
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

const missingNamesSchema = z.object({
  playerId: idSchema,
  name: z.string().trim().toUpperCase().max(100).optional(),
  nickname: z.string().trim().toUpperCase().max(50).optional(),
})

// The settlement's "Recibir pago" / "Registrar pago" shows the player's name
// and nickname as they are and asks only for the missing one: what the host
// types fills the player's empty field, it never replaces one that exists.
export async function completePlayerNames(input: {
  playerId: number
  name?: string
  nickname?: string
}): Promise<WriteResult<Player>> {
  const parsed = missingNamesSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "invalid" }
  const house = await getCurrentHouse()
  if (!house) return { ok: false, error: "read_only" }

  const supabase = await createClient()
  const { data: current, error: readError } = await supabase
    .from("players")
    .select("name, nickname")
    .eq("id", parsed.data.playerId)
    .eq("house_id", house.houseId)
    .maybeSingle()
  if (readError || !current) return rejectWrite(supabase, readError)

  const patch = {
    ...(parsed.data.name && !current.name?.trim() ? { name: parsed.data.name } : {}),
    ...(parsed.data.nickname && !current.nickname?.trim()
      ? { nickname: parsed.data.nickname }
      : {}),
  }
  const { data, error } =
    Object.keys(patch).length === 0
      ? await supabase
          .from("players")
          .select(PLAYER_COLUMNS)
          .eq("id", parsed.data.playerId)
          .eq("house_id", house.houseId)
          .maybeSingle()
      : await supabase
          .from("players")
          .update(patch)
          .eq("id", parsed.data.playerId)
          .eq("house_id", house.houseId)
          .select(PLAYER_COLUMNS)
          .maybeSingle()
  if (error || !data) return rejectWrite(supabase, error)

  refresh()
  return { ok: true, data: toPlayer(data) }
}

const idsSchema = z.array(idSchema).min(1).max(200)

// Soft delete of several players at once (the checks of /players). One
// update, so it is all or nothing: RLS turns a forbidden update into fewer
// rows, which is reported as a failure and never as a success.
export async function deactivatePlayers(
  ids: number[]
): Promise<WriteResult<{ count: number }>> {
  const parsed = idsSchema.safeParse(ids)
  if (!parsed.success) return { ok: false, error: "invalid" }
  const unique = [...new Set(parsed.data)]
  const house = await getCurrentHouse()
  if (!house) return { ok: false, error: "read_only" }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("players")
    .update({ active: false })
    .in("id", unique)
    .eq("house_id", house.houseId)
    .select("id")
  if (error || !data || data.length !== unique.length) {
    return rejectWrite(supabase, error)
  }

  refresh()
  return { ok: true, data: { count: data.length } }
}
