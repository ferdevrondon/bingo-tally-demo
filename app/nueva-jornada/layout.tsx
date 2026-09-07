"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"

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
import { RoundDraftProvider, useRoundDraft } from "@/lib/round-draft/context"
import { getBasePlayers } from "@/lib/round-draft/players"

const steps = [
  { title: "Cartones y jugadores", href: "/nueva-jornada" },
  { title: "Resumen de ronda", href: "/nueva-jornada/resumen" },
]

function BackToStartCrumb() {
  const router = useRouter()
  const { state, resetDraft } = useRoundDraft()
  const [confirmOpen, setConfirmOpen] = React.useState(false)

  const hasProgress =
    state.cartones.some((c) => c.numbers.some((n) => n.playerId !== null)) ||
    state.players.length > getBasePlayers().length

  function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    if (hasProgress) {
      setConfirmOpen(true)
    } else {
      router.push("/")
    }
  }

  function handleConfirmDiscard() {
    resetDraft()
    setConfirmOpen(false)
    router.push("/")
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
            <DialogTitle>¿Estás seguro?</DialogTitle>
            <DialogDescription>
              Se borrarán los cartones y jugadores seleccionados para esta ronda.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row justify-end">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleConfirmDiscard}>
              Salir y borrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function StepBreadcrumb() {
  const pathname = usePathname()

  return (
    <div className="border-b px-4 py-3 lg:px-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BackToStartCrumb />
          {steps.map((step) => {
            const isCurrent = pathname === step.href
            return (
              <React.Fragment key={step.href}>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  {isCurrent ? (
                    <BreadcrumbPage>{step.title}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink render={<Link href={step.href} />}>
                      {step.title}
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </React.Fragment>
            )
          })}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  )
}

export default function NuevaJornadaLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoundDraftProvider>
      <div className="flex flex-1 flex-col">
        <StepBreadcrumb />
        {children}
      </div>
    </RoundDraftProvider>
  )
}
