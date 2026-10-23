"use client"

import * as React from "react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { formatMoney, prizesLabel, type Round } from "@/lib/rounds"

// Confirmation before a round starts: it shows the name, line price and prizes
// so a wrong pick is caught by reading it. The dialog stays open while
// `onConfirm` runs.
export function ConfirmRoundDialog({
  round,
  onOpenChange,
  description,
  onConfirm,
}: {
  /** The round to confirm; null keeps the dialog closed. */
  round: Round | null
  onOpenChange: (open: boolean) => void
  description?: string
  onConfirm: (round: Round) => Promise<void>
}) {
  const [isPending, startTransition] = React.useTransition()

  return (
    <AlertDialog open={round !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        {round && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>
                ¿Continuar con la ronda {round.name}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Precio por línea {formatMoney(round.linePrice)} ·{" "}
                {prizesLabel(round.prizes)}
                {description ? `. ${description}` : ""}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                disabled={isPending}
                onClick={() => startTransition(() => onConfirm(round))}
              >
                Sí, continuar
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  )
}
