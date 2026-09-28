import { z } from "zod"

/** round_templates allows 1 to 5 prizes (winning numbers) per round. */
export const MAX_PRIZES = 5

// A round template from /rounds (public.round_templates). Business rule E:
// the admin sets the line price and the prize paid per winning ticket for
// each winning number; the number of winning numbers is `prizes.length`.
export interface Round {
  id: number
  name: string
  linePrice: number
  prizes: number[]
}

export type RoundInput = Omit<Round, "id">

// Shared by the form and the Server Actions (lib/data/round-actions.ts).
export const roundInputSchema = z.object({
  name: z.string().trim().min(1, "Ingresa un nombre"),
  linePrice: z.number().positive("El precio de línea debe ser mayor a 0"),
  prizes: z
    .array(z.number().positive("Cada premio debe ser mayor a 0"))
    .min(1, "Agrega al menos un premio")
    .max(MAX_PRIZES, `Máximo ${MAX_PRIZES} premios`),
})

export function formatMoney(value: number): string {
  return `$${Number.isInteger(value) ? value : value.toFixed(2)}`
}

/** Label used by the round pickers, e.g. "Regular · $10". */
export function roundOptionLabel(round: Round): string {
  return `${round.name} · ${formatMoney(round.linePrice)}`
}

/** "1 premio: $100" / "2 premios: $100 · $50". */
export function prizesLabel(prizes: number[]): string {
  const count = `${prizes.length} premio${prizes.length === 1 ? "" : "s"}`
  return `${count}: ${prizes.map(formatMoney).join(" · ")}`
}
