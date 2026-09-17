import playersData from "@/app/(app)/players/data.json"

import type { DraftPlayer } from "./types"

function parseMoney(value: string): number {
  const parsed = Number.parseFloat(value.replace(/[^0-9.-]/g, ""))
  return Number.isFinite(parsed) ? parsed : 0
}

export function normalizePlayers(rows: typeof playersData): DraftPlayer[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.Nombre,
    positiveBalance: parseMoney(row["saldo positivo"]),
    negativeBalance: parseMoney(row["saldo negativo"]),
    checkedIn: false,
    pendingCarryOverDecision: false,
  }))
}

export function getBasePlayers(): DraftPlayer[] {
  return normalizePlayers(playersData)
}
