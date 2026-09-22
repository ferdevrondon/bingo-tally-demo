import { getBasePlayers } from "./players"
import type { ActivityEntry, DraftPlayer, RoundDraftState } from "./types"

export function hasDraftProgress(state: RoundDraftState): boolean {
  return (
    state.tickets.some((t) => t.numbers.some((n) => n.playerId !== null)) ||
    state.players.length > getBasePlayers().length
  )
}

export function getActivePlayers(state: RoundDraftState): DraftPlayer[] {
  const activeIds = new Set(
    state.tickets
      .flatMap((t) => t.numbers)
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
  ticketIds: string[]
}

export interface OwnedNumber {
  ticketId: string
  ticketIndex: number
  number: number
}

export function getPlayerNumbers(state: RoundDraftState, playerId: number): OwnedNumber[] {
  return state.tickets.flatMap((ticket) =>
    ticket.numbers
      .filter((n) => n.playerId === playerId)
      .map((n) => ({ ticketId: ticket.id, ticketIndex: ticket.index, number: n.number }))
  )
}

export function getWinnersForNumber(state: RoundDraftState, number: number): NumberWinner[] {
  const ticketIdsByPlayer = new Map<number, string[]>()
  state.tickets.forEach((ticket) => {
    const entry = ticket.numbers.find((n) => n.number === number)
    if (entry?.playerId == null) return
    const ticketIds = ticketIdsByPlayer.get(entry.playerId) ?? []
    ticketIds.push(ticket.id)
    ticketIdsByPlayer.set(entry.playerId, ticketIds)
  })
  return [...ticketIdsByPlayer.entries()].map(([playerId, ticketIds]) => {
    const player = state.players.find((p) => p.id === playerId)
    return { playerId, playerName: player?.name ?? "Jugador desconocido", ticketIds }
  })
}

export interface GameSummary {
  roundsPlayed: number
  houseBalance: number
  playersCount: number
  negativeBalanceTotal: number
  durationMs: number
}

export function getGameSummary(state: RoundDraftState): GameSummary {
  return {
    roundsPlayed: state.roundsPlayed,
    houseBalance: state.houseBalance,
    playersCount: state.gamePlayerIds.length,
    negativeBalanceTotal: state.players.reduce((sum, p) => sum + p.negativeBalance, 0),
    durationMs: Date.now() - state.gameStartedAt,
  }
}

export function getLastRechargeActivity(
  state: RoundDraftState,
  playerId: number
): ActivityEntry | null {
  return state.activity.find((a) => a.type === "recharge" && a.playerId === playerId) ?? null
}
