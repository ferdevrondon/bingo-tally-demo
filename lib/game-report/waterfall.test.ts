import { describe, expect, it } from "vitest"

import { houseResult } from "./ledger"
import { houseWaterfall } from "./waterfall"

describe("houseWaterfall", () => {
  it("places each line where the previous one left the total", () => {
    const house = houseResult({
      sales: 625,
      prizes: 775,
      gifts: -30,
      unsoldLosing: -355,
      unsoldWinning: 195,
    })
    const { steps, zero } = houseWaterfall(house)
    // The totals go from -535 to 625: a range of 1160.
    expect(zero).toBeCloseTo((535 / 1160) * 100)
    expect(steps[0]).toMatchObject({ value: 625, left: zero })
    expect(steps[0].width).toBeCloseTo((625 / 1160) * 100)
    expect(steps[1].left).toBeCloseTo((385 / 1160) * 100)
    expect(steps[1].left + steps[1].width).toBeCloseTo(100)
    expect(steps[3].left).toBe(0)
    const result = steps[5]
    expect(result).toMatchObject({ value: -340, total: true })
    expect(result.left + result.width).toBeCloseTo(zero)
  })

  it("draws no bars when nothing moved", () => {
    const { steps, zero } = houseWaterfall(
      houseResult({
        sales: 0,
        prizes: 0,
        gifts: 0,
        unsoldLosing: 0,
        unsoldWinning: 0,
      })
    )
    expect(zero).toBe(0)
    expect(steps.every((s) => s.width === 0)).toBe(true)
  })
})
