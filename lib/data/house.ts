import { cache } from "react"

import { createClient } from "@/lib/supabase/server"

export type HouseRole = "admin" | "observer"

export interface CurrentHouse {
  houseId: number
  houseName: string
  role: HouseRole
}

// getUser() revalidates with the Auth server, so cache it per request.
export const getCurrentUser = cache(async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
})

// The user's current house: their oldest membership, so the choice is
// deterministic until a house switcher exists. Returns null for a signed-in
// user who doesn't belong to any house yet. Cached per request so layouts and
// pages can both call it without a second query.
export const getCurrentHouse = cache(async (): Promise<CurrentHouse | null> => {
  const user = await getCurrentUser()
  if (!user) return null

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("house_members")
    .select("house_id, role, houses(name)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!data || !data.houses) return null

  return {
    houseId: data.house_id,
    houseName: data.houses.name,
    role: data.role === "admin" ? "admin" : "observer",
  }
})
