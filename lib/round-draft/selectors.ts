import { getBasePlayers } from "./players"
import type { ActivityEntry, DraftPlayer, RoundDraftState } from "./types"

export function hasDraftProgress(state: RoundDraftState): boolean {
  return (
    state.cartones.some((c) => c.numbers.some((n) => n.playerId !== null)) ||
    state.players.length > getBasePlayers().length
  )
}

export function getActivePlayers(state: RoundDraftState): DraftPlayer[] {
  const activeIds = new Set(
    state.cartones
      .flatMap((c) => c.numbers)
      .filter((n) => n.playerId !== null)
      .map((n) => n.playerId as number)
  )
  return state.players.filter((p) => activeIds.has(p.id))
}

export function getRecentActivity(state: RoundDraftState, limit = 20): ActivityEntry[] {
  return state.activity.slice(0, limit)
}

export interface NumberWinner {
  playerId: number
  playerName: string
  cartonIds: string[]
}

export interface OwnedNumber {
  cartonId: string
  cartonIndex: number
  number: number
}

export function getPlayerNumbers(state: RoundDraftState, playerId: number): OwnedNumber[] {
  return state.cartones.flatMap((carton) =>
    carton.numbers
      .filter((n) => n.playerId === playerId)
      .map((n) => ({ cartonId: carton.id, cartonIndex: carton.index, number: n.number }))
  )
}

export function getWinnersForNumber(state: RoundDraftState, number: number): NumberWinner[] {
  const cartonIdsByPlayer = new Map<number, string[]>()
  state.cartones.forEach((carton) => {
    const entry = carton.numbers.find((n) => n.number === number)
    if (entry?.playerId == null) return
    const cartonIds = cartonIdsByPlayer.get(entry.playerId) ?? []
    cartonIds.push(carton.id)
    cartonIdsByPlayer.set(entry.playerId, cartonIds)
  })
  return [...cartonIdsByPlayer.entries()].map(([playerId, cartonIds]) => {
    const player = state.players.find((p) => p.id === playerId)
    return { playerId, playerName: player?.name ?? "Jugador desconocido", cartonIds }
  })
}

export interface JornadaSummary {
  roundsPlayed: number
  houseBalance: number
  playersCount: number
  negativeBalanceTotal: number
  durationMs: number
}

export function getJornadaSummary(state: RoundDraftState): JornadaSummary {
  return {
    roundsPlayed: state.roundsPlayed,
    houseBalance: state.houseBalance,
    playersCount: state.jornadaPlayerIds.length,
    negativeBalanceTotal: state.players.reduce((sum, p) => sum + p.negativeBalance, 0),
    durationMs: Date.now() - state.jornadaStartedAt,
  }
}

export function getLastRechargeActivity(
  state: RoundDraftState,
  playerId: number
): ActivityEntry | null {
  return state.activity.find((a) => a.type === "recharge" && a.playerId === playerId) ?? null
}
