import { ROUND_KIND_LABELS, type RoundKind } from "@/lib/rounds"
import { cn } from "@/lib/utils"

// The kind of a round template (round_templates.kind), for labels and colors
// only: specials stand out in primary, regulars stay muted.

export function roundKindClasses(kind: RoundKind): string {
  return kind === "special"
    ? "bg-primary text-primary-foreground"
    : "bg-muted text-muted-foreground ring-1 ring-border ring-inset"
}

export function RoundKindBadge({ kind, className }: { kind: RoundKind; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center rounded-full px-2 text-xs font-medium",
        roundKindClasses(kind),
        className
      )}
    >
      {ROUND_KIND_LABELS[kind]}
    </span>
  )
}
