"use client"

import * as React from "react"

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
import { fireConfetti } from "@/lib/confetti"
import { useRoundDraft } from "@/lib/round-draft/context"
import { getBaseRounds } from "@/lib/rounds"
import { Separator } from "@base-ui/react"
import { CircleAlertIcon } from "lucide-react"
import { Alert, AlertTitle, } from "./ui/alert"

export function CloseRoundDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { state, closeRound } = useRoundDraft()
  const otherRounds = getBaseRounds().filter((r) => r.id !== state.round?.id)
  const [selectedRoundId, setSelectedRoundId] = React.useState("")

  function handleConfirm() {
    const round = otherRounds.find((r) => r.id === Number(selectedRoundId))
    if (!round) return
    closeRound(round)
    fireConfetti()
    setSelectedRoundId("")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className={"text-xl"}>
            Cerrar ronda y comenzar la siguiente
          </DialogTitle>
          {/* <DialogDescription>
            Selecciona la ronda que empieza a continuación. Los jugadores deberán confirmar
            check-in y decidir si mantienen o liberan su jugada.
          </DialogDescription> */}
        </DialogHeader>
        <Separator className={"border border-muted/50"} />
        <div className="grid grid-cols-1 px-6 py-4 gap-4">
          {/* <div className="px-6">
            <span className="mb-2 text-black">
              {" "}
              Selecciona la siguiente ronda:{" "}
            </span>
          </div> */}
          <div className="">
            {otherRounds.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay otra ronda configurada. Agrega una ronda en Rondas.
              </p>
            ) : (
              <>
               <div className="px-4 mb-3">
            <span className="mb-2 font-extrabold">
              {" "}
              Selecciona la siguiente ronda:{" "}
            </span>
          </div>
                <Select
                  value={selectedRoundId}
                  onValueChange={(value) => setSelectedRoundId(value ?? "")}
                  items={otherRounds.map((r) => ({
                    label: r.name,
                    value: String(r.id),
                  }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecciona una ronda" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {otherRounds.map((r) => (
                        <SelectItem key={r.id} value={String(r.id)}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </>
            )}
          </div>
          <Alert className="border-none bg-amber-600/10 p-2 text-amber-600 dark:bg-amber-400/10 dark:text-amber-400">
            <CircleAlertIcon />
            <AlertTitle>Los jugadores deberán confirmar check-in</AlertTitle>
            {/* <AlertDescription className="text-sky-600/80 dark:text-sky-400/80">
               Los jugadores deberán confirmar check-in y decidir si
                    mantienen o liberan su jugada.
              </AlertDescription> */}
          </Alert>
        </div>

        <DialogFooter className="flex-row justify-end gap-2 bg-muted/50 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={!selectedRoundId} onClick={handleConfirm}>
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
