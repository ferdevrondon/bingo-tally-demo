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
      (a) => a.type === "recharge" && a.playerId === playerId && a.correctsId === null
    ) ?? null
  )
}

export interface OpenStats {
  openTickets: number
  totalTickets: number
  freeLines: number
  totalLines: number
  /** What the free numbers would bring in: free lines × line price. */
  freeAmount: number
}

/** What is left to sell: tickets with at least one free number, free numbers
 *  (cells without a player) and their value. */
export function getOpenStats(state: RoundDraftState): OpenStats {
  const { unsold, totalLines } = getLineSaleStats(state)
  const openTickets = state.tickets.filter((t) =>
    t.numbers.some((n) => n.playerId === null)
  ).length
  return {
    openTickets,
    totalTickets: state.tickets.length,
    freeLines: unsold,
    totalLines,
    freeAmount: unsold * (state.round?.linePrice ?? 0),
  }
}

export interface PlayerGifts {
  playerId: number
  playerName: string
  /** Gifted numbers of the player, each once with the tickets it was gifted on. */
  numbers: { number: number; tickets: number }[]
}

export interface RoundGifts {
  players: PlayerGifts[]
  /** Gifted plays in this round. */
  giftCount: number
  /** Gifted plays whose number has not won yet. */
  pendingCount: number
}

export function getRoundGifts(state: RoundDraftState): RoundGifts {
  const winning = new Set(
    state.winningNumbers.filter((n): n is number => n !== null)
  )
  const byPlayer = new Map<number, PlayerGifts>()
  let giftCount = 0
  let pendingCount = 0
  state.tickets.forEach((ticket) => {
    ticket.numbers.forEach((entry) => {
      if (entry.playerId === null || !entry.isGift) return
      giftCount += 1
      if (!winning.has(entry.number)) pendingCount += 1
      const current = byPlayer.get(entry.playerId) ?? {
        playerId: entry.playerId,
        playerName:
          state.players.find((p) => p.id === entry.playerId)?.name ??
          "Jugador desconocido",
        numbers: [],
      }
      const same = current.numbers.find((n) => n.number === entry.number)
      if (same) same.tickets += 1
      else current.numbers.push({ number: entry.number, tickets: 1 })
      byPlayer.set(entry.playerId, current)
    })
  })
  const players = [...byPlayer.values()].map((p) => ({
    ...p,
    numbers: [...p.numbers].sort((a, b) => a.number - b.number),
  }))
  return {
    players,
    giftCount,
    pendingCount,
  }
}

export interface SlotWinner {
  playerId: number
  name: string
  /** What the player was paid for the number (summed over their tickets). */
  amount: number
}

/** Who has won each winning-number slot of the open round, read from the
 *  `prize_won` rows of the recent activity. An entry is `[]` when the number
 *  was drawn and nobody had it (its row has no player), and `null` when the
 *  slot is empty or its rows are not in the recent activity. */
export function getSlotWinners(state: RoundDraftState): (SlotWinner[] | null)[] {
  const roundId = state.round?.roundId ?? null
  return state.winningNumbers.map((number) => {
    if (number === null || roundId === null) return null
    const rows = state.activity.filter(
      (a) => a.type === "prize_won" && a.roundId === roundId && a.number === number
    )
    if (rows.length === 0) return null
    const byPlayer = new Map<number, SlotWinner>()
    for (const row of rows) {
      if (row.playerId === null) continue
      const winner = byPlayer.get(row.playerId) ?? {
        playerId: row.playerId,
        name: state.players.find((p) => p.id === row.playerId)?.name ?? "Jugador",
        amount: 0,
      }
      winner.amount += row.amount ?? 0
      byPlayer.set(row.playerId, winner)
    }
    return [...byPlayer.values()]
  })
}

/** The tickets where a winning number was left free: nobody is paid there, so
 *  the house just keeps what it collected (no extra income, cash basis). */
export function getHouseWin(state: RoundDraftState, number: number): { tickets: number } {
  const tickets = state.tickets.filter(
    (t) => t.numbers.find((n) => n.number === number)?.playerId === null
  ).length
  return { tickets }
}

/** Activity in a round that moves no money, so the round can still be swapped. */
const SWAPPABLE_ACTIVITY = new Set(["round_started", "check_in", "check_in_undone"])

/** The open round can be replaced by another one (`start_round`) while no
 *  winning number is drawn and nothing in it has been charged. Players with a
 *  pending carryover decision are charged by `resolve_carryover` at the round's
 *  price at that moment, so they don't block it. Mirrors the SQL guard. */
export function canChangeRound(state: RoundDraftState): boolean {
  const round = state.round
  if (!round) return false
  if (state.winningNumbers.some((n) => n !== null)) return false
  return state.activity.every(
    (a) => a.roundId !== round.roundId || SWAPPABLE_ACTIVITY.has(a.type)
  )
}
