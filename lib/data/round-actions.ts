"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { getCurrentHouse } from "@/lib/data/house"
import { rejectWrite } from "@/lib/data/reject-write"
import { ROUND_TEMPLATE_COLUMNS, toRound } from "@/lib/data/rounds"
import type { WriteResult } from "@/lib/data/write-result"
import { winnerCountForKind } from "@/lib/round-draft/prize-rules"
import { roundInputSchema, type Round, type RoundInput } from "@/lib/rounds"
import { createClient } from "@/lib/supabase/server"

// Catalog writes for /rounds. Same rules as lib/data/player-actions.ts: the
// user's own client, RLS decides, house_id comes from the server. Editing a
// template never changes a round already in progress (its line_price is
// copied onto game_session_rounds when the round starts, Phase 4).

const idSchema = z.number().int().positive()

function toRow(input: z.infer<typeof roundInputSchema>) {
  const winnerCount = winnerCountForKind(input.kind)
  return {
    name: input.name,
    kind: input.kind,
    // round_templates checks regular = 1 and special = 2 winners.
    winner_count: winnerCount,
    line_price: input.linePrice,
    prizes: input.prizes.slice(0, winnerCount),
  }
}

export async function createRoundTemplate(
  input: RoundInput
): Promise<WriteResult<Round>> {
  const parsed = roundInputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "invalid" }
  const house = await getCurrentHouse()
  if (!house) return { ok: false, error: "read_only" }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("round_templates")
    .insert({ house_id: house.houseId, ...toRow(parsed.data) })
    .select(ROUND_TEMPLATE_COLUMNS)
    .single()
  if (error) return rejectWrite(supabase, error)

  refresh()
  return { ok: true, data: toRound(data) }
}

export async function updateRoundTemplate(
  id: number,
  input: RoundInput
): Promise<WriteResult<Round>> {
  const parsed = roundInputSchema.safeParse(input)
  if (!parsed.success || !idSchema.safeParse(id).success)
    return { ok: false, error: "invalid" }
  const house = await getCurrentHouse()
  if (!house) return { ok: false, error: "read_only" }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("round_templates")
    .update(toRow(parsed.data))
    .eq("id", id)
    .eq("house_id", house.houseId)
    .select(ROUND_TEMPLATE_COLUMNS)
    .maybeSingle()
  if (error || !data) return rejectWrite(supabase, error)

  refresh()
  return { ok: true, data: toRound(data) }
}

// Soft delete: game_session_rounds keep pointing at the template.
export async function deactivateRoundTemplate(
  id: number
): Promise<WriteResult<{ id: number }>> {
  if (!idSchema.safeParse(id).success) return { ok: false, error: "invalid" }
  const house = await getCurrentHouse()
  if (!house) return { ok: false, error: "read_only" }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("round_templates")
    .update({ active: false })
    .eq("id", id)
    .eq("house_id", house.houseId)
    .select("id")
    .maybeSingle()
  if (error || !data) return rejectWrite(supabase, error)

  refresh()
  return { ok: true, data: { id: data.id } }
}
