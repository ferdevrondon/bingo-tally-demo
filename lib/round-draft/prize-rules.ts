import { NUMBER_PRICE, type RoundDraftState } from "./types"

export type RoundKind = "regular" | "especial"

/** The round number currently being played, 1-indexed (rondas completadas + 1). */
export function getCurrentRoundNumber(roundsPlayed: number): number {
  return roundsPlayed + 1
}

/** Reglamento: rondas impares son regulares, rondas pares son especiales. */
export function getRoundKindForNumber(roundNumber: number): RoundKind {
  return roundNumber % 2 === 1 ? "regular" : "especial"
}

/** Regular: un número ganador. Especial: dos números ganadores. */
export function winnerCountForKind(kind: RoundKind): number {
  return kind === "especial" ? 2 : 1
}

const MULTIPLIERS: Record<RoundKind, number[]> = {
  regular: [10],
  especial: [10, 5],
}

/** Multiplicador sobre el precio de línea para el premio de ese slot ganador. */
export function prizeMultiplierForSlot(kind: RoundKind, slotIndex: number): number {
  return MULTIPLIERS[kind][slotIndex] ?? 0
}

/** Premio por cada línea (de $10) apostada en el número ganador de ese slot. */
export function computePerEntryPrize(kind: RoundKind, slotIndex: number, price = NUMBER_PRICE): number {
  return prizeMultiplierForSlot(kind, slotIndex) * price
}

/**
 * Delta a aplicar a houseBalance al cerrar la ronda, por líneas no vendidas y
 * líneas regaladas que no resultaron ganadoras (Reglamento reglas 4 y 5).
 * Líneas vendidas (pagadas) ya se contabilizan vía TOGGLE_CHECK_IN + AWARD_PRIZE;
 * líneas regaladas ganadoras ya se liquidan (90/10) dentro de AWARD_PRIZE — ambas
 * se excluyen aquí para no contar el mismo dinero dos veces.
 */
export function computeRoundMarginAdjustment(state: RoundDraftState): number {
  if (!state.round) return 0
  const kind = state.round.kind
  const winningNumbers = state.winningNumbers

  let delta = 0
  for (const ticket of state.tickets) {
    for (const entry of ticket.numbers) {
      const winningSlot = winningNumbers.findIndex((n) => n === entry.number)
      const isWinningNumber = winningSlot !== -1

      if (entry.playerId === null) {
        if (isWinningNumber) {
          delta += computePerEntryPrize(kind, winningSlot) - NUMBER_PRICE
        } else {
          delta -= NUMBER_PRICE
        }
        continue
      }

      if (entry.isGift && !isWinningNumber) {
        delta -= NUMBER_PRICE
      }
    }
  }
  return delta
}
