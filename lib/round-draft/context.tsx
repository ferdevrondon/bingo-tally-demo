"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { useHouse } from "@/components/house-provider"
import { useActivityFeed } from "@/hooks/use-activity-feed"
import {
  GAME_ACTION_ERROR_MESSAGES,
  type GameActionResult,
} from "@/lib/data/game-action-result"
import type { Bank } from "@/lib/banks"
import type { PaymentMethod } from "@/lib/payment-methods"
import type { Round } from "@/lib/rounds"
import { createClient } from "@/lib/supabase/client"

import { assignTicket, claimFirstFree, compactLine, movedPlays } from "./assign-ticket"
import { fetchGameSessionState } from "./fetch-state"
import {
  createGameApi,
  type ClosedRoundSummary,
  type GameSessionSummary,
  type NumberEdit,
} from "./game-api"
import { ticketPrize } from "./prize-rules"
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
// Every viewer (observers, and the admin's other tabs) also re-reads when a
// new activity row of the house arrives through Realtime (Phase 5).

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
  // Rule 2: after plays were freed, the rows of these numbers move up.
  | { type: "COMPACT_LINES"; payload: { numbers: number[] } }

function updatePlayer(
  players: DraftPlayer[],
  playerId: number,
  update: (player: DraftPlayer) => DraftPlayer
): DraftPlayer[] {
  return players.map((p) => (p.id === playerId ? update(p) : p))
}

// Money moves like the SQL helpers of the game rules v2 migration: one signed
// balance per player (rule B). A sale moves game money from the player to the
// house result, a refund or prize the other way; recharges are cash and only
// move the player's balance.

/** A sale: the player pays `amount`. The player joins the game session if needed. */
function chargePlayer(state: RoundDraftState, playerId: number, amount: number): RoundDraftState {
  return {
    ...state,
    houseBalance: state.houseBalance + amount,
    players: updatePlayer(state.players, playerId, (p) => ({
      ...p,
      balance: p.balance - amount,
      inSession: true,
      removed: false,
    })),
  }
}

/** A refund or a prize: the house pays `amount` to the player. */
function creditPlayer(state: RoundDraftState, playerId: number, amount: number): RoundDraftState {
  return {
    ...state,
    houseBalance: state.houseBalance - amount,
    players: updatePlayer(state.players, playerId, (p) => ({ ...p, balance: p.balance + amount })),
  }
}

/** The player still has to keep or release their numbers: their play is locked
 *  (same rule as private.assert_no_pending_carryover). */
function isPendingDecision(state: RoundDraftState, playerId: number): boolean {
  return state.players.find((p) => p.id === playerId)?.pendingCarryOverDecision ?? false
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
      return chargePlayer(next, action.payload.playerId, price)
    }
    case "RELEASE_NUMBER": {
      const entry = findEntry(state, action.payload)
      if (!entry || entry.playerId === null) return state
      const next = setEntry(state, action.payload, { playerId: null, isGift: false })
      // A gifted number was never paid for: nothing to refund.
      return entry.isGift ? next : creditPlayer(next, entry.playerId, price)
    }
    case "SET_NUMBER_OWNER": {
      const entry = findEntry(state, action.payload)
      if (!entry || entry.playerId === action.payload.playerId) return state
      const next = setEntry(state, action.payload, {
        playerId: action.payload.playerId,
        isGift: false,
      })
      let result = next
      if (entry.playerId !== null && !entry.isGift) {
        result = creditPlayer(result, entry.playerId, price)
      }
      if (action.payload.playerId !== null) {
        result = chargePlayer(result, action.payload.playerId, price)
      }
      return result
    }
    case "TOGGLE_GIFT": {
      const entry = findEntry(state, action.payload)
      if (!entry || entry.playerId === null) return state
      const next = setEntry(state, action.payload, {
        playerId: entry.playerId,
        isGift: !entry.isGift,
      })
      // A gifted number costs the player nothing; un-gifting charges it again.
      return entry.isGift
        ? chargePlayer(next, entry.playerId, price)
        : creditPlayer(next, entry.playerId, price)
    }
    // Check-in (rule A): "in this round"; no money.
    case "CHECK_IN":
      return {
        ...state,
        players: updatePlayer(state.players, action.payload.playerId, (p) => ({
          ...p,
          checkedIn: true,
        })),
      }
    case "UNDO_CHECK_IN":
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
      // Cash: the player's balance only, not the house result.
      return {
        ...state,
        players: updatePlayer(state.players, playerId, (p) => ({
          ...p,
          balance: p.balance + amount,
          inSession: true,
          removed: false,
        })),
      }
    }
    case "REMOVE_PLAYER": {
      // Numbers are freed without refund; the balance stays for the settlement.
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
      const slotPrize = state.round.prizes[slotIndex] ?? 0
      let next: RoundDraftState = {
        ...state,
        winningNumbers: state.winningNumbers.map((n, i) => (i === slotIndex ? number : n)),
      }
      // One prize per ticket: the slot's prize, or prize - P for a gifted one.
      for (const winner of getWinnersForNumber(state, number)) {
        for (const entry of winner.entries) {
          next = creditPlayer(next, winner.playerId, ticketPrize(slotPrize, entry.isGift, price))
        }
      }
      return next
    }
    case "RESOLVE_CARRYOVER": {
      const { playerId, releaseNumbers } = action.payload
      const released = new Set(releaseNumbers.map((r) => `${r.ticketId}:${r.number}`))
      // Released numbers are freed; kept gifts become normal numbers (rule C).
      const tickets = state.tickets.map((ticket) => ({
        ...ticket,
        numbers: ticket.numbers.map((entry) =>
          entry.playerId !== playerId
            ? entry
            : released.has(`${ticket.id}:${entry.number}`)
              ? { ...entry, playerId: null, isGift: false }
              : { ...entry, isGift: false }
        ),
      }))
      // Every kept number is charged for the new round.
      const kept = tickets.flatMap((t) => t.numbers).filter((n) => n.playerId === playerId).length
      return chargePlayer(
        {
          ...state,
          tickets,
          players: updatePlayer(state.players, playerId, (p) => ({
            ...p,
            pendingCarryOverDecision: false,
            // Keeping (all or part) is the check-in; releasing everything isn't.
            checkedIn: kept > 0 ? true : p.checkedIn,
          })),
        },
        playerId,
        kept * price
      )
    }
    case "COMPACT_LINES": {
      // Nothing moves once a winning number was entered in the open round
      // (same rule as private.compact_line).
      if (!state.round || state.winningNumbers.some((n) => n !== null)) return state
      const tickets = [...new Set(action.payload.numbers)].reduce(
        (all, number) => compactLine(number, all, false),
        state.tickets
      )
      return { ...state, tickets }
    }
    default:
      return state
  }
}

export type { NumberEdit }

interface RoundDraftContextValue {
  state: RoundDraftState
  /** An observer: every action is a no-op and the controls are hidden. */
  readOnly: boolean
  /** Active round templates of the house (/rounds), loaded by app/(app)/(game)/layout.tsx. */
  roundTemplates: Round[]
  setActivePlayer: (playerId: number | null) => void
  /** Buys a free number for the active player (the ticket is chosen by the
   *  database: lowest index with the number free; `ticketId` is ignored for a
   *  free number), or releases their own number on that ticket. */
  assignNumber: (ticketId: number, number: number) => void
  toggleGift: (ticketId: number, number: number) => void
  /** Check-in (rule A): the player confirms they are in this round. No money. */
  checkIn: (playerId: number) => void
  undoCheckIn: (playerId: number) => void
  /** `requestKey` identifies the user's recharge (one per dialog opening), so
   *  a double click records it once. */
  rechargeBalance: (
    playerId: number,
    amount: number,
    paymentMethod: PaymentMethod,
    bank: Bank | null,
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
  /** Resolves `ok` once the round is closed, with its summary (rule F) when
   *  it could be read. */
  closeRound: (
    nextRoundTemplateId: number
  ) => Promise<{ ok: boolean; summary: ClosedRoundSummary | null }>
  endGameSession: () => Promise<GameSessionSummary | null>
  discardGameSession: () => Promise<boolean>
}

const RoundDraftContext = React.createContext<RoundDraftContextValue | null>(null)

function requestId() {
  return crypto.randomUUID()
}

const RESYNC_DELAY_MS = 100

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
  const readOnly = house?.role !== "admin"
  const api = React.useMemo(() => createGameApi(!readOnly), [readOnly])

  const [state, dispatch] = React.useReducer(reducer, initialState)
  const stateRef = React.useRef(state)
  const queue = React.useRef<Promise<unknown>>(Promise.resolve())
  const inFlight = React.useRef(0)
  // Bumped when an action starts: a re-sync read before it is stale.
  const version = React.useRef(0)
  const resyncTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const submittedRecharges = React.useRef(new Set<string>())
  // This tab is ending or discarding the game session: live changes (its
  // own echo included) must not re-read it, or the end-of-game summary would
  // be replaced by "No hay una jornada activa" before the admin reads it.
  const leaving = React.useRef(false)

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
      if (houseId === null || leaving.current) return
      const startVersion = version.current
      try {
        const saved = await fetchGameSessionState(
          createClient(),
          houseId,
          stateRef.current.gameSessionId
        )
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

  // Anything new in the house (this game session, or an account move shown
  // for a player who hasn't joined yet), or a reconnect: read again. The
  // re-sync already yields to this tab's own actions in flight.
  const onActivity = React.useCallback(() => {
    if (!leaving.current) scheduleResync()
  }, [scheduleResync])
  useActivityFeed(onActivity)

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
      // The UI hides the controls; the database would refuse anyway.
      if (readOnly) return { ok: false, error: "read_only" }
      version.current += 1
      inFlight.current += 1
      if (resyncMode === "none") leaving.current = true
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
      if (!result.ok && resyncMode === "none") leaving.current = false
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
    [readOnly, resync, scheduleResync]
  )

  const value = React.useMemo<RoundDraftContextValue>(() => {
    const gameSessionId = state.gameSessionId
    const roundId = state.round?.roundId ?? null

    // An action that frees plays (rule 2): same as perform, and when the
    // freed rows reshuffle other plays, tell the host once it was saved.
    function performFreeing(
      optimistic: Action[],
      call: () => Promise<GameActionResult<undefined>>
    ) {
      const numbers = optimistic.flatMap((a) => (a.type === "COMPACT_LINES" ? a.payload.numbers : []))
      const without = optimistic.filter((a) => a.type !== "COMPACT_LINES")
      const freed = without.reduce(reducer, stateRef.current)
      const hasAwards = !freed.round || freed.winningNumbers.some((n) => n !== null)
      const lines = [...new Set(numbers)]
        .filter((n) => movedPlays(n, freed.tickets, hasAwards) > 0)
        .sort((a, b) => a - b)
      void perform(optimistic, call).then((result) => {
        if (!result.ok || lines.length === 0) return
        toast.info(
          lines.length === 1
            ? `Se reacomodó la línea ${lines[0]}`
            : `Se reacomodaron las líneas ${lines.join(", ")}`,
          { id: "reshuffle" }
        )
      })
    }

    return {
      state,
      readOnly,
      roundTemplates,
      setActivePlayer: (playerId) => {
        if (playerId !== null && isPendingDecision(stateRef.current, playerId)) {
          toast.error(GAME_ACTION_ERROR_MESSAGES.pending_carryover)
          return
        }
        dispatch({ type: "SET_ACTIVE_PLAYER", payload: playerId })
      },
      assignNumber: (ticketId, number) => {
        const current = stateRef.current
        const playerId = current.activePlayerId
        if (playerId === null || readOnly) return
        if (isPendingDecision(current, playerId)) {
          toast.error(GAME_ACTION_ERROR_MESSAGES.pending_carryover)
          return
        }
        const tapped = findEntry(current, { ticketId, number })
        if (tapped?.playerId === playerId) {
          // Releasing is positional: it frees the player's own number there.
          const position = { ticketId, number }
          performFreeing(
            [
              { type: "RELEASE_NUMBER", payload: position },
              { type: "COMPACT_LINES", payload: { numbers: [number] } },
            ],
            () => api.releaseNumber(position, playerId, requestId())
          )
          return
        }
        if (tapped?.playerId !== null) return
        // A purchase only triggers the action: the ticket is the lowest-index
        // one with this number free (decided by record_purchase; this just
        // predicts it). The tapped ticket is ignored.
        const assignedTicketId = assignTicket(number, current.tickets)
        if (assignedTicketId === null) {
          toast.error(GAME_ACTION_ERROR_MESSAGES.no_free_ticket)
          return
        }
        const position = { ticketId: assignedTicketId, number }
        void perform([{ type: "CLAIM_NUMBER", payload: { ...position, playerId } }], () =>
          api.purchaseNumber(gameSessionId, number, playerId, requestId())
        ).then((result) => {
          if (!result.ok) return
          const index = stateRef.current.tickets.find((t) => t.id === result.data)?.index
          toast.success(
            index === undefined ? "Jugada asignada" : `Asignado al cartón ${index}`,
            // One at a time: a new purchase replaces the previous notice.
            { id: "assigned" }
          )
        })
      },
      toggleGift: (ticketId, number) => {
        const position = { ticketId, number }
        const owner = findEntry(stateRef.current, position)?.playerId
        if (owner == null) return
        if (isPendingDecision(stateRef.current, owner)) {
          toast.error(GAME_ACTION_ERROR_MESSAGES.pending_carryover)
          return
        }
        void perform([{ type: "TOGGLE_GIFT", payload: position }], () =>
          api.toggleGift(position, owner, requestId())
        )
      },
      checkIn: (playerId) => {
        void perform([{ type: "CHECK_IN", payload: { playerId } }], () =>
          api.checkIn(gameSessionId, playerId, requestId())
        )
      },
      undoCheckIn: (playerId) => {
        void perform([{ type: "UNDO_CHECK_IN", payload: { playerId } }], () =>
          api.undoCheckIn(gameSessionId, playerId, requestId())
        )
      },
      rechargeBalance: (playerId, amount, paymentMethod, bank, note, requestKey) => {
        if (submittedRecharges.current.has(requestKey)) return
        submittedRecharges.current.add(requestKey)
        void perform([{ type: "RECHARGE_BALANCE", payload: { playerId, amount } }], () =>
          api.rechargeBalance(gameSessionId, playerId, amount, paymentMethod, bank, note, requestKey)
        )
      },
      removePlayer: (playerId) => {
        const owned = stateRef.current.tickets
          .flatMap((t) => t.numbers)
          .filter((n) => n.playerId === playerId)
          .map((n) => n.number)
        performFreeing(
          [
            { type: "REMOVE_PLAYER", payload: { playerId } },
            { type: "COMPACT_LINES", payload: { numbers: owned } },
          ],
          () => api.removePlayer(gameSessionId, playerId, requestId())
        )
      },
      editPlayerNumbers: (playerId, changes) => {
        if (changes.length === 0) return
        // The player, or the owner a number is taken from, still has to decide.
        const touchesPending =
          isPendingDecision(stateRef.current, playerId) ||
          changes.some((c) => {
            const owner = findEntry(stateRef.current, { ticketId: c.ticketId, number: c.number })
              ?.playerId
            return owner != null && owner !== playerId && isPendingDecision(stateRef.current, owner)
          })
        if (touchesPending) {
          toast.error(GAME_ACTION_ERROR_MESSAGES.pending_carryover)
          return
        }
        // Changes apply in order, as edit_player_numbers does: a purchase of a
        // free number lands on the lowest ticket where it is still free at that
        // point (the database ignores the ticket sent), the rest by position.
        let working = stateRef.current.tickets
        const optimistic: Action[] = changes.flatMap((c): Action[] => {
          const sent = { ticketId: c.ticketId, number: c.number }
          const sentEntry = findEntry({ ...stateRef.current, tickets: working }, sent)
          const claimed =
            c.owned && sentEntry?.playerId === null
              ? claimFirstFree(working, c.number, playerId, false)
              : null
          const position = claimed ? { ticketId: claimed.ticketId, number: c.number } : sent
          const entry = claimed ? sentEntry : findEntry(stateRef.current, position)
          if (claimed) working = claimed.tickets
          if (!c.owned) {
            working = working.map((t) =>
              t.id !== position.ticketId
                ? t
                : {
                    ...t,
                    numbers: t.numbers.map((n) =>
                      n.number === c.number ? { ...n, playerId: null, isGift: false } : n
                    ),
                  }
            )
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
        // The numbers freed by the edit are compacted once, after all changes.
        const freed = changes.filter((c) => !c.owned).map((c) => c.number)
        if (freed.length > 0) optimistic.push({ type: "COMPACT_LINES", payload: { numbers: freed } })
        performFreeing(optimistic, () =>
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
        performFreeing(
          [
            { type: "RESOLVE_CARRYOVER", payload: { playerId, releaseNumbers } },
            { type: "COMPACT_LINES", payload: { numbers: releaseNumbers.map((r) => r.number) } },
          ],
          () => api.resolveCarryover(gameSessionId, playerId, releaseNumbers, requestId())
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
        if (roundId === null) return { ok: false, summary: null }
        const closed = await perform(
          [],
          () => api.closeRound(roundId, nextRoundTemplateId, requestId()),
          { resync: "await" }
        )
        if (!closed.ok) return { ok: false, summary: null }
        return { ok: true, summary: await api.fetchRoundSummary(roundId) }
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
  }, [state, readOnly, roundTemplates, perform, api])

  return <RoundDraftContext.Provider value={value}>{children}</RoundDraftContext.Provider>
}

export function useRoundDraft() {
  const ctx = React.useContext(RoundDraftContext)
  if (!ctx) throw new Error("useRoundDraft must be used within a RoundDraftProvider")
  return ctx
}
