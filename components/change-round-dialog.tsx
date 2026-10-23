"use client"

import * as React from "react"

import { ConfirmRoundDialog } from "@/components/confirm-round-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useRoundDraft } from "@/lib/round-draft/context"
import { roundOptionLabel, type Round } from "@/lib/rounds"

// Fixes a wrong pick: swaps the open round while nothing in it has been
// charged (canChangeRound). Players still deciding are charged at the new price.
export function ChangeRoundDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { state, roundTemplates, startRound } = useRoundDraft()
  const [selectedId, setSelectedId] = React.useState("")
  const [confirmRound, setConfirmRound] = React.useState<Round | null>(null)

  async function handleConfirm(round: Round) {
    const ok = await startRound(round.id)
    setConfirmRound(null)
    if (!ok) return
    setSelectedId("")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-xl">Cambiar la ronda</DialogTitle>
          <DialogDescription>
            Ronda actual: {state.round?.name}. Los jugadores que aún deciden
            mantener o liberar su jugada se cobrarán con la ronda que elijas.
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 py-4">
          <Select
            value={selectedId}
            onValueChange={(value) => setSelectedId(value ?? "")}
            items={roundTemplates.map((r) => ({
              label: roundOptionLabel(r),
              value: String(r.id),
            }))}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecciona la ronda correcta" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {roundTemplates.map((r) => (
                  <SelectItem key={r.id} value={String(r.id)}>
                    {roundOptionLabel(r)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!selectedId || Number(selectedId) === state.round?.templateId}
            onClick={() =>
              setConfirmRound(
                roundTemplates.find((r) => String(r.id) === selectedId) ?? null
              )
            }
          >
            Confirmar
          </Button>
        </DialogFooter>
        <ConfirmRoundDialog
          round={confirmRound}
          onOpenChange={(next) => !next && setConfirmRound(null)}
          onConfirm={handleConfirm}
        />
      </DialogContent>
    </Dialog>
  )
}
