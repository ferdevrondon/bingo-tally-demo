import { describe, expect, it } from "vitest"

import { buildRoundGifts, type GiftLedgerRow } from "./gifts"
import type { RoundWinnerReport } from "./types"

const names = new Map([
  [1, "Ana"],
  [2, "Beto"],
])
const tickets = new Map([
  [10, 1],
  [11, 2],
])
const gift = (player: number, number: number, ticket = 10): GiftLedgerRow => ({
  type: "number_gifted",
  player_id: player,
  ticket_id: ticket,
  number,
  amount: -10,
})
const win = (playerId: number, number: number, prize: number, ticketIndex = 1): RoundWinnerReport => ({
  playerId,
  playerName: names.get(playerId) ?? "",
  ticketIndex,
  number,
  slot: 0,
  prize,
})
const round = { linePrice: 10 }

describe("buildRoundGifts", () => {
  it("costs the line price when a gift didn't win and what it was paid when it did", () => {
    const gifts = buildRoundGifts([gift(1, 4), gift(2, 7)], round, [win(2, 7, 90)], names, tickets)
    expect(gifts).toEqual([
      { playerId: 1, playerName: "Ana", ticketIndex: 1, number: 4, won: false, cost: 10 },
      { playerId: 2, playerName: "Beto", ticketIndex: 1, number: 7, won: true, cost: 90 },
    ])
  })

  it("drops gifts that were un-gifted, released or handed over", () => {
    const rows: GiftLedgerRow[] = [
      gift(1, 1),
      { type: "number_ungifted", player_id: 1, ticket_id: 10, number: 1, amount: 10 },
      gift(1, 2),
      { type: "number_released", player_id: 1, ticket_id: 10, number: 2, amount: 0 },
      gift(1, 3),
      { type: "number_reassigned", player_id: 1, ticket_id: 10, number: 3, amount: 0 },
      gift(1, 5),
    ]
    expect(buildRoundGifts(rows, round, [], names, tickets).map((g) => g.number)).toEqual([5])
  })

  it("keeps one entry per play when a player gifts the same number on two tickets", () => {
    const gifts = buildRoundGifts([gift(1, 4, 10), gift(1, 4, 11)], round, [win(1, 4, 90, 2)], names, tickets)
    expect(gifts.map((g) => [g.ticketIndex, g.won])).toEqual([
      [1, false],
      [2, true],
    ])
  })
})
