"use client"

import * as React from "react"

import { getBasePlayers } from "./players"
import { getActivePlayers, getWinnersForNumber } from "./selectors"
import { localRoundDraftRepository, type RoundDraftRepository } from "./storage"
import {
  MAX_ACTIVITY_ENTRIES,
  NUMBER_PRICE,
  type ActivityEntry,
  type Ticket,
  type DraftPlayer,
  type DraftRoundConfig,
  type RoundDraftState,
} from "./types"

function createEmptyTicket(index: number): Ticket {
  return {
    id: `ticket-${index}-${Date.now()}`,
    index,
    numbers: Array.from({ length: 15 }, (_, i) => ({
      number: i + 1,
      playerId: null,
      isGift: false,
    })),
  }
}

function createSeedActivity(): ActivityEntry[] {
  const now = Date.now()
  // Newest first, matching the order real entries are prepended in.
  // This is demo/preview data so the feed has something to show before any
  // real action has been dispatched in a fresh draft.
  return [
    {
      id: "seed-round-started",
      timestamp: now - 2 * 60_000,
      type: "round_started",
      playerId: null,
      playerName: null,
      description: "Comenzó ronda 3",
      synthetic: true,
    },
    {
      id: "seed-check-in",
      timestamp: now - 4 * 60_000,
      type: "check_in",
      playerId: 6,
      playerName: "Sofía Castro",
      description: "Sofía Castro hizo check-in",
      synthetic: true,
    },
    {
      id: "seed-number-changed",
      timestamp: now - 7 * 60_000,
      type: "number_changed",
      playerId: 4,
      playerName: "Ana Torres",
      description: "Ana Torres cambió número 12 por 4",
      synthetic: true,
    },
    {
      id: "seed-number-purchased",
      timestamp: now - 10 * 60_000,
      type: "number_purchased",
      playerId: 5,
      playerName: "Luis Gómez",
      description: "Luis Gómez compró números 4, 7, 9",
      synthetic: true,
    },
    {
      id: "seed-number-gifted",
      timestamp: now - 15 * 60_000,
      type: "number_gifted",
      playerId: 2,
      playerName: "Maria Fernanda",
      description: "Número 8 regalado a Maria Fernanda",
      synthetic: true,
    },
    {
      id: "seed-recharge",
      timestamp: now - 22 * 60_000,
      type: "recharge",
      playerId: 4,
      playerName: "Ana Torres",
      description: "Ana Torres recargó $50",
      synthetic: true,
    },
    {
      id: "seed-player-removed",
      timestamp: now - 30 * 60_000,
      type: "player_removed",
      playerId: 7,
      playerName: "Pedro Sánchez",
      description: "Pedro Sánchez fue retirado de la ronda",
      synthetic: true,
    },
    {
      id: "seed-special-round-won",
      timestamp: now - 45 * 60_000,
      type: "special_round_won",
      playerId: 3,
      playerName: "Carlos Ruiz",
      description: "Carlos Ruiz ganó la ronda especial",
      synthetic: true,
    },
    {
      id: "seed-game-closed",
      timestamp: now - 90 * 60_000,
      type: "game_closed",
      playerId: null,
      playerName: null,
      description: "Cierre de jornada",
      synthetic: true,
    },
  ]
}

function createInitialState(): RoundDraftState {
  return {
    tickets: [createEmptyTicket(1)],
    players: getBasePlayers(),
    activePlayerId: null,
    activity: createSeedActivity(),
    round: null,
    winningNumbers: [],
    roundsPlayed: 0,
    gamePlayerIds: [],
    houseBalance: 0,
    gameStartedAt: Date.now(),
  }
}

function chargePlayer(players: DraftPlayer[], playerId: number, amount: number): DraftPlayer[] {
  return players.map((p) =>
    p.id === playerId ? { ...p, negativeBalance: p.negativeBalance + amount } : p
  )
}

function refundPlayer(players: DraftPlayer[], playerId: number, amount: number): DraftPlayer[] {
  return players.map((p) => {
    if (p.id !== playerId) return p
    const debtCleared = Math.min(p.negativeBalance, amount)
    return {
      ...p,
      negativeBalance: p.negativeBalance - debtCleared,
      positiveBalance: p.positiveBalance + (amount - debtCleared),
    }
  })
}

function trackGamePlayers(state: RoundDraftState): number[] {
  return [...new Set([...state.gamePlayerIds, ...getActivePlayers(state).map((p) => p.id)])]
}

function appendActivity(
  state: RoundDraftState,
  entry: Omit<ActivityEntry, "id" | "timestamp">
): RoundDraftState {
  const full: ActivityEntry = {
    ...entry,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
  }
  return { ...state, activity: [full, ...state.activity].slice(0, MAX_ACTIVITY_ENTRIES) }
}

type Action =
  | { type: "HYDRATE"; payload: RoundDraftState }
  | { type: "RESET" }
  | { type: "ADD_TICKET" }
  | { type: "ADD_PLAYER"; payload: Omit<DraftPlayer, "id"> }
  | { type: "SET_ACTIVE_PLAYER"; payload: number | null }
  | { type: "ASSIGN_NUMBER"; payload: { ticketId: string; number: number } }
  | { type: "TOGGLE_GIFT"; payload: { ticketId: string; number: number } }
  | { type: "TOGGLE_CHECK_IN"; payload: { playerId: number } }
  | {
      type: "SET_NUMBER_OWNER"
      payload: { ticketId: string; number: number; playerId: number | null }
    }
  | { type: "RECHARGE_BALANCE"; payload: { playerId: number; amount: number } }
  | { type: "REMOVE_PLAYER"; payload: { playerId: number } }
  | { type: "LOG_ACTIVITY"; payload: Omit<ActivityEntry, "id" | "timestamp"> }
  | { type: "SET_ROUND"; payload: DraftRoundConfig }
  | { type: "AWARD_PRIZE"; payload: { slotIndex: number; number: number } }
  | { type: "CLOSE_ROUND"; payload: { nextRound: DraftRoundConfig } }
  | {
      type: "RESOLVE_CARRYOVER"
      payload: { playerId: number; releaseNumbers: { ticketId: string; number: number }[] }
    }

function reducer(state: RoundDraftState, action: Action): RoundDraftState {
  switch (action.type) {
    case "HYDRATE":
      // Older saved drafts predate `checkedIn`/`pendingCarryOverDecision`/`activity`/`round`/`winningNumbers` and won't have them set.
      return {
        ...action.payload,
        players: action.payload.players.map((p) => ({
          ...p,
          checkedIn: p.checkedIn ?? false,
          pendingCarryOverDecision: p.pendingCarryOverDecision ?? false,
        })),
        tickets: action.payload.tickets ?? [createEmptyTicket(1)],
        activity: action.payload.activity ?? [],
        round: action.payload.round ?? null,
        winningNumbers: action.payload.winningNumbers ?? [],
        roundsPlayed: action.payload.roundsPlayed ?? 0,
        gamePlayerIds: action.payload.gamePlayerIds ?? [],
        houseBalance: action.payload.houseBalance ?? 0,
        gameStartedAt: action.payload.gameStartedAt ?? Date.now(),
      }
    case "RESET":
      return createInitialState()
    case "ADD_TICKET": {
      const nextIndex = state.tickets.length + 1
      return { ...state, tickets: [...state.tickets, createEmptyTicket(nextIndex)] }
    }
    case "ADD_PLAYER": {
      const nextId = Math.max(0, ...state.players.map((p) => p.id)) + 1
      const player: DraftPlayer = { id: nextId, ...action.payload }
      return {
        ...state,
        players: [...state.players, player],
        activePlayerId: nextId,
      }
    }
    case "SET_ACTIVE_PLAYER":
      return { ...state, activePlayerId: action.payload }
    case "ASSIGN_NUMBER": {
      const { ticketId, number } = action.payload
      if (state.activePlayerId == null) return state
      const player = state.players.find((p) => p.id === state.activePlayerId)
      let claimed = false
      let released = false
      let nextState: RoundDraftState = {
        ...state,
        tickets: state.tickets.map((ticket) => {
          if (ticket.id !== ticketId) return ticket
          return {
            ...ticket,
            numbers: ticket.numbers.map((entry) => {
              if (entry.number !== number) return entry
              if (entry.playerId === null) {
                claimed = true
                return { ...entry, playerId: state.activePlayerId, isGift: false }
              }
              if (entry.playerId === state.activePlayerId) {
                released = true
                return { ...entry, playerId: null, isGift: false }
              }
              return entry
            }),
          }
        }),
      }
      if (claimed && player) {
        nextState = {
          ...nextState,
          players: chargePlayer(nextState.players, player.id, NUMBER_PRICE),
        }
        nextState = { ...nextState, gamePlayerIds: trackGamePlayers(nextState) }
        return appendActivity(nextState, {
          type: "number_purchased",
          playerId: player.id,
          playerName: player.name,
          description: `${player.name} compró número ${number}`,
        })
      }
      if (released && player) {
        return {
          ...nextState,
          players: refundPlayer(nextState.players, player.id, NUMBER_PRICE),
        }
      }
      return nextState
    }
    case "TOGGLE_GIFT": {
      const { ticketId, number } = action.payload
      let gifted = false
      let giftedPlayerId: number | null = null
      const nextState: RoundDraftState = {
        ...state,
        tickets: state.tickets.map((ticket) => {
          if (ticket.id !== ticketId) return ticket
          return {
            ...ticket,
            numbers: ticket.numbers.map((entry) => {
              if (entry.number !== number || entry.playerId === null) return entry
              const nextIsGift = !entry.isGift
              if (nextIsGift) {
                gifted = true
                giftedPlayerId = entry.playerId
              }
              return { ...entry, isGift: nextIsGift }
            }),
          }
        }),
      }
      if (gifted && giftedPlayerId !== null) {
        const player = state.players.find((p) => p.id === giftedPlayerId)
        if (player) {
          return appendActivity(nextState, {
            type: "number_gifted",
            playerId: player.id,
            playerName: player.name,
            description: `Número ${number} regalado a ${player.name}`,
          })
        }
      }
      return nextState
    }
    case "TOGGLE_CHECK_IN": {
      const { playerId } = action.payload
      const player = state.players.find((p) => p.id === playerId)
      const checkedInNow = !!player && !player.checkedIn
      const clearedDebt = checkedInNow ? player!.negativeBalance : 0
      const nextState: RoundDraftState = {
        ...state,
        houseBalance: state.houseBalance + clearedDebt,
        players: state.players.map((p) => {
          if (p.id !== playerId) return p
          const nextCheckedIn = !p.checkedIn
          return {
            ...p,
            checkedIn: nextCheckedIn,
            negativeBalance: nextCheckedIn ? 0 : p.negativeBalance,
          }
        }),
      }
      if (checkedInNow && player) {
        return appendActivity(nextState, {
          type: "check_in",
          playerId: player.id,
          playerName: player.name,
          description:
            clearedDebt > 0
              ? `${player.name} hizo check-in (saldó $${clearedDebt})`
              : `${player.name} hizo check-in`,
        })
      }
      return nextState
    }
    case "SET_NUMBER_OWNER": {
      const { ticketId, number, playerId } = action.payload
      const ticket = state.tickets.find((t) => t.id === ticketId)
      const previousOwnerId = ticket?.numbers.find((n) => n.number === number)?.playerId ?? null

      let nextState: RoundDraftState = {
        ...state,
        tickets: state.tickets.map((t) => {
          if (t.id !== ticketId) return t
          return {
            ...t,
            numbers: t.numbers.map((entry) =>
              entry.number === number ? { ...entry, playerId, isGift: false } : entry
            ),
          }
        }),
      }

      let players = nextState.players
      if (previousOwnerId !== null) players = refundPlayer(players, previousOwnerId, NUMBER_PRICE)
      if (playerId !== null) players = chargePlayer(players, playerId, NUMBER_PRICE)
      nextState = { ...nextState, players }
      return { ...nextState, gamePlayerIds: trackGamePlayers(nextState) }
    }
    case "RECHARGE_BALANCE": {
      const { playerId, amount } = action.payload
      if (amount <= 0) return state
      const player = state.players.find((p) => p.id === playerId)
      const nextState: RoundDraftState = {
        ...state,
        houseBalance: state.houseBalance + amount,
        players: state.players.map((p) => {
          if (p.id !== playerId) return p
          const debtPaid = Math.min(p.negativeBalance, amount)
          const remainder = amount - debtPaid
          return {
            ...p,
            negativeBalance: p.negativeBalance - debtPaid,
            positiveBalance: p.positiveBalance + remainder,
          }
        }),
      }
      if (player) {
        return appendActivity(nextState, {
          type: "recharge",
          playerId: player.id,
          playerName: player.name,
          description: `${player.name} recargó $${amount}`,
        })
      }
      return nextState
    }
    case "REMOVE_PLAYER": {
      const { playerId } = action.payload
      const player = state.players.find((p) => p.id === playerId)
      const nextState: RoundDraftState = {
        ...state,
        tickets: state.tickets.map((ticket) => ({
          ...ticket,
          numbers: ticket.numbers.map((entry) =>
            entry.playerId === playerId ? { ...entry, playerId: null, isGift: false } : entry
          ),
        })),
        players: state.players.filter((p) => p.id !== playerId),
        activePlayerId: state.activePlayerId === playerId ? null : state.activePlayerId,
      }
      if (player) {
        return appendActivity(nextState, {
          type: "player_removed",
          playerId: player.id,
          playerName: player.name,
          description: `${player.name} fue retirado de la ronda`,
        })
      }
      return nextState
    }
    case "LOG_ACTIVITY":
      return appendActivity(state, action.payload)
    case "SET_ROUND": {
      const round = action.payload
      return {
        ...state,
        round,
        winningNumbers: Array.from({ length: round.winnerCount }, () => null),
      }
    }
    case "AWARD_PRIZE": {
      const { slotIndex, number } = action.payload
      if (!state.round) return state
      const prizeTotal = state.round.prizes[slotIndex] ?? 0
      const winners = getWinnersForNumber(state, number)

      let nextState: RoundDraftState = {
        ...state,
        winningNumbers: state.winningNumbers.map((n, i) => (i === slotIndex ? number : n)),
      }

      if (winners.length === 0) {
        return appendActivity(nextState, {
          type: "prize_won",
          playerId: null,
          playerName: null,
          description: `Nadie tiene el número ganador ${number} (premio $${prizeTotal} no se reparte)`,
        })
      }

      nextState = { ...nextState, houseBalance: nextState.houseBalance - prizeTotal }

      const share = prizeTotal / winners.length
      for (const winner of winners) {
        nextState = {
          ...nextState,
          players: nextState.players.map((p) => {
            if (p.id !== winner.playerId) return p
            const debtPaid = Math.min(p.negativeBalance, share)
            const remainder = share - debtPaid
            return {
              ...p,
              negativeBalance: p.negativeBalance - debtPaid,
              positiveBalance: p.positiveBalance + remainder,
            }
          }),
        }
        nextState = appendActivity(nextState, {
          type: "prize_won",
          playerId: winner.playerId,
          playerName: winner.playerName,
          description:
            winners.length > 1
              ? `${winner.playerName} ganó $${share} (número ${number}, premio $${prizeTotal} dividido entre ${winners.length})`
              : `${winner.playerName} ganó $${share} (número ${number})`,
        })
      }
      return nextState
    }
    case "CLOSE_ROUND": {
      const { nextRound } = action.payload
      const activeIds = new Set(getActivePlayers(state).map((p) => p.id))
      let nextState: RoundDraftState = {
        ...state,
        round: nextRound,
        winningNumbers: Array.from({ length: nextRound.winnerCount }, () => null),
        roundsPlayed: state.roundsPlayed + 1,
        players: state.players.map((p) =>
          activeIds.has(p.id) ? { ...p, checkedIn: false, pendingCarryOverDecision: true } : p
        ),
      }
      nextState = appendActivity(nextState, {
        type: "round_closed",
        playerId: null,
        playerName: null,
        description: `Cierre de ronda: ${state.round?.name ?? "ronda actual"}`,
      })
      return appendActivity(nextState, {
        type: "round_started",
        playerId: null,
        playerName: null,
        description: `Comenzó ronda: ${nextRound.name}`,
      })
    }
    case "RESOLVE_CARRYOVER": {
      const { playerId, releaseNumbers } = action.payload
      const player = state.players.find((p) => p.id === playerId)
      if (!player) return state

      let nextState: RoundDraftState = {
        ...state,
        tickets: state.tickets.map((ticket) => ({
          ...ticket,
          numbers: ticket.numbers.map((entry) => {
            const release = releaseNumbers.some(
              (r) =>
                r.ticketId === ticket.id && r.number === entry.number && entry.playerId === playerId
            )
            return release ? { ...entry, playerId: null, isGift: false } : entry
          }),
        })),
      }

      const remainingCount = nextState.tickets
        .flatMap((t) => t.numbers)
        .filter((n) => n.playerId === playerId).length
      const charge = remainingCount * NUMBER_PRICE

      nextState = {
        ...nextState,
        players: nextState.players.map((p) =>
          p.id === playerId
            ? {
                ...p,
                pendingCarryOverDecision: false,
                negativeBalance: p.negativeBalance + charge,
              }
            : p
        ),
      }

      if (releaseNumbers.length > 0) {
        nextState = appendActivity(nextState, {
          type: "numbers_released",
          playerId: player.id,
          playerName: player.name,
          description: `${player.name} liberó número${releaseNumbers.length > 1 ? "s" : ""} ${releaseNumbers.map((r) => r.number).join(", ")}`,
        })
      }
      if (charge > 0) {
        nextState = appendActivity(nextState, {
          type: "numbers_kept",
          playerId: player.id,
          playerName: player.name,
          description: `${player.name} mantiene su jugada, debe $${charge}`,
        })
      }
      return nextState
    }
    default:
      return state
  }
}

interface RoundDraftContextValue {
  state: RoundDraftState
  resetDraft: () => void
  addTicket: () => void
  addPlayer: (player: Omit<DraftPlayer, "id">) => void
  setActivePlayer: (playerId: number | null) => void
  assignNumber: (ticketId: string, number: number) => void
  toggleGift: (ticketId: string, number: number) => void
  toggleCheckIn: (playerId: number) => void
  setNumberOwner: (ticketId: string, number: number, playerId: number | null) => void
  rechargeBalance: (playerId: number, amount: number) => void
  removePlayer: (playerId: number) => void
  logActivity: (entry: Omit<ActivityEntry, "id" | "timestamp">) => void
  setRound: (round: DraftRoundConfig) => void
  awardPrize: (slotIndex: number, number: number) => void
  closeRound: (nextRound: DraftRoundConfig) => void
  resolveCarryOver: (
    playerId: number,
    releaseNumbers: { ticketId: string; number: number }[]
  ) => void
}

const RoundDraftContext = React.createContext<RoundDraftContextValue | null>(null)

export function RoundDraftProvider({
  children,
  repository = localRoundDraftRepository,
}: {
  children: React.ReactNode
  repository?: RoundDraftRepository
}) {
  const [state, dispatch] = React.useReducer(reducer, undefined, createInitialState)
  const [isHydrated, setIsHydrated] = React.useState(false)

  React.useEffect(() => {
    const loaded = repository.load()
    if (loaded) dispatch({ type: "HYDRATE", payload: loaded })
    setIsHydrated(true)
  }, [repository])

  React.useEffect(() => {
    // Skip the pre-hydration render so we never overwrite a saved draft
    // with the fresh default state before load() has been applied.
    if (!isHydrated) return
    repository.save(state)
  }, [state, isHydrated, repository])

  const value = React.useMemo<RoundDraftContextValue>(
    () => ({
      state,
      resetDraft: () => dispatch({ type: "RESET" }),
      addTicket: () => dispatch({ type: "ADD_TICKET" }),
      addPlayer: (player) => dispatch({ type: "ADD_PLAYER", payload: player }),
      setActivePlayer: (playerId) => dispatch({ type: "SET_ACTIVE_PLAYER", payload: playerId }),
      assignNumber: (ticketId, number) =>
        dispatch({ type: "ASSIGN_NUMBER", payload: { ticketId, number } }),
      toggleGift: (ticketId, number) =>
        dispatch({ type: "TOGGLE_GIFT", payload: { ticketId, number } }),
      toggleCheckIn: (playerId) => dispatch({ type: "TOGGLE_CHECK_IN", payload: { playerId } }),
      setNumberOwner: (ticketId, number, playerId) =>
        dispatch({ type: "SET_NUMBER_OWNER", payload: { ticketId, number, playerId } }),
      rechargeBalance: (playerId, amount) =>
        dispatch({ type: "RECHARGE_BALANCE", payload: { playerId, amount } }),
      removePlayer: (playerId) => dispatch({ type: "REMOVE_PLAYER", payload: { playerId } }),
      logActivity: (entry) => dispatch({ type: "LOG_ACTIVITY", payload: entry }),
      setRound: (round) => dispatch({ type: "SET_ROUND", payload: round }),
      awardPrize: (slotIndex, number) =>
        dispatch({ type: "AWARD_PRIZE", payload: { slotIndex, number } }),
      closeRound: (nextRound) => dispatch({ type: "CLOSE_ROUND", payload: { nextRound } }),
      resolveCarryOver: (playerId, releaseNumbers) =>
        dispatch({ type: "RESOLVE_CARRYOVER", payload: { playerId, releaseNumbers } }),
    }),
    [state]
  )

  return <RoundDraftContext.Provider value={value}>{children}</RoundDraftContext.Provider>
}

export function useRoundDraft() {
  const ctx = React.useContext(RoundDraftContext)
  if (!ctx) throw new Error("useRoundDraft must be used within a RoundDraftProvider")
  return ctx
}
