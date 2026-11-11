"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeftIcon } from "lucide-react"

import { GameSetupStepper } from "@/components/game-setup-stepper"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useRoundDraft } from "@/lib/round-draft/context"
import { canDiscardGameSession } from "@/lib/round-draft/selectors"

// Leaving /new-game keeps the game session. While it has no rounds (or, in
// an automatic game session, only the untouched round opened at the start)
// it can also be discarded ("Salir y borrar", discard_game_session); after
// that it can only be ended from /active-round. An observer just goes
// back home.
function ExitButton() {
  const router = useRouter()
  const { state, readOnly, discardGameSession } = useRoundDraft()
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [isPending, startTransition] = React.useTransition()

  const canDiscard = !readOnly && canDiscardGameSession(state)

  function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    if (canDiscard) {
      setConfirmOpen(true)
    } else {
      router.push("/")
    }
  }

  function handleConfirmDiscard() {
    startTransition(async () => {
      if (await discardGameSession()) {
        setConfirmOpen(false)
        router.push("/")
      }
    })
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 text-muted-foreground max-lg:min-h-11"
        nativeButton={false}
        render={<Link href="/" onClick={handleClick} />}
      >
        <ArrowLeftIcon className="size-4" aria-hidden="true" />
        {readOnly ? "Inicio" : "Salir"}
      </Button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Salir de la jornada?</DialogTitle>
            <DialogDescription>
              {state.roundMode === "auto"
                ? "La jornada todavía no tiene jugadas. "
                : "La jornada todavía no tiene rondas. "}
              Puedes dejarla para continuar después, o borrarla junto con sus cartones.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button variant="outline" onClick={() => router.push("/")}>
              Salir sin borrar
            </Button>
            <Button variant="destructive" disabled={isPending} onClick={handleConfirmDiscard}>
              Salir y borrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// The last step of "Iniciar jornada" (components/game-setup-stepper.tsx):
// the earlier ones show as done, since the mode is fixed once the game
// session exists.
function StepHeader() {
  const { state } = useRoundDraft()
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-3 lg:px-6">
      <ExitButton />
      <GameSetupStepper mode={state.roundMode} current="tickets" />
    </div>
  )
}

export default function NewGameLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <StepHeader />
      {children}
    </div>
  )
}
