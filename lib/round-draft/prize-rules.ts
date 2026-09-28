// Mirrors the SQL rules in the game session functions migration
// (private.prize_multiplier). The database computes the persisted amounts,
// including the house margin at round close; these only drive the optimistic
// UI.

export type RoundKind = "regular" | "special"

/** The round number currently being played, 1-indexed (rondas completadas + 1). */
export function getCurrentRoundNumber(roundsPlayed: number): number {
  return roundsPlayed + 1
}

/** Regular: un número ganador. Especial: dos números ganadores. */
export function winnerCountForKind(kind: RoundKind): number {
  return kind === "special" ? 2 : 1
}

const MULTIPLIERS: Record<RoundKind, number[]> = {
  regular: [10],
  special: [10, 5],
}

/** Multiplicador sobre el precio de línea para el premio de ese slot ganador. */
export function prizeMultiplierForSlot(kind: RoundKind, slotIndex: number): number {
  return MULTIPLIERS[kind][slotIndex] ?? 0
}

/** Premio por cada línea apostada en el número ganador de ese slot. */
export function computePerEntryPrize(kind: RoundKind, slotIndex: number, price: number): number {
  return prizeMultiplierForSlot(kind, slotIndex) * price
}
