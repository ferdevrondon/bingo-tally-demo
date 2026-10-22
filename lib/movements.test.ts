import { describe, expect, it } from "vitest"

import {
  correctionDelta,
  isLargeAmount,
  toCashMoves,
  type CashMoveContext,
  type LedgerCashRow,
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
