import { describe, expect, it } from "vitest"

import {
  FREE_NUMBER_CLASSES,
  getPlayerChartColorClass,
  getPlayerColorClass,
  getTakenNumberClasses,
  PLAYER_COLOR_MODE,
} from "./colors"

describe("ticket colors", () => {
  it("is unicolor by default: every player is the same solid color", () => {
    expect(PLAYER_COLOR_MODE).toBe("unicolor")
    expect(getPlayerColorClass(0)).toBe(getPlayerColorClass(7))
    expect(getPlayerColorClass(0)).toBe("bg-primary")
  })

  it("shows free, taken and active numbers in three teal steps", () => {
    expect(FREE_NUMBER_CLASSES).toContain("bg-[#f0fdfa]")
    expect(getTakenNumberClasses(2, false)).toContain("bg-[#0f766e]")
    expect(getTakenNumberClasses(2, false)).toContain("text-white")
    expect(getTakenNumberClasses(2, false)).not.toContain("dashed")
    expect(getTakenNumberClasses(2, false, true)).toContain("bg-[#2dd4bf]")
  })

  it("marks a gift with the dashed border", () => {
    expect(getTakenNumberClasses(0, true)).toContain("border-dashed")
  })

  it("keeps one color per player for the charts", () => {
    expect(getPlayerChartColorClass(0)).not.toBe(getPlayerChartColorClass(1))
    expect(getPlayerChartColorClass(16)).toBe(getPlayerChartColorClass(0))
    expect(getPlayerChartColorClass(-1)).toBe("bg-muted")
  })
})
