import { describe, expect, it } from "vitest"

import {
  correctionDelta,
  groupMovesBySession,
  isLargeAmount,
  toCashMoves,
  toTransferMoves,
  type CashMoveContext,
  type LedgerCashRow,
  type LedgerTransferRow,
} from "./movements"

function row(partial: Partial<LedgerCashRow>): LedgerCashRow {
  return {
    id: 1,
    created_at: "2026-10-20T15:00:00Z",
    type: "recharge",
    amount: 100,
    payment_method: "cash",
    bank: null,
    note: null,
    game_session_id: null,
    settlement_id: null,
    corrects_id: null,
    ...partial,
  }
}

const noGames: CashMoveContext = { latestGameSession: null, openSettlements: new Set(), inGame: false }

describe("toCashMoves", () => {
  it("pairs a move with its correction and lists newest first", () => {
    const moves = toCashMoves(
      [
        row({ id: 1, amount: 1000 }),
        row({ id: 2, type: "payout", amount: -50 }),
        row({ id: 3, amount: -900, corrects_id: 1, note: "error de dedo" }),
      ],
      noGames
    )
    expect(moves.map((m) => m.id)).toEqual([2, 1])
    expect(moves[1]).toMatchObject({
      amount: 1000,
      correction: { amount: 100, reason: "error de dedo" },
      closed: false,
    })
    expect(moves[0]).toMatchObject({ type: "payout", amount: 50, correction: null })
  })

  it("closes an account move once a game session started after it", () => {
    const context: CashMoveContext = {
      ...noGames,
      latestGameSession: { id: 7, status: "ended", startedAt: "2026-10-20T18:00:00Z" },
    }
    const [move] = toCashMoves([row({})], context)
    expect(move.closed).toBe(true)
  })

  it("closes an account move while the player plays the active game session", () => {
    const [move] = toCashMoves([row({})], { ...noGames, inGame: true })
    expect(move.closed).toBe(true)
  })

  it("keeps a move of the active game session open, and closes an ended one", () => {
    const context: CashMoveContext = {
      ...noGames,
      latestGameSession: { id: 7, status: "active", startedAt: "2026-10-20T14:00:00Z" },
    }
    const moves = toCashMoves(
      [row({ id: 1, game_session_id: 7 }), row({ id: 2, game_session_id: 6 })],
      context
    )
    expect(moves.map((m) => m.closed)).toEqual([true, false])
  })

  it("closes a settlement move when its settlement is closed", () => {
    const moves = toCashMoves(
      [row({ id: 1, settlement_id: 5 }), row({ id: 2, settlement_id: 6 })],
      { ...noGames, openSettlements: new Set([6]) }
    )
    expect(moves.map((m) => m.closed)).toEqual([false, true])
  })
})

describe("correctionDelta", () => {
  it("is what the correction adds to the balance", () => {
    expect(correctionDelta({ type: "recharge", amount: 1000 }, 100)).toBe(-900)
    expect(correctionDelta({ type: "payout", amount: 30 }, 80)).toBe(-50)
    expect(correctionDelta({ type: "payout", amount: 50 }, 0)).toBe(50)
  })
})

describe("isLargeAmount", () => {
  it("flags amounts from 500 up or five times the usual one", () => {
    expect(isLargeAmount(499)).toBe(false)
    expect(isLargeAmount(500)).toBe(true)
    expect(isLargeAmount(250, 50)).toBe(true)
    expect(isLargeAmount(200, 50)).toBe(false)
  })
})

function transferRow(partial: Partial<LedgerTransferRow>): LedgerTransferRow {
  return {
    ...row({ type: "balance_transfer", payment_method: null, amount: -40 }),
    transfer_id: "t-1",
    counterparty_player_id: 9,
    ...partial,
  }
}

describe("toTransferMoves", () => {
  it("lists the player's transfers newest first, with their direction", () => {
    const moves = toTransferMoves(
      [
        transferRow({ id: 1, transfer_id: "t-1", amount: -40, counterparty_player_id: 9 }),
        transferRow({ id: 2, transfer_id: "t-2", amount: 15, counterparty_player_id: 8 }),
        row({ id: 3, type: "recharge" }),
      ] as LedgerTransferRow[],
      noGames
    )
    expect(moves.map((m) => [m.transferId, m.direction, m.amount, m.counterpartyId])).toEqual([
      ["t-2", "in", 15, 8],
      ["t-1", "out", 40, 9],
    ])
  })

  it("marks a transfer as voided with its reason and leaves the voiding out", () => {
    const moves = toTransferMoves(
      [
        transferRow({ id: 1 }),
        transferRow({ id: 5, amount: 40, corrects_id: 1, note: "se equivocó de jugador" }),
      ],
      noGames
    )
    expect(moves).toHaveLength(1)
    expect(moves[0].voided).toEqual({ reason: "se equivocó de jugador" })
  })

  it("closes a transfer on the account once a game session started after it", () => {
    const [move] = toTransferMoves([transferRow({})], {
      ...noGames,
      latestGameSession: { id: 7, status: "ended", startedAt: "2026-10-20T18:00:00Z" },
    })
    expect(move.closed).toBe(true)
  })

  it("keeps a transfer of the active game session open", () => {
    const [move] = toTransferMoves([transferRow({ game_session_id: 7 })], {
      ...noGames,
      latestGameSession: { id: 7, status: "active", startedAt: "2026-10-20T14:00:00Z" },
      inGame: true,
    })
    expect(move.closed).toBe(false)
  })
})

describe("groupMovesBySession", () => {
  const sessions = new Map([
    [7, { id: 7, number: 7, startedAt: "2026-11-01T20:00:00Z", active: false }],
    [8, { id: 8, number: 8, startedAt: "2026-11-08T20:00:00Z", active: true }],
  ])
  const item = (id: number, sessionId: number | null) => ({ move: { id, sessionId } })

  it("splits by game session, newest first, with account moves apart", () => {
    const sections = groupMovesBySession(
      [item(1, 7), item(2, 7), item(3, null), item(4, null), item(5, 8), item(6, 8)],
      sessions
    )
    expect(sections.map((s) => [s.kind, s.items.map((i) => i.move.id)])).toEqual([
      ["session", [6, 5]],
      ["outside", [4, 3]],
      ["session", [2, 1]],
    ])
  })

  it("keeps a settlement paid later with its game session", () => {
    // 10: the settlement of game session 7, after an account move (9).
    const sections = groupMovesBySession([item(1, 7), item(9, null), item(10, 7)], sessions)
    expect(sections.map((s) => [s.key, s.items.map((i) => i.move.id)])).toEqual([
      ["s-7", [10, 1]],
      ["o-9", [9]],
    ])
  })

  it("puts a move of an unknown game session outside", () => {
    expect(groupMovesBySession([item(1, 99)], sessions).map((s) => s.kind)).toEqual(["outside"])
  })
})

describe("round of a move", () => {
  it("carries the round it was made in, null outside a game session", () => {
    const context: CashMoveContext = { latestGameSession: null, openSettlements: new Set(), inGame: false }
    const base = {
      created_at: "2026-11-08T20:00:00Z",
      payment_method: "cash",
      bank: null,
      note: null,
      settlement_id: null,
      corrects_id: null,
    }
    const moves = toCashMoves(
      [
        { ...base, id: 1, type: "recharge", amount: 20, game_session_id: 8, round_id: 31 },
        { ...base, id: 2, type: "payout", amount: -5, game_session_id: null, round_id: null },
      ],
      context
    )
    expect(moves.map((m) => [m.id, m.roundId])).toEqual([
      [2, null],
      [1, 31],
    ])
  })
})
