import { describe, expect, it } from "vitest"

import {
  getOpenStats,
  getPlayerNumberSummary,
  getRoundGifts,
  orderTicketsByFreeNumbers,
} from "./selectors"
import type { RoundDraftState, Ticket } from "./types"

// plays: ticket index -> [number, playerId, isGift][]
function makeState(
  plays: Record<number, [number, number, boolean][]>
): RoundDraftState {
  const tickets: Ticket[] = Object.keys(plays).map((key) => {
    const index = Number(key)
    return {
      id: 100 + index,
      index,
      numbers: Array.from({ length: 15 }, (_, j) => {
        const play = plays[index].find(([n]) => n === j + 1)
        return {
          number: j + 1,
          playerId: play?.[1] ?? null,
          isGift: play?.[2] ?? false,
        }
      }),
    }
  })
  return { tickets } as RoundDraftState
}

describe("getPlayerNumberSummary", () => {
  it("counts each number once with its plays and gifts, by number", () => {
    const state = makeState({
      1: [
        [7, 1, false],
        [4, 1, false],
        [9, 2, false],
      ],
      2: [
        [4, 1, true],
        [7, 2, false],
      ],
      3: [[4, 1, false]],
    })
    expect(getPlayerNumberSummary(state, 1)).toEqual([
      { number: 4, count: 3, gifts: 1 },
      { number: 7, count: 1, gifts: 0 },
    ])
  })

  it("is empty for a player with no plays", () => {
    const state = makeState({ 1: [[3, 2, false]] })
    expect(getPlayerNumberSummary(state, 1)).toEqual([])
  })
})

describe("getOpenStats and getRoundGifts", () => {
  it("counts open tickets, free numbers and the loss from unwon gifts", () => {
    const state = {
      ...makeState({
        1: [
          [3, 1, true],
          [4, 1, false],
        ],
        2: [[3, 2, true]],
      }),
      round: { linePrice: 10 },
      players: [
        { id: 1, name: "JUANA" },
        { id: 2, name: "MARÍA" },
      ],
      winningNumbers: [3, null],
    } as unknown as RoundDraftState

    expect(getOpenStats(state)).toMatchObject({
      openTickets: 2,
      totalTickets: 2,
      freeLines: 27,
      freeAmount: 270,
    })
    const gifts = getRoundGifts(state)
    expect(gifts.giftCount).toBe(2)
    expect(gifts.pendingCount).toBe(0)
    expect(gifts.giftLoss).toBe(0)
    expect(gifts.players.map((p) => p.playerName)).toEqual(["JUANA", "MARÍA"])

    const open = { ...state, winningNumbers: [null] } as RoundDraftState
    expect(getRoundGifts(open).giftLoss).toBe(20)
  })
})

describe("orderTicketsByFreeNumbers", () => {
  it("puts the emptiest tickets first and complete ones last", () => {
    const full: [number, number, boolean][] = Array.from({ length: 15 }, (_, i) => [i + 1, 1, false])
    const state = makeState({
      1: full,
      2: [[1, 1, false]],
      3: [],
      4: [[1, 1, false]],
    })
    expect(orderTicketsByFreeNumbers(state.tickets).map((t) => t.index)).toEqual([3, 2, 4, 1])
  })
})
