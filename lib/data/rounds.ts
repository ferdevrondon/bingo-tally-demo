import { cache } from "react"

import { getCurrentHouse } from "@/lib/data/house"
import type { Round } from "@/lib/rounds"
import type { Database } from "@/lib/supabase/database.types"
import { createClient } from "@/lib/supabase/server"

type RoundTemplateRow = Database["public"]["Tables"]["round_templates"]["Row"]

export const ROUND_TEMPLATE_COLUMNS = "id, name, line_price, prizes"

export function toRound(
  row: Pick<RoundTemplateRow, "id" | "name" | "line_price" | "prizes">
): Round {
  return {
    id: row.id,
    name: row.name,
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
