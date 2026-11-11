import { z } from "zod"

import {
  ROUND_KIND_LABELS,
  ROUND_KIND_PLURALS,
  ROUND_KIND_SHORT,
  type Round,
  type RoundKind,
} from "@/lib/rounds"

// Automatic game sessions (BACKEND_PLAN.md "Automatic game sessions: a round
// pattern"): one cycle of blocks `round template × count` that repeats until
// the game session ends. Pure functions, shared by the start screen (no game
// session yet) and the live game (lib/round-draft/). The pattern only
// proposes the next round: close_round still receives the template the host
// confirms, and the kind never drives the advance.

/** game_sessions.round_mode. */
export const ROUND_MODES = ["manual", "auto"] as const
export type RoundMode = (typeof ROUND_MODES)[number]

export const MAX_PATTERN_BLOCKS = 20
export const MAX_REPEAT_COUNT = 20

/** One block of the cycle, as stored (game_session_round_pattern). */
export interface PatternBlockInput {
  roundTemplateId: number
  repeatCount: number
}

/** A block with what the screens show of its template. `active` = false when
 *  the template was deactivated since: it can no longer be played. */
export interface PatternBlock extends PatternBlockInput {
  name: string
  kind: RoundKind
  active: boolean
}

// Shared by the start screen and the Server Action (startGameSession).
export const patternBlockSchema = z.object({
  roundTemplateId: z.number().int().positive(),
  repeatCount: z.number().int().min(1).max(MAX_REPEAT_COUNT),
})

export const gameSessionConfigSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("manual") }),
  z.object({
    mode: z.literal("auto"),
    pattern: z.array(patternBlockSchema).min(1).max(MAX_PATTERN_BLOCKS),
  }),
])
export type GameSessionConfig = z.infer<typeof gameSessionConfigSchema>

/** The JSON start_game_session takes as p_pattern. */
export function toPatternJson(blocks: PatternBlockInput[]) {
  return blocks.map((block) => ({
    round_template_id: block.roundTemplateId,
    repeat_count: block.repeatCount,
  }))
}

/** Rounds in one cycle: the sum of the counts. */
export function cycleLength(blocks: PatternBlockInput[]): number {
  return blocks.reduce((sum, block) => sum + block.repeatCount, 0)
}

export interface PatternStep<B extends PatternBlockInput = PatternBlockInput> {
  block: B
  blockIndex: number
  /** 1-based place of this round inside its block ("Especial 3 de 4"). */
  occurrence: number
  /** The block's count. */
  ofCount: number
  /** 1-based place inside the cycle ("paso 2 de 5"). */
  cyclePosition: number
  cycleLength: number
  /** 1-based number of the cycle this round belongs to. */
  cycle: number
}

/** The step played by the round at 0-based position `index` of the game
 *  session (its seq − 1): `index mod cycle length`. Null for an empty pattern. */
export function patternStep<B extends PatternBlockInput>(
  blocks: B[],
  index: number
): PatternStep<B> | null {
  const length = cycleLength(blocks)
  if (length === 0 || !Number.isInteger(index) || index < 0) return null
  let position = index % length
  for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
    const block = blocks[blockIndex]
    if (position < block.repeatCount) {
      return {
        block,
        blockIndex,
        occurrence: position + 1,
        ofCount: block.repeatCount,
        cyclePosition: (index % length) + 1,
        cycleLength: length,
        cycle: Math.floor(index / length) + 1,
      }
    }
    position -= block.repeatCount
  }
  return null
}

/** The step of the round that follows the ones the game session already has
 *  (`roundCount`, the open one included). A round picked by hand ("Cambiar
 *  solo esta vez") counts as played, so nothing else is needed. */
export function nextPatternStep<B extends PatternBlockInput>(
  blocks: B[],
  roundCount: number
): PatternStep<B> | null {
  return patternStep(blocks, roundCount)
}

/** "Especial 3 de 4 en este ciclo" (or "Especial" when the block has one). */
export function stepLabel(step: PatternStep<PatternBlock>): string {
  const kind = ROUND_KIND_LABELS[step.block.kind]
  return step.ofCount > 1 ? `${kind} ${step.occurrence} de ${step.ofCount} en este ciclo` : kind
}

/** "paso 2 de 5". */
export function cyclePositionLabel(step: PatternStep): string {
  return `paso ${step.cyclePosition} de ${step.cycleLength}`
}

export interface StripItem {
  /** 0-based round position in the game session. */
  index: number
  blockIndex: number
  short: string
  name: string
  kind: RoundKind
  /** The first round of a cycle after the first one: where it repeats. */
  cycleStart: boolean
}

/** The next `count` rounds from the start, for the preview strip
 *  ("E E E E R | E E E E R | E …"). */
export function previewStrip(blocks: PatternBlock[], count: number): StripItem[] {
  const items: StripItem[] = []
  for (let index = 0; index < count; index++) {
    const step = patternStep(blocks, index)
    if (!step) break
    items.push({
      index,
      blockIndex: step.blockIndex,
      short: ROUND_KIND_SHORT[step.block.kind],
      name: step.block.name,
      kind: step.block.kind,
      cycleStart: index > 0 && step.cyclePosition === 1,
    })
  }
  return items
}

function joinSpanish(parts: string[]): string {
  if (parts.length <= 1) return parts.join("")
  return `${parts.slice(0, -1).join(", ")} y ${parts[parts.length - 1]}`
}

/** "Se juegan 4 Especiales y 1 Regular, y se repite hasta finalizar la
 *  jornada." Consecutive blocks are named by template when two of the same
 *  kind would read the same ("2 Especial $10 y 1 Especial $20"). */
export function patternSummary(blocks: PatternBlock[]): string {
  if (blocks.length === 0) return ""
  const kinds = new Set(blocks.map((b) => b.kind))
  const byName = kinds.size !== blocks.length
  const parts = blocks.map((block) => {
    if (byName) return `${block.repeatCount} ${block.name}`
    const word =
      block.repeatCount === 1 ? ROUND_KIND_LABELS[block.kind] : ROUND_KIND_PLURALS[block.kind]
    return `${block.repeatCount} ${word}`
  })
  return `Se juegan ${joinSpanish(parts)}, y se repite hasta finalizar la jornada.`
}

export interface PatternShortcut {
  id: string
  label: string
  blocks: { kind: RoundKind; repeatCount: number }[]
}

/** The common patterns offered as shortcuts. */
export const PATTERN_SHORTCUTS: PatternShortcut[] = [
  {
    id: "1E1R",
    label: "1E · 1R",
    blocks: [
      { kind: "special", repeatCount: 1 },
      { kind: "regular", repeatCount: 1 },
    ],
  },
  {
    id: "3R1E",
    label: "3R · 1E",
    blocks: [
      { kind: "regular", repeatCount: 3 },
      { kind: "special", repeatCount: 1 },
    ],
  },
  {
    id: "4E1R",
    label: "4E · 1R",
    blocks: [
      { kind: "special", repeatCount: 4 },
      { kind: "regular", repeatCount: 1 },
    ],
  },
]

/** A shortcut's blocks with the first template of each kind in the catalog
 *  order, or null when the catalog has no template of a kind it needs. */
export function applyShortcut(
  shortcut: PatternShortcut,
  templates: Round[]
): PatternBlockInput[] | null {
  const blocks: PatternBlockInput[] = []
  for (const block of shortcut.blocks) {
    const template = templates.find((t) => t.kind === block.kind)
    if (!template) return null
    blocks.push({ roundTemplateId: template.id, repeatCount: block.repeatCount })
  }
  return blocks
}

/** The blocks with their template's name and kind, from the catalog (the
 *  start screen; the live game reads them with the pattern). Blocks whose
 *  template is not in the catalog are left out. */
export function withTemplates(blocks: PatternBlockInput[], templates: Round[]): PatternBlock[] {
  const byId = new Map(templates.map((t) => [t.id, t]))
  return blocks.flatMap((block) => {
    const template = byId.get(block.roundTemplateId)
    return template
      ? [{ ...block, name: template.name, kind: template.kind, active: true }]
      : []
  })
}
