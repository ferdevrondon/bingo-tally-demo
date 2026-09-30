import { cache } from "react"

import { isBank } from "@/lib/banks"
import { getCurrentHouse } from "@/lib/data/house"
import { isPaymentMethod } from "@/lib/payment-methods"
import type { Player } from "@/lib/players"
import type { Database } from "@/lib/supabase/database.types"
import { createClient } from "@/lib/supabase/server"

type PlayerRow = Database["public"]["Tables"]["players"]["Row"]

export const PLAYER_COLUMNS = "id, name, username, payment_method, bank, is_vip"

export function toPlayer(
  row: Pick<PlayerRow, "id" | "name" | "username" | "payment_method" | "bank" | "is_vip">
): Player {
  return {
    id: row.id,
    name: row.name,
    username: row.username ?? "",
    paymentMethod: isPaymentMethod(row.payment_method)
      ? row.payment_method
      : null,
    bank: isBank(row.bank) ? row.bank : null,
    isVip: row.is_vip,
  }
}

// Active players of the current house (soft-deleted ones are hidden). RLS
// limits the rows to houses the user belongs to.
export const listPlayers = cache(async (): Promise<Player[]> => {
  const house = await getCurrentHouse()
  if (!house) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("players")
    .select(PLAYER_COLUMNS)
    .eq("house_id", house.houseId)
    .eq("active", true)
    .order("id", { ascending: true })

  if (error) throw error
  return data.map(toPlayer)
})
