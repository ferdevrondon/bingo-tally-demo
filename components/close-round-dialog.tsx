"use client"

import * as React from "react"

import { ConfirmRoundDialog } from "@/components/confirm-round-dialog"
import { HouseResultBreakdown } from "@/components/house-result-breakdown"
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
import { houseWinText } from "@/lib/round-draft/award-summary"
import { useRoundDraft } from "@/lib/round-draft/context"
import type { ClosedRoundSummary } from "@/lib/round-draft/game-api"
import { getCurrentRoundNumber } from "@/lib/round-draft/prize-rules"
import type { RoundDraftState } from "@/lib/round-draft/types"
import { formatMoney, roundOptionLabel, type Round } from "@/lib/rounds"
import { Separator } from "@base-ui/react"
import { CircleAlertIcon, GiftIcon, HouseIcon } from "lucide-react"
import { Alert, AlertTitle, } from "./ui/alert"

// Business rule F: after closing, who won, with which number and ticket
// ("Cartón N · #X"), how much, and the house result of the round.
function ClosedRoundSummaryView({
  summary,
  state,
}: {
  summary: ClosedRoundSummary
  state: RoundDraftState
}) {
  const playerName = (id: number) => state.players.find((p) => p.id === id)?.name ?? "Jugador"
  const ticketIndex = (id: number) => state.tickets.find((t) => t.id === id)?.index ?? "?"

  return (
    <div className="flex flex-col gap-4 px-6 py-4">
      {summary.winningNumbers.map((number, slot) => {
        const winners = summary.winners.filter((w) => w.slot === slot)
        return (
          <div key={slot} className="rounded-lg border bg-muted/30 p-3">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-semibold">Número ganador #{number ?? "—"}</span>
              <span className="text-muted-foreground">
                Premio {formatMoney(summary.prizes[slot] ?? 0)} por cartón
              </span>
            </div>
            {winners.length > 0 && (
              <ul className="flex flex-col gap-1 text-sm">
                {winners.map((w) => (
                  <li
                    key={`${w.ticketId}-${w.number}`}
                    className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5"
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="whitespace-nowrap">
                        {playerName(w.playerId)} · Cartón {ticketIndex(w.ticketId)} · #{w.number}
                      </span>
                      {w.isGift && (
                        <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-destructive/10 px-1.5 text-xs text-destructive">
                          <GiftIcon className="size-3" aria-hidden="true" />
                          regalo
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 font-medium whitespace-nowrap tabular-nums">
                      {w.isGift ? (
                        <>
                          <span className="font-normal text-muted-foreground">
                            {formatMoney(summary.prizes[slot] ?? 0)} −{" "}
                            {formatMoney((summary.prizes[slot] ?? 0) - w.prize)} =
                          </span>{" "}
                          {formatMoney(w.prize)}
                        </>
                      ) : (
                        formatMoney(w.prize)
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {(() => {
              // Every ticket has each number once: the ones without a winner
              // had it free, and the house wins there (unsoldWinning).
              const tickets = state.tickets.length - winners.length
              if (number === null || tickets <= 0) return null
              return (
                <p className="mt-1 flex items-center gap-1.5 text-sm font-medium">
                  <HouseIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                  {houseWinText({ tickets })}
                </p>
              )
            })()}
          </div>
        )
      })}
      <div className="rounded-lg border bg-muted/30 p-3">
        <div className="mb-2 text-xs font-bold tracking-wide text-foreground uppercase">
          Resultado de la casa en la ronda
        </div>
        <HouseResultBreakdown house={summary.house} numbers={summary.numbers} />
      </div>
    </div>
  )
}

export function CloseRoundDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { state, roundTemplates, closeRound } = useRoundDraft()
  const nextRoundNumber = getCurrentRoundNumber(state.roundsPlayed) + 1
  // Any active round template can follow, the current one included.
  const nextRounds = roundTemplates
  const [selectedRoundId, setSelectedRoundId] = React.useState("")
  const [summary, setSummary] = React.useState<ClosedRoundSummary | null>(null)
  const [confirmRound, setConfirmRound] = React.useState<Round | null>(null)

  function handleSelect() {
    const round = nextRounds.find((r) => String(r.id) === selectedRoundId)
    if (round) setConfirmRound(round)
  }

  async function handleConfirm(round: Round) {
    const closed = await closeRound(round.id)
    setConfirmRound(null)
    if (!closed.ok) return
    fireConfetti()
    setSelectedRoundId("")
    // The round is closed either way; without its summary, just close.
    if (closed.summary) setSummary(closed.summary)
    else onOpenChange(false)
  }

  function handleSummaryDone() {
    setSummary(null)
    onOpenChange(false)
  }

  if (summary) {
    return (
      <Dialog open={open} onOpenChange={(next) => !next && handleSummaryDone()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-xl">
              Resumen de la ronda {summary.seq} · {summary.name}
            </DialogTitle>
            <DialogDescription>
              La ronda {summary.seq + 1} ya empezó: cada jugador decide si mantiene o
              libera su jugada.
            </DialogDescription>
          </DialogHeader>
          <ClosedRoundSummaryView summary={summary} state={state} />
          <DialogFooter>
            <Button onClick={handleSummaryDone}>Continuar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
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
        <Separator />
        <div className="grid grid-cols-1 px-6 py-4 gap-4">
          {/* <div className="px-6">
            <span className="mb-2 text-black">
              {" "}
              Selecciona la siguiente ronda:{" "}
            </span>
          </div> */}
          <div className="">
            {nextRounds.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay rondas configuradas. Agrega una ronda en Rondas.
              </p>
            ) : (
              <>
               <div className="px-4 mb-3">
            <span className="mb-2 font-extrabold">
              {" "}
              Selecciona la siguiente ronda: Ronda {nextRoundNumber}
            </span>
          </div>
                <Select
                  value={selectedRoundId}
                  onValueChange={(value) => setSelectedRoundId(value ?? "")}
                  items={nextRounds.map((r) => ({
                    label: roundOptionLabel(r),
                    value: String(r.id),
                  }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecciona una ronda" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {nextRounds.map((r) => (
                        <SelectItem key={r.id} value={String(r.id)}>
                          {roundOptionLabel(r)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </>
            )}
          </div>
          <Alert className="border-none bg-warning/10 p-2 text-warning">
            <CircleAlertIcon />
            <AlertTitle>Cada jugador decidirá si mantiene o libera su jugada</AlertTitle>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={!selectedRoundId} onClick={handleSelect}>
            Confirmar
          </Button>
        </DialogFooter>
        <ConfirmRoundDialog
          round={confirmRound}
          onOpenChange={(next) => !next && setConfirmRound(null)}
          description="Se cierra la ronda actual y empieza esta."
          onConfirm={handleConfirm}
        />
      </DialogContent>
    </Dialog>
  )
}
