import roundsData from "@/app/(app)/rounds/data.json"

export interface Round {
  id: number
  name: string
  kind: "regular" | "especial"
  winnerCount: number
  prizes: number[]
}

function parseMoney(value: string): number {
  const parsed = Number.parseFloat(value.replace(/[^0-9.-]/g, ""))
  return Number.isFinite(parsed) ? parsed : 0
}

function parseKind(value: string): "regular" | "especial" {
  return value.trim().toLowerCase() === "especial" ? "especial" : "regular"
}

export function normalizeRounds(rows: typeof roundsData): Round[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.Nombre,
    kind: parseKind(row.Tipo),
    winnerCount: row["Numeros ganadores"],
    prizes: row.Premios.split(",").map((prize) => parseMoney(prize.trim())),
  }))
}

export function getBaseRounds(): Round[] {
  return normalizeRounds(roundsData)
}
