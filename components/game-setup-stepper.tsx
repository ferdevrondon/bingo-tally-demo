import { CheckIcon } from "lucide-react"

import type { RoundMode } from "@/lib/round-pattern"
import { cn } from "@/lib/utils"

// The steps of starting a game session, shown on /start-game and /new-game:
//   Manual:     Tipo de jornada → Cartones y jugadores
//   Automática: Tipo de jornada → Patrón de rondas → Cartones y jugadores
// Before a mode is chosen the three steps show.

export type GameSetupStep = "mode" | "pattern" | "tickets"

const STEP_LABELS: Record<GameSetupStep, string> = {
  mode: "Tipo de jornada",
  pattern: "Patrón de rondas",
  tickets: "Cartones y jugadores",
}

export function gameSetupSteps(mode: RoundMode | null): GameSetupStep[] {
  return mode === "manual" ? ["mode", "tickets"] : ["mode", "pattern", "tickets"]
}

export function GameSetupStepper({
  mode,
  current,
  className,
}: {
  mode: RoundMode | null
  current: GameSetupStep
  className?: string
}) {
  const steps = gameSetupSteps(mode)
  const currentIndex = steps.indexOf(current)

  return (
    <nav aria-label="Pasos para iniciar la jornada" className={className}>
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-2">
        {steps.map((step, index) => {
          const done = index < currentIndex
          const active = index === currentIndex
          return (
            <li key={step} className="flex items-center gap-2">
              {index > 0 && (
                <span
                  aria-hidden="true"
                  className={cn("h-px w-4 sm:w-8", done || active ? "bg-primary" : "bg-border")}
                />
              )}
              <span
                aria-current={active ? "step" : undefined}
                className="flex items-center gap-2 text-sm"
              >
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums",
                    done && "border-primary bg-primary text-primary-foreground",
                    active && "border-primary text-primary ring-2 ring-primary/20",
                    !done && !active && "text-muted-foreground"
                  )}
                >
                  {done ? <CheckIcon className="size-3.5" aria-hidden="true" /> : index + 1}
                </span>
                <span
                  className={cn(
                    active ? "font-semibold text-foreground" : "text-muted-foreground",
                    !active && "max-sm:sr-only"
                  )}
                >
                  {STEP_LABELS[step]}
                </span>
              </span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
