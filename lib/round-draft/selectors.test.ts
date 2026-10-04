import { describe, expect, it } from "vitest"

import { getPlayerNumberSummary } from "./selectors"
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
