import { describe, expect, it } from "vitest"

import type { ActivityEntry, ActivityEntryType } from "@/lib/round-draft/types"

import { groupTimeline, timelineCategories } from "./timeline"

let nextId = 1
function entry(
  type: ActivityEntryType,
  timestamp: number,
  playerId: number | null = null
): ActivityEntry {
  return {
    id: nextId++,
    timestamp,
    type,
    playerId,
    roundId: null,
    ticketId: null,
    number: null,
    amount: null,
    paymentMethod: null,
    bank: null,
    note: null,
    correctsId: null,
  }
}

const MIN = 60_000
const t = 1_000 * MIN

describe("groupTimeline", () => {
  const entries = [
    entry("game_session_ended", t + 30_000),
    entry("balance_closed", t + 20_000, 1),
    entry("balance_closed", t + 10_000, 2),
    entry("margin_adjustment", t),
    entry("number_gifted", t - 26 * MIN, 1),
    entry("prize_won", t - 500 * MIN, 2),
  ]

  it("groups rows by minute and folds a run of final balances", () => {
    const groups = groupTimeline(entries)
    expect(groups.map((g) => g.items.length)).toEqual([3, 1, 1])
    const balances = groups[0].items[1]
    expect(balances.kind).toBe("balances")
    expect(
      balances.kind === "balances" && balances.entries.map((e) => e.playerId)
    ).toEqual([1, 2])
  })

  it("filters by category", () => {
    const groups = groupTimeline(entries, "rounds")
    expect(groups).toHaveLength(1)
    expect(groups[0].items).toHaveLength(2)
  })

  it("lists the categories present", () => {
    expect(timelineCategories(entries)).toEqual([
      "prizes",
      "gifts",
      "rounds",
      "balances",
    ])
  })
})
