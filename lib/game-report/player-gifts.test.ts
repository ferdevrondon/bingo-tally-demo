import { describe, expect, it } from "vitest"

import {
  assembleGiftHistory,
  groupGiftHistory,
  summarizeGifts,
  type GiftHistoryRound,
  type GiftHistoryRow,
} from "./player-gifts"

const row = (
  roundId: number,
  type: string,
  number: number,
  playerId = 1,
  ticketId = 11,
  amount = 0
): GiftHistoryRow => ({ round_id: roundId, type, player_id: playerId, ticket_id: ticketId, number, amount })

const round = (
  id: number,
  partial: Partial<GiftHistoryRound> = {}
): GiftHistoryRound => ({
  id,
  seq: id,
  name: "Regular",
  status: "closed",
  linePrice: 10,
  winningNumbers: [5],
  gameSessionId: 1,
  gameNumber: 1,
  startedAt: "2026-11-01T20:00:00Z",
  ...partial,
})

const tickets = new Map([
  [11, 1],
  [12, 2],
])

describe("assembleGiftHistory", () => {
  it("keeps effective gifts and marks the one that won", () => {
    const entries = assembleGiftHistory(
      [row(1, "number_gifted", 5), row(1, "number_gifted", 7)],
      [round(1)],
      [{ roundId: 1, playerId: 1, ticketId: 11, number: 5, slot: 0, prize: 40 }],
      tickets
    )
    expect(entries.map((e) => [e.number, e.won, e.paid])).toEqual([
      [5, true, 40],
      [7, false, null],
    ])
  })

  it("drops a gift taken back, released or handed over", () => {
    const entries = assembleGiftHistory(
      [
        row(1, "number_gifted", 3),
        row(1, "number_ungifted", 3),
        row(1, "number_gifted", 4),
        row(1, "number_released", 4),
        row(1, "number_gifted", 6),
      ],
      [round(1)],
      [],
      tickets
    )
    expect(entries.map((e) => e.number)).toEqual([6])
  })

  it("leaves out a round closed with no winning numbers, keeps the open one", () => {
    const entries = assembleGiftHistory(
      [row(1, "number_gifted", 3), row(2, "number_gifted", 8)],
      [round(1, { winningNumbers: [null] }), round(2, { status: "open", winningNumbers: [] })],
      [],
      tickets
    )
    expect(entries.map((e) => [e.roundId, e.open])).toEqual([[2, true]])
  })

  it("lists the newest game session first and groups by round", () => {
    const entries = assembleGiftHistory(
      [row(1, "number_gifted", 3), row(2, "number_gifted", 9), row(3, "number_gifted", 2)],
      [
        round(1),
        round(2, { gameSessionId: 2, gameNumber: 2, startedAt: "2026-11-05T20:00:00Z", seq: 1 }),
        round(3, { gameSessionId: 2, gameNumber: 2, startedAt: "2026-11-05T20:00:00Z", seq: 2 }),
      ],
      [],
      tickets
    )
    const groups = groupGiftHistory(entries)
    expect(groups.map((g) => [g.gameNumber, g.rounds.map((r) => r.roundSeq)])).toEqual([
      [2, [2, 1]],
      [1, [1]],
    ])
  })
})

describe("summarizeGifts", () => {
  it("counts the gifts, their value and what the winning ones were paid", () => {
    const entries = assembleGiftHistory(
      [row(1, "number_gifted", 5), row(1, "number_gifted", 7, 1, 12)],
      [round(1)],
      [{ roundId: 1, playerId: 1, ticketId: 11, number: 5, slot: 0, prize: 40 }],
      tickets
    )
    expect(summarizeGifts(entries)).toEqual({ count: 2, value: 20, wins: 1, paid: 40 })
  })
})
