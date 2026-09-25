"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { useHouse } from "@/components/house-provider"
import {
  GAME_ACTION_ERROR_MESSAGES,
  type GameActionResult,
} from "@/lib/data/game-action-result"
import type { PaymentMethod } from "@/lib/payment-methods"
import type { Round } from "@/lib/rounds"
import { createClient } from "@/lib/supabase/client"

import { fetchGameSessionState } from "./fetch-state"
import { createGameApi, type GameSessionSummary, type NumberEdit } from "./game-api"
import { computePerEntryPrize } from "./prize-rules"
import { getWinnersForNumber } from "./selectors"
import type { DraftPlayer, RoundDraftState } from "./types"

// Live game state. The database is the source of truth (BACKEND_PLAN.md §5):
// app/(app)/(game)/layout.tsx loads the active game session and passes it as
// `initialState`. Frequent actions are applied here first (optimistic, same
// rules as the SQL functions) so the screen reacts instantly, then sent to
// their SQL function from the browser (./game-api.ts) through an ordered
// queue. Once the queue is idle, the game session is read again in the
// background and replaces the local state, unless a new action started in
// the meantime; that brings the timeline and corrects any difference.

type Position = { ticketId: number; number: number }

type Action =
  | { type: "HYDRATE"; payload: RoundDraftState }
  | { type: "SET_ACTIVE_PLAYER"; payload: number | null }
  | { type: "CLAIM_NUMBER"; payload: Position & { playerId: number } }
  | { type: "RELEASE_NUMBER"; payload: Position }
  | { type: "SET_NUMBER_OWNER"; payload: Position & { playerId: number | null } }
  | { type: "TOGGLE_GIFT"; payload: Position }
  | { type: "CHECK_IN"; payload: { playerId: number } }
  | { type: "UNDO_CHECK_IN"; payload: { playerId: number } }
  | { type: "RECHARGE_BALANCE"; payload: { playerId: number; amount: number } }
  | { type: "REMOVE_PLAYER"; payload: { playerId: number } }
  | { type: "AWARD_PRIZE"; payload: { slotIndex: number; number: number } }
  | { type: "RESOLVE_CARRYOVER"; payload: { playerId: number; releaseNumbers: Position[] } }

function updatePlayer(
  players: DraftPlayer[],
  playerId: number,
  update: (player: DraftPlayer) => DraftPlayer
): DraftPlayer[] {
  return players.map((p) => (p.id === playerId ? update(p) : p))
}

/** Purchases always create debt (rule 10) and undo a previous check-in. The
 *  player joins the game session if needed. */
function chargePlayer(players: DraftPlayer[], playerId: number, amount: number) {
  return updatePlayer(players, playerId, (p) => ({
    ...p,
    negativeBalance: p.negativeBalance + amount,
    checkedIn: false,
    inSession: true,
    removed: false,
  }))
}

/** "Pay debt first": the amount clears debt, the rest becomes credit. */
function creditPlayer(players: DraftPlayer[], playerId: number, amount: number) {
  return updatePlayer(players, playerId, (p) => {
    const debtPaid = Math.min(p.negativeBalance, amount)
    return {
      ...p,
      negativeBalance: p.negativeBalance - debtPaid,
      positiveBalance: p.positiveBalance + (amount - debtPaid),
    }
  })
}

function findEntry(state: RoundDraftState, { ticketId, number }: Position) {
  return state.tickets.find((t) => t.id === ticketId)?.numbers.find((n) => n.number === number)
}

function setEntry(
  state: RoundDraftState,
  { ticketId, number }: Position,
  next: { playerId: number | null; isGift: boolean }
): RoundDraftState {
  return {
    ...state,
    tickets: state.tickets.map((t) =>
      t.id !== ticketId
        ? t
        : { ...t, numbers: t.numbers.map((n) => (n.number === number ? { ...n, ...next } : n)) }
    ),
  }
}

function reducer(state: RoundDraftState, action: Action): RoundDraftState {
  const price = state.round?.linePrice ?? 0

  switch (action.type) {
    case "HYDRATE": {
      // The active player is UI-only: keep it while it is still selectable.
      const keepActive = action.payload.players.some(
        (p) => p.id === state.activePlayerId && !p.removed
      )
      return { ...action.payload, activePlayerId: keepActive ? state.activePlayerId : null }
    }
    case "SET_ACTIVE_PLAYER":
      return { ...state, activePlayerId: action.payload }
    case "CLAIM_NUMBER": {
      const entry = findEntry(state, action.payload)
      if (!entry || entry.playerId !== null) return state
      const next = setEntry(state, action.payload, {
        playerId: action.payload.playerId,
        isGift: false,
      })
      return { ...next, players: chargePlayer(next.players, action.payload.playerId, price) }
    }
    case "RELEASE_NUMBER": {
      const entry = findEntry(state, action.payload)
      if (!entry || entry.playerId === null) return state
      const next = setEntry(state, action.payload, { playerId: null, isGift: false })
      // A gifted number was never paid for: nothing to refund.
      return entry.isGift
        ? next
        : { ...next, players: creditPlayer(next.players, entry.playerId, price) }
    }
    case "SET_NUMBER_OWNER": {
      const entry = findEntry(state, action.payload)
      if (!entry || entry.playerId === action.payload.playerId) return state
      const next = setEntry(state, action.payload, {
        playerId: action.payload.playerId,
        isGift: false,
      })
      let players = next.players
      if (entry.playerId !== null && !entry.isGift) {
        players = creditPlayer(players, entry.playerId, price)
      }
      if (action.payload.playerId !== null) {
        players = chargePlayer(players, action.payload.playerId, price)
      }
      return { ...next, players }
    }
    case "TOGGLE_GIFT": {
      const entry = findEntry(state, action.payload)
      if (!entry || entry.playerId === null) return state
      const next = setEntry(state, action.payload, {
        playerId: entry.playerId,
        isGift: !entry.isGift,
      })
      // A gifted number costs the player nothing; un-gifting charges it again.
      return {
        ...next,
        players: entry.isGift
          ? chargePlayer(next.players, entry.playerId, price)
          : creditPlayer(next.players, entry.playerId, price),
      }
    }
    case "CHECK_IN": {
      const player = state.players.find((p) => p.id === action.payload.playerId)
      if (!player || player.checkedIn) return state
      return {
        ...state,
        houseBalance: state.houseBalance + player.negativeBalance,
        players: updatePlayer(state.players, player.id, (p) => ({
          ...p,
          negativeBalance: 0,
          checkedIn: true,
        })),
      }
    }
    case "UNDO_CHECK_IN":
      // The debt paid at check-in is not restored.
      return {
        ...state,
        players: updatePlayer(state.players, action.payload.playerId, (p) => ({
          ...p,
          checkedIn: false,
        })),
      }
    case "RECHARGE_BALANCE": {
      const { playerId, amount } = action.payload
      if (amount <= 0) return state
      const players = updatePlayer(state.players, playerId, (p) => ({
        ...p,
        inSession: true,
        removed: false,
      }))
      return {
        ...state,
        houseBalance: state.houseBalance + amount,
        players: creditPlayer(players, playerId, amount),
      }
    }
    case "REMOVE_PLAYER": {
      // Numbers are freed without refund; the balances stay for the settlement.
      const { playerId } = action.payload
      return {
        ...state,
        tickets: state.tickets.map((ticket) => ({
          ...ticket,
          numbers: ticket.numbers.map((entry) =>
            entry.playerId === playerId ? { ...entry, playerId: null, isGift: false } : entry
          ),
        })),
        players: updatePlayer(state.players, playerId, (p) => ({
          ...p,
          removed: true,
          checkedIn: false,
          pendingCarryOverDecision: false,
        })),
        activePlayerId: state.activePlayerId === playerId ? null : state.activePlayerId,
      }
    }
    case "AWARD_PRIZE": {
      const { slotIndex, number } = action.payload
      if (!state.round) return state
      const fullPrize = computePerEntryPrize(state.round.kind, slotIndex, price)
      let next: RoundDraftState = {
        ...state,
        winningNumbers: state.winningNumbers.map((n, i) => (i === slotIndex ? number : n)),
      }
      // One prize per ticket: full for a paid ticket, 90% for a gifted one.
      for (const winner of getWinnersForNumber(state, number)) {
        for (const entry of winner.entries) {
          const prize = entry.isGift ? Math.round(fullPrize * 0.9 * 100) / 100 : fullPrize
          next = {
            ...next,
            houseBalance: next.houseBalance - prize,
            players: creditPlayer(next.players, winner.playerId, prize),
          }
        }
      }
      return next
    }
    case "RESOLVE_CARRYOVER": {
      const { playerId, releaseNumbers } = action.payload
      const released = new Set(releaseNumbers.map((r) => `${r.ticketId}:${r.number}`))
      const tickets = state.tickets.map((ticket) => ({
        ...ticket,
        numbers: ticket.numbers.map((entry) =>
          entry.playerId === playerId && released.has(`${ticket.id}:${entry.number}`)
            ? { ...entry, playerId: null, isGift: false }
            : entry
        ),
      }))
      // Each kept number is charged for the new round; gifted ones never are.
      const kept = tickets
        .flatMap((t) => t.numbers)
        .filter((n) => n.playerId === playerId && !n.isGift).length
      const charge = kept * price
      return {
        ...state,
        tickets,
        players: updatePlayer(state.players, playerId, (p) => ({
          ...p,
          pendingCarryOverDecision: false,
          negativeBalance: p.negativeBalance + charge,
          checkedIn: charge > 0 ? false : p.checkedIn,
        })),
      }
    }
    default:
      return state
  }
}

export type { NumberEdit }

interface RoundDraftContextValue {
  state: RoundDraftState
  /** Active round templates of the house (/rounds), loaded by app/(app)/(game)/layout.tsx. */
  roundTemplates: Round[]
  setActivePlayer: (playerId: number | null) => void
  /** Claims a free number for the active player, or releases their own. */
  assignNumber: (ticketId: number, number: number) => void
  toggleGift: (ticketId: number, number: number) => void
  /** Check-in: the whole debt is taken as paid, with the player's default
   *  payment method (players.payment_method, "other" when unset). */
  checkIn: (playerId: number) => void
  undoCheckIn: (playerId: number) => void
  /** `requestKey` identifies the user's recharge (one per dialog opening), so
   *  a double click records it once. */
  rechargeBalance: (
    playerId: number,
    amount: number,
    paymentMethod: PaymentMethod,
    note: string | null,
    requestKey: string
  ) => void
  removePlayer: (playerId: number) => void
  editPlayerNumbers: (playerId: number, changes: NumberEdit[]) => void
  awardPrize: (slotIndex: number, number: number) => void
  resolveCarryOver: (playerId: number, releaseNumbers: Position[]) => void
  // Structural actions: not optimistic; they resolve once saved.
  addTicket: () => Promise<boolean>
  startRound: (roundTemplateId: number) => Promise<boolean>
  closeRound: (nextRoundTemplateId: number) => Promise<boolean>
  endGameSession: () => Promise<GameSessionSummary | null>
  discardGameSession: () => Promise<boolean>
}

const RoundDraftContext = React.createContext<RoundDraftContextValue | null>(null)

function requestId() {
  return crypto.randomUUID()
}

const RESYNC_DELAY_MS = 300

export function RoundDraftProvider({
  children,
  initialState,
  roundTemplates,
}: {
  children: React.ReactNode
  /** The active game session as saved (lib/data/load-game-session.ts). */
  initialState: RoundDraftState
  roundTemplates: Round[]
}) {
  const router = useRouter()
  const house = useHouse()
  const houseId = house?.houseId ?? null
  const api = React.useMemo(() => createGameApi(house?.role === "admin"), [house?.role])

  const [state, dispatch] = React.useReducer(reducer, initialState)
  const stateRef = React.useRef(state)
  const queue = React.useRef<Promise<unknown>>(Promise.resolve())
  const inFlight = React.useRef(0)
  // Bumped when an action starts: a re-sync read before it is stale.
  const version = React.useRef(0)
  const resyncTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const submittedRecharges = React.useRef(new Set<string>())

  React.useEffect(() => {
    stateRef.current = state
  }, [state])

  // A new server state (first load, or a router refresh such as after
  // creating a player) replaces the local one when no action is in flight.
  React.useEffect(() => {
    if (inFlight.current === 0) dispatch({ type: "HYDRATE", payload: initialState })
  }, [initialState])

  React.useEffect(
    () => () => {
      if (resyncTimer.current) clearTimeout(resyncTimer.current)
    },
    []
  )

  const resync = React.useCallback(() => {
    async function attempt(n: number): Promise<void> {
      if (houseId === null) return
      const startVersion = version.current
      try {
        const saved = await fetchGameSessionState(createClient(), houseId)
        if (inFlight.current > 0 || version.current !== startVersion) return
        if (saved) dispatch({ type: "HYDRATE", payload: saved })
        // The game session ended (or was discarded) elsewhere.
        else router.refresh()
      } catch (error) {
        console.error("game session re-sync failed", error)
        // Retry so an optimistic change the database rejected can't stay on screen.
        if (n < 3) setTimeout(() => void attempt(n + 1), 1000 * n)
        else toast.error("No se pudo actualizar la jornada. Recarga la página.")
      }
    }
    return attempt(1)
  }, [houseId, router])

  const scheduleResync = React.useCallback(() => {
    if (resyncTimer.current) clearTimeout(resyncTimer.current)
    resyncTimer.current = setTimeout(() => void resync(), RESYNC_DELAY_MS)
  }, [resync])

  // Optimistic dispatch now, the SQL call in order after the previous ones.
  // Then a re-sync: scheduled (frequent actions), awaited (structural ones,
  // so the new ticket or round is on screen when they resolve) or none (the
  // game session is ending or being discarded and the page is left).
  const perform = React.useCallback(
    async <T,>(
      optimistic: Action[],
      call: () => Promise<GameActionResult<T>>,
      { resync: resyncMode = "schedule" }: { resync?: "schedule" | "await" | "none" } = {}
    ): Promise<GameActionResult<T>> => {
      version.current += 1
      inFlight.current += 1
      optimistic.forEach(dispatch)
      const pending = queue.current.then(call, call)
      queue.current = pending.catch(() => undefined)
      let result: GameActionResult<T>
      try {
        result = await pending
      } catch (error) {
        console.error("game session action failed", error)
        result = { ok: false, error: "failed" }
      } finally {
        inFlight.current -= 1
      }
      if (!result.ok && result.error !== "session_replaced") {
        toast.error(GAME_ACTION_ERROR_MESSAGES[result.error])
      }
      if (inFlight.current === 0) {
        if (resyncMode === "await") await resync()
        else if (resyncMode === "schedule") scheduleResync()
        else if (resyncTimer.current) clearTimeout(resyncTimer.current)
      }
      return result
    },
    [resync, scheduleResync]
  )

  const value = React.useMemo<RoundDraftContextValue>(() => {
    const gameSessionId = state.gameSessionId
    const roundId = state.round?.roundId ?? null

    return {
      state,
      roundTemplates,
      setActivePlayer: (playerId) => dispatch({ type: "SET_ACTIVE_PLAYER", payload: playerId }),
      assignNumber: (ticketId, number) => {
        const current = stateRef.current
        const playerId = current.activePlayerId
        if (playerId === null) return
        const position = { ticketId, number }
        const entry = findEntry(current, position)
        if (entry?.playerId === null) {
          void perform([{ type: "CLAIM_NUMBER", payload: { ...position, playerId } }], () =>
            api.purchaseNumber(position, playerId, requestId())
          )
        } else if (entry?.playerId === playerId) {
          void perform([{ type: "RELEASE_NUMBER", payload: position }], () =>
            api.releaseNumber(position, playerId, requestId())
          )
        }
      },
      toggleGift: (ticketId, number) => {
        const position = { ticketId, number }
        const owner = findEntry(stateRef.current, position)?.playerId
        if (owner == null) return
        void perform([{ type: "TOGGLE_GIFT", payload: position }], () =>
          api.toggleGift(position, owner, requestId())
        )
      },
      checkIn: (playerId) => {
        const player = stateRef.current.players.find((p) => p.id === playerId)
        if (!player) return
        const paymentMethod =
          player.negativeBalance > 0 ? (player.paymentMethod ?? "other") : null
        void perform([{ type: "CHECK_IN", payload: { playerId } }], () =>
          api.checkIn(gameSessionId, playerId, paymentMethod, requestId())
        )
      },
      undoCheckIn: (playerId) => {
        void perform([{ type: "UNDO_CHECK_IN", payload: { playerId } }], () =>
          api.undoCheckIn(gameSessionId, playerId, requestId())
        )
      },
      rechargeBalance: (playerId, amount, paymentMethod, note, requestKey) => {
        if (submittedRecharges.current.has(requestKey)) return
        submittedRecharges.current.add(requestKey)
        void perform([{ type: "RECHARGE_BALANCE", payload: { playerId, amount } }], () =>
          api.rechargeBalance(gameSessionId, playerId, amount, paymentMethod, note, requestKey)
        )
      },
      removePlayer: (playerId) => {
        void perform([{ type: "REMOVE_PLAYER", payload: { playerId } }], () =>
          api.removePlayer(gameSessionId, playerId, requestId())
        )
      },
      editPlayerNumbers: (playerId, changes) => {
        if (changes.length === 0) return
        const optimistic: Action[] = changes.flatMap((c): Action[] => {
          const position = { ticketId: c.ticketId, number: c.number }
          const entry = findEntry(stateRef.current, position)
          if (!c.owned) {
            return [{ type: "SET_NUMBER_OWNER", payload: { ...position, playerId: null } }]
          }
          const own: Action[] =
            entry?.playerId === playerId
              ? []
              : [{ type: "SET_NUMBER_OWNER", payload: { ...position, playerId } }]
          const currentGift = entry?.playerId === playerId ? entry.isGift : false
          return c.isGift !== currentGift
            ? [...own, { type: "TOGGLE_GIFT", payload: position }]
            : own
        })
        void perform(optimistic, () =>
          api.editPlayerNumbers(gameSessionId, playerId, changes, requestId())
        )
      },
      awardPrize: (slotIndex, number) => {
        if (roundId === null) return
        void perform([{ type: "AWARD_PRIZE", payload: { slotIndex, number } }], () =>
          api.awardPrize(roundId, slotIndex, number, requestId())
        )
      },
      resolveCarryOver: (playerId, releaseNumbers) => {
        void perform([{ type: "RESOLVE_CARRYOVER", payload: { playerId, releaseNumbers } }], () =>
          api.resolveCarryover(gameSessionId, playerId, releaseNumbers, requestId())
        )
      },
      addTicket: async () =>
        (await perform([], () => api.addTicket(gameSessionId, requestId()), { resync: "await" }))
          .ok,
      startRound: async (roundTemplateId) =>
        (
          await perform([], () => api.startRound(gameSessionId, roundTemplateId, requestId()), {
            resync: "await",
          })
        ).ok,
      closeRound: async (nextRoundTemplateId) => {
        if (roundId === null) return false
        return (
          await perform([], () => api.closeRound(roundId, nextRoundTemplateId, requestId()), {
            resync: "await",
          })
        ).ok
      },
      // No re-sync: the dialog shows the summary, then leaves the page.
      endGameSession: async () => {
        const ended = await perform([], () => api.endGameSession(gameSessionId, requestId()), {
          resync: "none",
        })
        return ended.ok ? api.fetchSummary(gameSessionId) : null
      },
      discardGameSession: async () =>
        (
          await perform([], () => api.discardGameSession(gameSessionId, requestId()), {
            resync: "none",
          })
        ).ok,
    }
  }, [state, roundTemplates, perform, api])

  return <RoundDraftContext.Provider value={value}>{children}</RoundDraftContext.Provider>
}

export function useRoundDraft() {
  const ctx = React.useContext(RoundDraftContext)
  if (!ctx) throw new Error("useRoundDraft must be used within a RoundDraftProvider")
  return ctx
}
