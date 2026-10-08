"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import type { GameActionResult } from "@/lib/data/game-action-result"
import { getCurrentHouse } from "@/lib/data/house"
import { rejectGameAction } from "@/lib/data/reject-game-action"
import { displayNameSchema, houseInputSchema, passwordSchema, type HouseInput } from "@/lib/house-settings"
import { createClient } from "@/lib/supabase/server"

// Configuración (/settings). House writes go through the SQL functions
// update_house / set_house_logo (admin only, by request id); the house id
// comes from the server. Account writes (display name, password) are the
// signed-in user's own, through Supabase Auth.

export type AccountError = "invalid" | "reauthentication_needed" | "same_password" | "weak_password" | "failed"

export type AccountResult = { ok: true } | { ok: false; error: AccountError }

const requestIdSchema = z.uuid()

export async function updateHouse(input: HouseInput, requestId: string): Promise<GameActionResult> {
  const parsed = houseInputSchema.safeParse(input)
  if (!parsed.success || !requestIdSchema.safeParse(requestId).success) {
    return { ok: false, error: "invalid" }
  }
  const house = await getCurrentHouse()
  if (!house || house.role !== "admin") return { ok: false, error: "read_only" }

  const supabase = await createClient()
  const { error } = await supabase.rpc("update_house", {
    p_house_id: house.houseId,
    p_name: parsed.data.name,
    p_identifier: parsed.data.identifier,
    p_timezone: parsed.data.timezone,
    p_phone: parsed.data.phone,
    p_request_id: requestId,
  })
  if (error) return rejectGameAction(supabase, error)
  refresh()
  return { ok: true, data: undefined }
}

/** Saves the path of a logo the admin just uploaded, or null to remove it. */
export async function setHouseLogo(path: string | null, requestId: string): Promise<GameActionResult> {
  const pathSchema = z.string().max(200).nullable()
  if (!pathSchema.safeParse(path).success || !requestIdSchema.safeParse(requestId).success) {
    return { ok: false, error: "invalid" }
  }
  const house = await getCurrentHouse()
  if (!house || house.role !== "admin") return { ok: false, error: "read_only" }

  const supabase = await createClient()
  const { error } = await supabase.rpc("set_house_logo", {
    p_house_id: house.houseId,
    p_logo_path: path as string,
    p_request_id: requestId,
  })
  if (error) return rejectGameAction(supabase, error)
  refresh()
  return { ok: true, data: undefined }
}

/** The name shown in the greeting and the sidebar (user_metadata.full_name). */
export async function updateDisplayName(name: string): Promise<AccountResult> {
  const parsed = displayNameSchema.safeParse(name)
  if (!parsed.success) return { ok: false, error: "invalid" }
  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ data: { full_name: parsed.data } })
  if (error) {
    console.error("display name update failed", error)
    return { ok: false, error: "failed" }
  }
  refresh()
  return { ok: true }
}

/** The signed-in user's own password; they type it, it is never stored here. */
export async function changePassword(password: string, confirm: string): Promise<AccountResult> {
  const parsed = passwordSchema.safeParse({ password, confirm })
  if (!parsed.success) return { ok: false, error: "invalid" }
  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (!error) return { ok: true }
  if (error.code === "reauthentication_needed") return { ok: false, error: "reauthentication_needed" }
  if (error.code === "same_password") return { ok: false, error: "same_password" }
  if (error.code === "weak_password") return { ok: false, error: "weak_password" }
  console.error("password change failed", error.code)
  return { ok: false, error: "failed" }
}
