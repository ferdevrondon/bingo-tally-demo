"use client"

import * as React from "react"

import type { CurrentHouse, HouseRole } from "@/lib/data/house"

const HouseContext = React.createContext<CurrentHouse | null>(null)

// Resolved on the server in app/(app)/layout.tsx and handed down so client
// components can gate admin-only controls. The database (RLS) is the real
// guard; this only decides what the UI shows.
export function HouseProvider({
  house,
  children,
}: {
  house: CurrentHouse | null
  children: React.ReactNode
}) {
  return <HouseContext.Provider value={house}>{children}</HouseContext.Provider>
}

export function useHouse(): CurrentHouse | null {
  return React.useContext(HouseContext)
}

// null when the signed-in user doesn't belong to any house.
export function useRole(): HouseRole | null {
  return React.useContext(HouseContext)?.role ?? null
}
