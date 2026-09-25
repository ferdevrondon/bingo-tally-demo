"use client"

import * as React from "react"
import { ArrowRightIcon, PlayIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { GAME_ACTION_ERROR_MESSAGES } from "@/lib/data/game-action-result"
import { startGameSession } from "@/lib/data/game-session-actions"
import { cn } from "@/lib/utils"

// "Iniciar jornada": creates the house's game session (or reuses the active
// one) and goes to /new-game. The Server Action redirects on success.
export function StartGameSessionButton({ className }: { className?: string }) {
  const [isPending, startTransition] = React.useTransition()

  function handleClick() {
    startTransition(async () => {
      const result = await startGameSession(crypto.randomUUID())
      if (!result.ok) toast.error(GAME_ACTION_ERROR_MESSAGES[result.error])
    })
  }

  return (
    <Button size="lg" className={cn("w-fit gap-2", className)} disabled={isPending} onClick={handleClick}>
      <PlayIcon className="size-5" />
      Iniciar jornada
      <ArrowRightIcon className="size-4" />
    </Button>
  )
}
