"use client"

import * as React from "react"

import { getBasePlayers } from "./players"
import { localRoundDraftRepository, type RoundDraftRepository } from "./storage"
import type { Carton, DraftPlayer, RoundDraftState } from "./types"

function createEmptyCarton(index: number): Carton {
  return {
    id: `carton-${index}-${Date.now()}`,
    index,
    numbers: Array.from({ length: 15 }, (_, i) => ({
      number: i + 1,
      playerId: null,
      isGift: false,
    })),
  }
}

function createInitialState(): RoundDraftState {
  return {
    cartones: [createEmptyCarton(1)],
    players: getBasePlayers(),
    activePlayerId: null,
  }
}

type Action =
  | { type: "HYDRATE"; payload: RoundDraftState }
  | { type: "ADD_CARTON" }
  | { type: "ADD_PLAYER"; payload: Omit<DraftPlayer, "id"> }
  | { type: "SET_ACTIVE_PLAYER"; payload: number | null }
  | { type: "ASSIGN_NUMBER"; payload: { cartonId: string; number: number } }
  | { type: "TOGGLE_GIFT"; payload: { cartonId: string; number: number } }

function reducer(state: RoundDraftState, action: Action): RoundDraftState {
  switch (action.type) {
    case "HYDRATE":
      return action.payload
    case "ADD_CARTON": {
      const nextIndex = state.cartones.length + 1
      return { ...state, cartones: [...state.cartones, createEmptyCarton(nextIndex)] }
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
      const { cartonId, number } = action.payload
      if (state.activePlayerId == null) return state
      return {
        ...state,
        cartones: state.cartones.map((carton) => {
          if (carton.id !== cartonId) return carton
          return {
            ...carton,
            numbers: carton.numbers.map((entry) => {
              if (entry.number !== number) return entry
              if (entry.playerId === null) {
                return { ...entry, playerId: state.activePlayerId, isGift: false }
              }
              if (entry.playerId === state.activePlayerId) {
                return { ...entry, playerId: null, isGift: false }
              }
              return entry
            }),
          }
        }),
      }
    }
    case "TOGGLE_GIFT": {
      const { cartonId, number } = action.payload
      return {
        ...state,
        cartones: state.cartones.map((carton) => {
          if (carton.id !== cartonId) return carton
          return {
            ...carton,
            numbers: carton.numbers.map((entry) =>
              entry.number === number && entry.playerId !== null
                ? { ...entry, isGift: !entry.isGift }
                : entry
            ),
          }
        }),
      }
    }
    default:
      return state
  }
}

interface RoundDraftContextValue {
  state: RoundDraftState
  addCarton: () => void
  addPlayer: (player: Omit<DraftPlayer, "id">) => void
  setActivePlayer: (playerId: number | null) => void
  assignNumber: (cartonId: string, number: number) => void
  toggleGift: (cartonId: string, number: number) => void
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
      addCarton: () => dispatch({ type: "ADD_CARTON" }),
      addPlayer: (player) => dispatch({ type: "ADD_PLAYER", payload: player }),
      setActivePlayer: (playerId) => dispatch({ type: "SET_ACTIVE_PLAYER", payload: playerId }),
      assignNumber: (cartonId, number) =>
        dispatch({ type: "ASSIGN_NUMBER", payload: { cartonId, number } }),
      toggleGift: (cartonId, number) =>
        dispatch({ type: "TOGGLE_GIFT", payload: { cartonId, number } }),
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
