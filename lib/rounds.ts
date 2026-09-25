import { z } from "zod"

import type { RoundKind } from "@/lib/round-draft/prize-rules"

// A round template from /rounds (public.round_templates). `prizes` is
// informational only: the paid prize always derives from `kind` and
// `linePrice` (lib/round-draft/prize-rules.ts).
export interface Round {
  id: number
  name: string
  kind: RoundKind
  winnerCount: number
  linePrice: number
  prizes: number[]
}

export type RoundInput = Omit<Round, "id" | "winnerCount">

// Shared by the form and the Server Actions (lib/data/round-actions.ts).
// winnerCount is derived from kind, as the round_templates check requires.
export const roundInputSchema = z.object({
  name: z.string().trim().min(1, "Ingresa un nombre"),
  kind: z.enum(["regular", "special"]),
  linePrice: z.number().positive("El precio de línea debe ser mayor a 0"),
  prizes: z.array(z.number().nonnegative()),
})

export function roundKindLabel(kind: RoundKind): string {
  return kind === "special" ? "Especial" : "Regular"
}

export function formatMoney(value: number): string {
  return `$${Number.isInteger(value) ? value : value.toFixed(2)}`
}

/** Label used by the round pickers, e.g. "Regular · $10". */
export function roundOptionLabel(round: Round): string {
  return `${round.name} · ${formatMoney(round.linePrice)}`
}
