"use client"

import * as React from "react"
import { CheckIcon, Crown, HouseIcon } from "lucide-react"

import type { HouseWin } from "@/lib/round-draft/award-summary"
import { formatMoney } from "@/lib/rounds"
import { cn } from "@/lib/utils"

export function WinningNumberBall({
  prize,
  value,
  usedNumbers,
  readOnly = false,
  winners = null,
  house = null,
  onSubmit,
}: {
  slotIndex: number
  /** Prize per winning ticket for this slot (the round's configured prize). */
  prize: number
  value: number | null
  usedNumbers: Set<number>
  /** An observer: an empty slot shows "?" instead of an input. */
  readOnly?: boolean
  /** Who has won this number so far: players with what they were paid, `[]`
   *  when nobody had it, null when unknown or not drawn yet. */
  winners?: { name: string; amount: number }[] | null
  /** What the house wins on the tickets where this number was free. */
  house?: HouseWin | null
  onSubmit: (number: number) => void
}) {
  const [draft, setDraft] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const number = Number.parseInt(draft, 10)
    if (!Number.isInteger(number) || number < 1 || number > 15) {
      setError("Usa un número del 1 al 15")
      return
    }
    if (usedNumbers.has(number)) {
      setError("Ese número ya salió")
      return
    }
    setError(null)
    onSubmit(number)
  }

  const ball = (
    <div className="relative flex size-12 items-center justify-center overflow-hidden rounded-full border-2 border-success/50 bg-gradient-to-br from-green-300 to-green-600 shadow-inner">
      <span className="pointer-events-none absolute -top-1.5 -left-1.5 size-6 rounded-full bg-white/70 blur-sm" />
      {value !== null ? (
        <div className="relative z-10 flex size-8 items-center justify-center rounded-full bg-white text-base font-bold text-success-solid shadow-sm">
          {value}
        </div>
      ) : readOnly ? (
        <div className="relative z-10 flex size-8 items-center justify-center rounded-full bg-white/80 text-base font-bold text-green-700/60 shadow-sm">
          ?
        </div>
      ) : (
        <input
          type="number"
          inputMode="numeric"
          enterKeyHint="done"
          min={1}
          max={15}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            setError(null)
          }}
          onFocus={(e) => e.target.select()}
          aria-label={`Número ganador del premio de ${formatMoney(prize)}`}
          aria-invalid={error !== null}
          className={cn(
            "relative z-10 size-8 appearance-none rounded-full bg-white text-center text-base font-bold text-success-solid outline-none",
            "[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
            "focus-visible:ring-2 focus-visible:ring-green-500",
            error !== null && "ring-2 ring-destructive"
          )}
        />
      )}
    </div>
  )

  const ballWithPrize = (
    <div className="relative shrink-0">
      <Crown className="absolute -top-4 left-1/2 z-30 size-4 -translate-x-1/2 fill-green-400 text-success" />
      <span className="absolute -top-2.5 left-1/2 z-20 -translate-x-1/2 rounded-full border border-success/50 bg-white px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap text-success-solid shadow-sm">
        {formatMoney(prize)}
      </span>
      {ball}
    </div>
  )

  // An empty slot is a form: the ball takes the number and a small "Confirmar"
  // pill on the ball's lower edge sends it (Enter does the same). The pill and
  // the error float, so an empty slot is as tall as a filled one and the balls
  // of a row line up.
  const slot =
    value !== null || readOnly ? (
      ballWithPrize
    ) : (
      <form onSubmit={handleSubmit} className="relative mb-3 shrink-0">
        {ballWithPrize}
        {draft !== "" && (
          <button
            type="submit"
            className="absolute top-full left-1/2 z-40 -mt-1.5 inline-flex h-6 -translate-x-1/2 items-center gap-1 rounded-full border border-success/40 bg-white px-2 text-xs font-semibold whitespace-nowrap text-success-solid shadow-sm transition-colors outline-none after:absolute after:-inset-x-2 after:-inset-y-2 hover:bg-success-solid hover:text-white focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <CheckIcon className="size-3" strokeWidth={3} aria-hidden="true" />
            Confirmar
          </button>
        )}
        {error && (
          <p
            role="alert"
            className="absolute top-full left-1/2 z-40 mt-5 w-max max-w-28 -translate-x-1/2 rounded-md bg-background/90 px-1 text-center text-xs font-medium text-destructive"
          >
            {error}
          </p>
        )}
      </form>
    )

  const houseWins = house !== null && house.tickets > 0
  if (value === null || (winners === null && !houseWins)) return slot
  return (
    <div className="flex items-start gap-3">
      {slot}
      <div className="flex min-h-12 min-w-0 flex-col justify-center gap-1">
        {(winners ?? []).map((w) => (
          <span
            key={w.name}
            className="inline-flex h-6 items-center gap-1.5 rounded-full border border-warning/60 bg-amber-100 pr-2 pl-0.5 text-xs font-semibold text-amber-950 dark:bg-warning/15 dark:text-amber-100"
          >
            <span className="flex size-5 items-center justify-center rounded-full bg-amber-400 text-[10px] font-bold text-amber-950">
              {w.name.charAt(0).toUpperCase()}
            </span>
            {w.name}
            <span className="text-success tabular-nums">
              +{formatMoney(w.amount)}
            </span>
          </span>
        ))}
        {houseWins && (
          <span
            title={`${house.tickets} cartón${house.tickets === 1 ? "" : "es"} libre${house.tickets === 1 ? "" : "s"} con el ${value}`}
            className="inline-flex h-6 items-center gap-1.5 rounded-full border bg-muted pr-2 pl-0.5 text-xs font-semibold"
          >
            <span className="flex size-5 items-center justify-center rounded-full bg-foreground/10">
              <HouseIcon className="size-3" aria-hidden="true" />
            </span>
            CASA
            <span className="text-success tabular-nums">
              +{formatMoney(house.amount)}
            </span>
          </span>
        )}
      </div>
    </div>
  )
}
