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

  it("shows a free number as a tint and a taken one as the solid color", () => {
    expect(FREE_NUMBER_CLASSES).toContain("bg-primary/10")
    expect(getTakenNumberClasses(2, false)).toContain("bg-primary")
    expect(getTakenNumberClasses(2, false)).toContain("text-white")
    expect(getTakenNumberClasses(2, false)).not.toContain("dashed")
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
