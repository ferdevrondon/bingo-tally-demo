"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useRoundDraft } from "@/lib/round-draft/context"
import { hasRounds } from "@/lib/round-draft/selectors"

// Leaving /new-game keeps the game session. While it has no rounds it can
// also be discarded ("Salir y borrar", discard_game_session); once a round
// exists it can only be ended from /active-round.
function BackToStartCrumb() {
  const router = useRouter()
  const { state, discardGameSession } = useRoundDraft()
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [isPending, startTransition] = React.useTransition()

  const canDiscard = !hasRounds(state)

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
      <BreadcrumbItem>
        <BreadcrumbLink render={<Link href="/" onClick={handleClick} />}>
          Iniciar jornada
        </BreadcrumbLink>
      </BreadcrumbItem>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Salir de la jornada?</DialogTitle>
            <DialogDescription>
              La jornada todavía no tiene rondas. Puedes dejarla para continuar después, o
              borrarla junto con sus cartones.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row justify-end gap-2">
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

function StepBreadcrumb() {
  return (
    <div className="border-b px-4 py-3 lg:px-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BackToStartCrumb />
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Cartones y jugadores</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  )
}

export default function NewGameLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <StepBreadcrumb />
      {children}
    </div>
  )
}
