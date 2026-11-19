import { describe, expect, it } from "vitest"

import { DEFAULT_PAYOUT_TYPE, isPayoutType, payoutTypeLabel } from "./payout-types"

describe("payout types", () => {
  it("knows its values", () => {
    expect(isPayoutType("ernie")).toBe(true)
    expect(isPayoutType("dairy")).toBe(true)
    expect(isPayoutType("ERNIE")).toBe(false)
    expect(isPayoutType(null)).toBe(false)
  })

  it("labels them in uppercase and defaults to ERNIE", () => {
    expect(payoutTypeLabel("dairy")).toBe("DAIRY")
    expect(payoutTypeLabel(null)).toBe("")
    expect(DEFAULT_PAYOUT_TYPE).toBe("ernie")
  })
})
