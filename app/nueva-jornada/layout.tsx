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
import { hasDraftProgress } from "@/lib/round-draft/selectors"

function BackToStartCrumb() {
  const router = useRouter()
  const { state, resetDraft } = useRoundDraft()
  const [confirmOpen, setConfirmOpen] = React.useState(false)

  const hasProgress = hasDraftProgress(state)

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

export default function NuevaJornadaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <StepBreadcrumb />
      {children}
    </div>
  )
}
