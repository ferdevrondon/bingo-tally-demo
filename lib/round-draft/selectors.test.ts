import { describe, expect, it } from "vitest"

import {
  canChangeRound,
  canRemoveTicket,
  getHouseWin,
  getActivePlayers,
  getOpenStats,
  getPlayerNumberSummary,
  getRoundGifts,
  getSlotWinners,
  sortPlayersByName,
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
    expect(gifts.players.map((p) => p.playerName)).toEqual(["JUANA", "MARÍA"])
    expect(gifts.players[0].numbers).toEqual([{ number: 3, tickets: 1 }])
  })
})

describe("getSlotWinners", () => {
  const prize = (
    playerId: number | null,
    number: number,
    amount: number,
    roundId = 7
  ) => ({
    type: "prize_won",
    playerId,
    number,
    amount,
    roundId,
  })

  it("groups the prizes of each winning number by player", () => {
    const state = {
      round: { roundId: 7 },
      winningNumbers: [4, 9, null],
      players: [
        { id: 1, name: "Ana" },
        { id: 2, name: "Beto" },
      ],
      activity: [
        prize(1, 4, 100),
        prize(1, 4, 90),
        prize(2, 4, 100),
        prize(null, 9, 0),
        prize(1, 4, 500, 6),
      ],
    } as unknown as RoundDraftState

    expect(getSlotWinners(state)).toEqual([
      [
        { playerId: 1, name: "Ana", amount: 190 },
        { playerId: 2, name: "Beto", amount: 100 },
      ],
      [],
      null,
    ])
  })

  it("is null when the prize rows are not in the recent activity", () => {
    const state = {
      round: { roundId: 7 },
      winningNumbers: [4],
      players: [],
      activity: [],
    } as unknown as RoundDraftState
    expect(getSlotWinners(state)).toEqual([null])
  })
})

describe("getHouseWin", () => {
  it("counts the tickets where the number is free, without any extra income", () => {
    const state = {
      ...makeState({ 1: [[7, 1, false]], 2: [], 3: [[7, 2, true]], 4: [] }),
      round: { linePrice: 10 },
    } as RoundDraftState
    expect(getHouseWin(state, 7)).toEqual({ tickets: 2 })
    expect(getHouseWin(state, 3)).toEqual({ tickets: 4 })
  })

  it("wins nothing when every ticket had the number sold", () => {
    const state = {
      ...makeState({ 1: [[5, 1, false]] }),
      round: { linePrice: 10 },
    } as RoundDraftState
    expect(getHouseWin(state, 5)).toEqual({ tickets: 0 })
  })
})

describe("canChangeRound", () => {
  const base = {
    round: { roundId: 7 },
    winningNumbers: [null],
    activity: [],
  }
  const row = (type: string, roundId: number | null = 7) => ({ type, roundId })

  it("is open while the round has only starts and check-ins", () => {
    const state = {
      ...base,
      activity: [
        row("round_started"),
        row("check_in"),
        row("number_purchased", 6),
      ],
    } as unknown as RoundDraftState
    expect(canChangeRound(state)).toBe(true)
  })

  it("is closed after a purchase, a kept play or a drawn number", () => {
    const bought = {
      ...base,
      activity: [row("number_purchased")],
    } as unknown as RoundDraftState
    const kept = {
      ...base,
      activity: [row("carryover_kept")],
    } as unknown as RoundDraftState
    const drawn = {
      ...base,
      winningNumbers: [4],
    } as unknown as RoundDraftState
    expect(canChangeRound(bought)).toBe(false)
    expect(canChangeRound(kept)).toBe(false)
    expect(canChangeRound(drawn)).toBe(false)
  })

  it("is false without an open round", () => {
    expect(
      canChangeRound({ ...base, round: null } as unknown as RoundDraftState)
    ).toBe(false)
  })
})

describe("getActivePlayers", () => {
  it("sorts the players with plays alphabetically, not by arrival", () => {
    const state = {
      ...makeState({
        1: [
          [1, 1, false],
          [2, 2, false],
          [3, 3, false],
          [4, 4, false],
        ],
      }),
      players: [
        { id: 1, name: "MARTHA" },
        { id: 2, name: "ÁNGEL" },
        { id: 3, name: "BOLIVAR" },
        { id: 4, name: "ADRI" },
        { id: 5, name: "ZAVALA" },
      ],
    } as unknown as RoundDraftState
    expect(getActivePlayers(state).map((p) => p.name)).toEqual([
      "ADRI",
      "ÁNGEL",
      "BOLIVAR",
      "MARTHA",
    ])
  })
})

describe("sortPlayersByName", () => {
  it("sorts alphabetically as in Spanish, ignoring accents and case", () => {
    const players = [
      { name: "ÑAÑO" },
      { name: "nora" },
      { name: "ÁLVARO" },
      { name: "ZOE" },
      { name: "ANA" },
    ]
    expect(sortPlayersByName(players).map((p) => p.name)).toEqual([
      "ÁLVARO",
      "ANA",
      "nora",
      "ÑAÑO",
      "ZOE",
    ])
  })

  it("returns a copy and leaves the input untouched", () => {
    const players = [{ name: "B" }, { name: "A" }]
    const sorted = sortPlayersByName(players)
    expect(sorted).not.toBe(players)
    expect(players.map((p) => p.name)).toEqual(["B", "A"])
  })
})

describe("canRemoveTicket", () => {
  const withWinners = (state: RoundDraftState, winningNumbers: (number | null)[]) =>
    ({ ...state, winningNumbers }) as RoundDraftState

  it("allows an empty ticket when there are others and no winning numbers", () => {
    const state = withWinners(makeState({ 1: [[4, 1, false]], 2: [] }), [null])
    expect(canRemoveTicket(state, 102)).toBe(true)
  })

  it("refuses a ticket with a play, even a gift", () => {
    const state = withWinners(makeState({ 1: [[4, 1, false]], 2: [[4, 2, true]] }), [null])
    expect(canRemoveTicket(state, 101)).toBe(false)
    expect(canRemoveTicket(state, 102)).toBe(false)
  })

  it("refuses the only ticket and an unknown one", () => {
    const state = withWinners(makeState({ 1: [] }), [])
    expect(canRemoveTicket(state, 101)).toBe(false)
    expect(canRemoveTicket(state, 999)).toBe(false)
  })

  it("refuses once the open round has a winning number", () => {
    const state = withWinners(makeState({ 1: [], 2: [] }), [5, null])
    expect(canRemoveTicket(state, 102)).toBe(false)
  })
})
