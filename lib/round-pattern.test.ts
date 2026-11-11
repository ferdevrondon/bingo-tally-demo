import { describe, expect, it } from "vitest"

import type { Round } from "@/lib/rounds"

import {
  applyShortcut,
  cycleLength,
  cyclePositionLabel,
  gameSessionConfigSchema,
  nextPatternStep,
  PATTERN_SHORTCUTS,
  patternStep,
  patternSummary,
  previewStrip,
  stepLabel,
  toPatternJson,
  withTemplates,
  type PatternBlock,
} from "./round-pattern"

const especial: PatternBlock = { roundTemplateId: 2, repeatCount: 4, name: "Especial", kind: "special", active: true }
const regular: PatternBlock = { roundTemplateId: 1, repeatCount: 1, name: "Regular", kind: "regular", active: true }
const fourOne = [especial, regular]

const templates: Round[] = [
  { id: 1, name: "Regular", kind: "regular", linePrice: 10, prizes: [100] },
  { id: 2, name: "Especial", kind: "special", linePrice: 10, prizes: [100, 50] },
  { id: 3, name: "Especial $20", kind: "special", linePrice: 20, prizes: [200, 100] },
]

describe("cycleLength", () => {
  it("sums the counts", () => {
    expect(cycleLength(fourOne)).toBe(5)
    expect(cycleLength([])).toBe(0)
  })
})

describe("patternStep", () => {
  it("walks the cycle 4E · 1R and repeats it", () => {
    const names = Array.from({ length: 11 }, (_, i) => patternStep(fourOne, i)?.block.name)
    expect(names).toEqual([
      "Especial", "Especial", "Especial", "Especial", "Regular",
      "Especial", "Especial", "Especial", "Especial", "Regular",
      "Especial",
    ])
  })

  it("gives the place in the block and in the cycle", () => {
    expect(patternStep(fourOne, 2)).toMatchObject({
      blockIndex: 0,
      occurrence: 3,
      ofCount: 4,
      cyclePosition: 3,
      cycleLength: 5,
      cycle: 1,
    })
    expect(patternStep(fourOne, 9)).toMatchObject({
      blockIndex: 1,
      occurrence: 1,
      cyclePosition: 5,
      cycle: 2,
    })
    expect(patternStep(fourOne, 13)).toMatchObject({ cyclePosition: 4, cycle: 3 })
  })

  it("is null for an empty pattern or a bad index", () => {
    expect(patternStep([], 0)).toBeNull()
    expect(patternStep(fourOne, -1)).toBeNull()
    expect(patternStep(fourOne, 1.5)).toBeNull()
  })
})

describe("nextPatternStep", () => {
  it("follows the rounds the game session has, the open one included", () => {
    // Round 1 open (index 0): the next one is index 1, still Especial (2 of 4).
    expect(nextPatternStep(fourOne, 1)).toMatchObject({ occurrence: 2, block: { name: "Especial" } })
    // Rounds 1-4 played: the 5th is the Regular.
    expect(nextPatternStep(fourOne, 4)?.block.name).toBe("Regular")
  })

  it("counts a round picked by hand as played: the cycle doesn't shift", () => {
    // Round 2 was meant to be Especial; the host played a Regular instead.
    // The game session has 2 rounds either way, so round 3 is Especial 3 of 4.
    expect(nextPatternStep(fourOne, 2)).toMatchObject({ occurrence: 3, ofCount: 4 })
  })
})

describe("labels", () => {
  it("names the step", () => {
    expect(stepLabel(patternStep(fourOne, 2)!)).toBe("Especial 3 de 4 en este ciclo")
    expect(stepLabel(patternStep(fourOne, 4)!)).toBe("Regular")
    expect(cyclePositionLabel(patternStep(fourOne, 6)!)).toBe("paso 2 de 5")
  })
})

describe("previewStrip", () => {
  it("marks where the cycle repeats", () => {
    const strip = previewStrip(fourOne, 11)
    expect(strip.map((item) => (item.cycleStart ? "| " : "") + item.short).join(" ")).toBe(
      "E E E E R | E E E E R | E"
    )
  })

  it("is empty for an empty pattern", () => {
    expect(previewStrip([], 5)).toEqual([])
  })
})

describe("patternSummary", () => {
  it("counts by kind", () => {
    expect(patternSummary(fourOne)).toBe(
      "Se juegan 4 Especiales y 1 Regular, y se repite hasta finalizar la jornada."
    )
    expect(patternSummary([{ ...regular, repeatCount: 3 }, { ...especial, repeatCount: 1 }])).toBe(
      "Se juegan 3 Regulares y 1 Especial, y se repite hasta finalizar la jornada."
    )
  })

  it("names the templates when two blocks share a kind", () => {
    const other: PatternBlock = { ...especial, roundTemplateId: 3, name: "Especial $20", repeatCount: 1 }
    expect(patternSummary([{ ...especial, repeatCount: 2 }, other, regular])).toBe(
      "Se juegan 2 Especial, 1 Especial $20 y 1 Regular, y se repite hasta finalizar la jornada."
    )
  })

  it("is empty without blocks", () => {
    expect(patternSummary([])).toBe("")
  })
})

describe("shortcuts", () => {
  it("use the first template of each kind", () => {
    const shortcut = PATTERN_SHORTCUTS.find((s) => s.id === "4E1R")!
    expect(applyShortcut(shortcut, templates)).toEqual([
      { roundTemplateId: 2, repeatCount: 4 },
      { roundTemplateId: 1, repeatCount: 1 },
    ])
  })

  it("is null when a kind is missing from the catalog", () => {
    const shortcut = PATTERN_SHORTCUTS.find((s) => s.id === "1E1R")!
    expect(applyShortcut(shortcut, templates.filter((t) => t.kind === "regular"))).toBeNull()
  })
})

describe("withTemplates and toPatternJson", () => {
  it("adds the template data and leaves unknown templates out", () => {
    expect(
      withTemplates(
        [
          { roundTemplateId: 3, repeatCount: 2 },
          { roundTemplateId: 99, repeatCount: 1 },
        ],
        templates
      )
    ).toEqual([{ roundTemplateId: 3, repeatCount: 2, name: "Especial $20", kind: "special", active: true }])
  })

  it("maps to the SQL JSON", () => {
    expect(toPatternJson([{ roundTemplateId: 2, repeatCount: 4 }])).toEqual([
      { round_template_id: 2, repeat_count: 4 },
    ])
  })
})

describe("gameSessionConfigSchema", () => {
  it("accepts manual and a valid auto pattern", () => {
    expect(gameSessionConfigSchema.safeParse({ mode: "manual" }).success).toBe(true)
    expect(
      gameSessionConfigSchema.safeParse({
        mode: "auto",
        pattern: [{ roundTemplateId: 2, repeatCount: 4 }],
      }).success
    ).toBe(true)
  })

  it("rejects an empty pattern and bad counts", () => {
    expect(gameSessionConfigSchema.safeParse({ mode: "auto", pattern: [] }).success).toBe(false)
    expect(
      gameSessionConfigSchema.safeParse({
        mode: "auto",
        pattern: [{ roundTemplateId: 2, repeatCount: 0 }],
      }).success
    ).toBe(false)
    expect(
      gameSessionConfigSchema.safeParse({
        mode: "auto",
        pattern: [{ roundTemplateId: 2, repeatCount: 21 }],
      }).success
    ).toBe(false)
  })
})
