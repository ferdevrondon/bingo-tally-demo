"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  HandIcon,
  PlayIcon,
  RepeatIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { toast } from "sonner"

import { GameSetupStepper, type GameSetupStep } from "@/components/game-setup-stepper"
import {
  newEditorBlock,
  RoundPatternEditor,
  type EditorBlock,
} from "@/components/round-pattern-editor"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { accountStatusText } from "@/lib/accounts"
import type { StartAlerts } from "@/lib/data/account-actions"
import { GAME_ACTION_ERROR_MESSAGES } from "@/lib/data/game-action-result"
import { startGameSession } from "@/lib/data/game-session-actions"
import { balanceLabel } from "@/lib/round-draft/balance"
import { applyShortcut, PATTERN_SHORTCUTS, type RoundMode } from "@/lib/round-pattern"
import type { Round } from "@/lib/rounds"
import { cn } from "@/lib/utils"

// /start-game: the first steps of "Iniciar jornada", on screen instead of in
// dialogs. ① Tipo de jornada (Manual / Automática) → ② Patrón de rondas (only
// in Automática) → ③ Cartones y jugadores, which is /new-game. The step is in
// `?step=` (pushed with the History API, so the browser's back button works);
// nothing is written until "Iniciar jornada".

const MODE_OPTIONS: {
  mode: RoundMode
  title: string
  description: string
  icon: typeof HandIcon
}[] = [
  {
    mode: "manual",
    title: "Manual",
    description: "Eliges la siguiente ronda al cerrar cada una, como siempre.",
    icon: HandIcon,
  },
  {
    mode: "auto",
    title: "Automática",
    description:
      "Armas un patrón de rondas que se repite hasta terminar la jornada. Al cerrar cada ronda solo confirmas la siguiente.",
    icon: RepeatIcon,
  },
]

/** The starting pattern: 1 Especial · 1 Regular when the catalog has both,
 *  else its first round once. */
function initialBlocks(templates: Round[]): EditorBlock[] {
  const shortcut = PATTERN_SHORTCUTS.find((s) => s.id === "1E1R")
  const blocks = shortcut ? applyShortcut(shortcut, templates) : null
  if (blocks) return blocks.map(newEditorBlock)
  return templates[0] ? [newEditorBlock({ roundTemplateId: templates[0].id, repeatCount: 1 })] : []
}

function StartAlertsNotice({ alerts }: { alerts: StartAlerts }) {
  if (alerts.players.length === 0 && alerts.openSettlements.length === 0) return null
  return (
    <Alert className="border-warning/30 bg-warning/5">
      <TriangleAlertIcon className="text-warning" />
      <AlertTitle>Antes de empezar</AlertTitle>
      <AlertDescription className="flex flex-col gap-3">
        <p>Hay saldos pendientes de jornadas anteriores. Puedes iniciar igual.</p>
        {alerts.openSettlements.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="font-medium text-foreground">Liquidaciones abiertas</span>
            {alerts.openSettlements.map((s) => (
              <Link
                key={s.gameSessionId}
                href={`/games/${s.gameSessionId}/settlement`}
                className="w-fit text-primary underline-offset-4 hover:underline"
              >
                Jornada #{s.number} · {s.unresolved} por resolver
              </Link>
            ))}
          </div>
        )}
        {alerts.players.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="font-medium text-foreground">Jugadores con saldo pendiente</span>
            <ul className="max-h-56 divide-y overflow-y-auto rounded-lg border bg-background">
              {alerts.players.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                >
                  <span className="text-foreground">{p.name}</span>
                  <span className="flex flex-col items-end">
                    <span
                      className={cn(
                        "font-medium tabular-nums",
                        p.balance < 0 ? "text-destructive" : "text-success"
                      )}
                    >
                      {balanceLabel(p.balance)}
                    </span>
                    <span className="text-xs">{accountStatusText(p)}</span>
                  </span>
                </li>
              ))}
            </ul>
            <Link
              href="/players"
              className="w-fit text-primary underline-offset-4 hover:underline"
            >
              Ver jugadores
            </Link>
          </div>
        )}
      </AlertDescription>
    </Alert>
  )
}

function ModeOption({
  option,
  selected,
  onSelect,
}: {
  option: (typeof MODE_OPTIONS)[number]
  selected: boolean
  onSelect: () => void
}) {
  const Icon = option.icon
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "relative flex flex-1 flex-col gap-2 rounded-xl border bg-card p-4 text-left transition-colors outline-none hover:border-primary/50 focus-visible:ring-3 focus-visible:ring-ring/50",
        selected && "border-primary bg-primary/5 ring-1 ring-primary"
      )}
    >
      <span className="flex items-center gap-2">
        <span
          className={cn(
            "flex size-9 items-center justify-center rounded-lg",
            selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          )}
        >
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <span className="text-base font-semibold">{option.title}</span>
        {selected && (
          <CheckIcon className="ml-auto size-5 text-primary" aria-hidden="true" />
        )}
      </span>
      <span className="text-sm text-muted-foreground">{option.description}</span>
    </button>
  )
}

export function StartGamePage({
  templates,
  alerts,
}: {
  templates: Round[]
  alerts: StartAlerts
}) {
  const searchParams = useSearchParams()
  const step: GameSetupStep = searchParams.get("step") === "pattern" ? "pattern" : "mode"
  const [mode, setMode] = React.useState<RoundMode | null>(step === "pattern" ? "auto" : null)
  const [blocks, setBlocks] = React.useState<EditorBlock[]>(() => initialBlocks(templates))
  const [isPending, startTransition] = React.useTransition()
  // Whether this page pushed `?step=pattern` (then "Atrás" is the browser's back).
  const pushedRef = React.useRef(false)

  // Landing on ?step=pattern means the automatic mode.
  const effectiveMode: RoundMode | null = step === "pattern" ? "auto" : mode

  function goToPattern() {
    pushedRef.current = true
    window.history.pushState(null, "", "?step=pattern")
  }

  function goBack() {
    setMode("auto")
    if (pushedRef.current) {
      pushedRef.current = false
      window.history.back()
    } else {
      window.history.replaceState(null, "", window.location.pathname)
    }
  }

  function start(chosen: RoundMode) {
    startTransition(async () => {
      const result = await startGameSession(
        crypto.randomUUID(),
        chosen === "auto"
          ? {
              mode: "auto",
              pattern: blocks.map(({ roundTemplateId, repeatCount }) => ({
                roundTemplateId,
                repeatCount,
              })),
            }
          : { mode: "manual" }
      )
      // On success the Server Action redirects to /new-game.
      if (!result.ok) toast.error(GAME_ACTION_ERROR_MESSAGES[result.error])
    })
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <GameSetupStepper mode={effectiveMode} current={step} />

      {step === "mode" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">¿Cómo quieres jugar esta jornada?</CardTitle>
            <CardDescription>
              El tipo de jornada se elige al iniciar y no se cambia después.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div
              role="radiogroup"
              aria-label="Tipo de jornada"
              className="flex flex-col gap-3 sm:flex-row"
            >
              {MODE_OPTIONS.map((option) => (
                <ModeOption
                  key={option.mode}
                  option={option}
                  selected={mode === option.mode}
                  onSelect={() => setMode(option.mode)}
                />
              ))}
            </div>
            <StartAlertsNotice alerts={alerts} />
          </CardContent>
          <CardFooter className="flex justify-between gap-2">
            <Button variant="outline" nativeButton={false} render={<Link href="/" />}>
              Cancelar
            </Button>
            {mode === "auto" ? (
              <Button className="gap-2" onClick={goToPattern}>
                Siguiente
                <ArrowRightIcon className="size-4" />
              </Button>
            ) : (
              <Button
                className="gap-2"
                disabled={mode === null || isPending}
                onClick={() => start("manual")}
              >
                <PlayIcon className="size-4" />
                Iniciar jornada
              </Button>
            )}
          </CardFooter>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Patrón de rondas</CardTitle>
            <CardDescription>
              Arma un ciclo: cada bloque es una ronda y cuántas veces se juega seguida. El
              ciclo se repite hasta terminar la jornada.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {templates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay rondas configuradas.{" "}
                <Link href="/rounds" className="text-primary underline-offset-4 hover:underline">
                  Crea una ronda en Rondas
                </Link>{" "}
                para armar el patrón.
              </p>
            ) : (
              <RoundPatternEditor templates={templates} blocks={blocks} onChange={setBlocks} />
            )}
          </CardContent>
          <CardFooter className="flex justify-between gap-2">
            <Button variant="outline" className="gap-2" onClick={goBack} disabled={isPending}>
              <ArrowLeftIcon className="size-4" />
              Atrás
            </Button>
            <Button
              className="gap-2"
              disabled={blocks.length === 0 || isPending}
              onClick={() => start("auto")}
            >
              <PlayIcon className="size-4" />
              Iniciar jornada
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  )
}
