import { cache } from "react"

import { getCurrentHouse } from "@/lib/data/house"
import { toRoundKind, type Round } from "@/lib/rounds"
import type { Database } from "@/lib/supabase/database.types"
import { createClient } from "@/lib/supabase/server"

type RoundTemplateRow = Database["public"]["Tables"]["round_templates"]["Row"]

export const ROUND_TEMPLATE_COLUMNS = "id, name, kind, line_price, prizes"

export function toRound(
  row: Pick<RoundTemplateRow, "id" | "name" | "kind" | "line_price" | "prizes">
): Round {
  return {
    id: row.id,
    name: row.name,
    kind: toRoundKind(row.kind),
    linePrice: Number(row.line_price),
    prizes: row.prizes.map(Number),
  }
}

// Active round templates of the current house, as configured on /rounds.
export const listRoundTemplates = cache(async (): Promise<Round[]> => {
  const house = await getCurrentHouse()
  if (!house) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("round_templates")
    .select(ROUND_TEMPLATE_COLUMNS)
    .eq("house_id", house.houseId)
    .eq("active", true)
    .order("id", { ascending: true })

  if (error) throw error
  return data.map(toRound)
})

// Templates in the pattern of the house's active automatic game session, so
// /rounds can warn before deactivating one (it could no longer be played).
export const listActivePatternTemplateIds = cache(async (): Promise<number[]> => {
  const house = await getCurrentHouse()
  if (!house) return []

  const supabase = await createClient()
  const { data: session, error } = await supabase
    .from("game_sessions")
    .select("id")
    .eq("house_id", house.houseId)
    .eq("status", "active")
    .eq("round_mode", "auto")
    .maybeSingle()
  if (error) throw error
  if (!session) return []

  const { data, error: patternError } = await supabase
    .from("game_session_round_pattern")
    .select("round_template_id")
    .eq("game_session_id", session.id)
  if (patternError) throw patternError
  return [...new Set(data.map((row) => row.round_template_id))]
})
