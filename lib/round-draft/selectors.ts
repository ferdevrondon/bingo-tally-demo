import type { ActivityEntry, DraftPlayer, RoundDraftState } from "./types"

/** The game session has at least one round (open or closed): it can no
 *  longer be discarded ("Salir y borrar"), and /active-round has a game. */
export function hasRounds(state: RoundDraftState): boolean {
  return state.round !== null || state.rounds.length > 0
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

export function getRecentActivity(
  state: RoundDraftState,
  limit = 20
): ActivityEntry[] {
  return state.activity.slice(0, limit)
}

export interface NumberWinnerEntry {
  ticketId: number
  isGift: boolean
}

export interface NumberWinner {
  playerId: number
  playerName: string
  entries: NumberWinnerEntry[]
}

export interface OwnedNumber {
  ticketId: number
  ticketIndex: number
  number: number
}

export function getPlayerNumbers(
  state: RoundDraftState,
  playerId: number
): OwnedNumber[] {
  return state.tickets.flatMap((ticket) =>
    ticket.numbers
      .filter((n) => n.playerId === playerId)
      .map((n) => ({
        ticketId: ticket.id,
        ticketIndex: ticket.index,
        number: n.number,
      }))
  )
}

export interface PlayerNumberSummary {
  number: number
  /** Plays of this number (one per ticket where the player holds it). */
  count: number
  /** How many of those plays are gifts. */
  gifts: number
}

/** A player's numbers without repeats: each number once, with how many
 *  tickets they hold it on and how many are gifts, by number. */
export function getPlayerNumberSummary(
  state: RoundDraftState,
  playerId: number
): PlayerNumberSummary[] {
  const byNumber = new Map<number, PlayerNumberSummary>()
  state.tickets.forEach((ticket) => {
    ticket.numbers.forEach((entry) => {
      if (entry.playerId !== playerId) return
      const summary = byNumber.get(entry.number) ?? {
        number: entry.number,
        count: 0,
        gifts: 0,
      }
      summary.count += 1
      if (entry.isGift) summary.gifts += 1
      byNumber.set(entry.number, summary)
    })
  })
  return [...byNumber.values()].sort((a, b) => a.number - b.number)
}

export function getWinnersForNumber(
  state: RoundDraftState,
  number: number
): NumberWinner[] {
  const entriesByPlayer = new Map<number, NumberWinnerEntry[]>()
  state.tickets.forEach((ticket) => {
    const entry = ticket.numbers.find((n) => n.number === number)
    if (entry?.playerId == null) return
    const entries = entriesByPlayer.get(entry.playerId) ?? []
    entries.push({ ticketId: ticket.id, isGift: entry.isGift })
    entriesByPlayer.set(entry.playerId, entries)
  })
  return [...entriesByPlayer.entries()].map(([playerId, entries]) => {
    const player = state.players.find((p) => p.id === playerId)
    return {
      playerId,
      playerName: player?.name ?? "Jugador desconocido",
      entries,
    }
  })
}

export interface LineSaleStats {
  soldPaid: number
  soldGift: number
  unsold: number
  totalLines: number
}

export function getLineSaleStats(state: RoundDraftState): LineSaleStats {
  const allEntries = state.tickets.flatMap((t) => t.numbers)
  const soldGift = allEntries.filter(
    (n) => n.playerId !== null && n.isGift
  ).length
  const soldPaid = allEntries.filter(
    (n) => n.playerId !== null && !n.isGift
  ).length
  const unsold = allEntries.filter((n) => n.playerId === null).length
  return { soldPaid, soldGift, unsold, totalLines: allEntries.length }
}

export function getLastRechargeActivity(
  state: RoundDraftState,
  playerId: number
): ActivityEntry | null {
  return (
    state.activity.find(
      (a) => a.type === "recharge" && a.playerId === playerId
    ) ?? null
  )
}
