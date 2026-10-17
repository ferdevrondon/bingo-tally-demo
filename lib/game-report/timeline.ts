import type { ActivityEntry, ActivityEntryType } from "@/lib/round-draft/types"

// The Historial of a game session report, grouped for reading: rows of the
// same minute share one header, and a run of final (or opening) balances
// becomes one item with a chip per player.

export type TimelineCategory =
  "plays" | "prizes" | "gifts" | "rounds" | "cash" | "balances" | "other"

const CATEGORY_BY_TYPE: Record<ActivityEntryType, TimelineCategory> = {
  number_purchased: "plays",
  number_released: "plays",
  number_reassigned: "plays",
  number_moved: "plays",
  carryover_kept: "plays",
  carryover_released: "plays",
  prize_won: "prizes",
  number_gifted: "gifts",
  number_ungifted: "gifts",
  game_session_started: "rounds",
  game_session_ended: "rounds",
  round_started: "rounds",
  round_closed: "rounds",
  margin_adjustment: "rounds",
  settlement_closed: "rounds",
  recharge: "cash",
  payout: "cash",
  balance_opened: "balances",
  balance_closed: "balances",
  credit_kept_for_play: "balances",
  credit_payout_pending: "balances",
  debt_noted: "balances",
  adjustment: "balances",
  player_added: "other",
  player_removed: "other",
  ticket_added: "other",
  check_in: "other",
  check_in_undone: "other",
}

export function timelineCategory(type: ActivityEntryType): TimelineCategory {
  return CATEGORY_BY_TYPE[type]
}

export type TimelineItem =
  | { kind: "entry"; entry: ActivityEntry }
  | {
      kind: "balances"
      type: "balance_opened" | "balance_closed"
      entries: ActivityEntry[]
    }

export interface TimelineGroup {
  /** The minute the group's rows happened (ms, start of the minute). */
  minute: number
  items: TimelineItem[]
}

const BALANCE_RUNS = new Set<ActivityEntryType>([
  "balance_opened",
  "balance_closed",
])

/** Groups entries (newest first, as the report lists them) by minute,
 *  keeping only those of `category` when given. */
export function groupTimeline(
  entries: ActivityEntry[],
  category: TimelineCategory | null = null
): TimelineGroup[] {
  const groups: TimelineGroup[] = []
  for (const entry of entries) {
    if (category && timelineCategory(entry.type) !== category) continue
    const minute = Math.floor(entry.timestamp / 60_000) * 60_000
    let group = groups.at(-1)
    if (!group || group.minute !== minute) {
      group = { minute, items: [] }
      groups.push(group)
    }
    const last = group.items.at(-1)
    if (BALANCE_RUNS.has(entry.type)) {
      if (last?.kind === "balances" && last.type === entry.type) {
        last.entries.push(entry)
      } else {
        group.items.push({
          kind: "balances",
          type: entry.type as "balance_opened" | "balance_closed",
          entries: [entry],
        })
      }
    } else {
      group.items.push({ kind: "entry", entry })
    }
  }
  return groups
}

/** The categories present in the entries, in a fixed order. */
export function timelineCategories(
  entries: ActivityEntry[]
): TimelineCategory[] {
  const present = new Set(entries.map((e) => timelineCategory(e.type)))
  return (
    ["plays", "prizes", "gifts", "rounds", "cash", "balances", "other"] as const
  ).filter((c) => present.has(c))
}
