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
  const [invalid, setInvalid] = React.useState(false)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const number = Number.parseInt(draft, 10)
    if (!Number.isInteger(number) || number < 1 || number > 15 || usedNumbers.has(number)) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    onSubmit(number)
  }

  const ball = (
    <div className="relative flex size-12 items-center justify-center overflow-hidden rounded-full border-2 border-green-500/50 bg-gradient-to-br from-green-300 to-green-600 shadow-inner">
      <span className="pointer-events-none absolute -top-1.5 -left-1.5 size-6 rounded-full bg-white/70 blur-sm" />
      {value !== null ? (
        <div className="relative z-10 flex size-8 items-center justify-center rounded-full bg-white text-base font-bold text-green-700 shadow-sm">
          {value}
        </div>
      ) : readOnly ? (
        <div className="relative z-10 flex size-8 items-center justify-center rounded-full bg-white/80 text-base font-bold text-green-700/60 shadow-sm">
          ?
        </div>
      ) : (
        <input
          type="number"
          min={1}
          max={15}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            setInvalid(false)
          }}
          aria-invalid={invalid}
          className={cn(
            "relative z-10 size-8 appearance-none rounded-full bg-white text-center text-base font-bold text-green-700 outline-none",
            "[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
            "focus-visible:ring-2 focus-visible:ring-green-500",
            invalid && "ring-2 ring-destructive"
          )}
        />
      )}
    </div>
  )

  const slot = (
    <div className="relative">
      <Crown className="absolute -top-4 left-1/2 z-30 -translate-x-1/2 size-4 fill-green-400 text-green-600" />
      <span className="absolute -top-2.5 left-1/2 z-20 -translate-x-1/2 rounded-full border border-green-500/50 bg-white px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap text-green-700 shadow-sm">
        {formatMoney(prize)}
      </span>
      {value !== null || readOnly ? (
        ball
      ) : (
        <form onSubmit={handleSubmit}>
          {ball}
          {draft !== "" && (
            <button
              type="submit"
              aria-label="Confirmar número ganador"
              className="absolute -right-1 -bottom-1 z-40 flex size-5 items-center justify-center rounded-full border border-green-600 bg-green-600 text-white shadow-sm transition-colors hover:bg-green-700"
            >
              <CheckIcon className="size-3" strokeWidth={3} />
            </button>
          )}
        </form>
      )}
    </div>
  )

  const houseWins = house !== null && house.tickets > 0
  if (value === null || (winners === null && !houseWins)) return slot
  return (
    <div className="flex items-center gap-3">
      {slot}
      <div className="flex flex-col gap-1">
        {(winners ?? []).map((w) => (
          <span
            key={w.name}
            className="inline-flex h-6 items-center gap-1.5 rounded-full border border-amber-400/60 bg-amber-100 pr-2 pl-0.5 text-xs font-semibold text-amber-950 dark:bg-amber-500/15 dark:text-amber-100"
          >
            <span className="flex size-5 items-center justify-center rounded-full bg-amber-400 text-[10px] font-bold text-amber-950">
              {w.name.charAt(0).toUpperCase()}
            </span>
            {w.name}
            <span className="text-green-700 tabular-nums dark:text-green-400">
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
            <span className="text-green-700 tabular-nums dark:text-green-400">
              +{formatMoney(house.amount)}
            </span>
          </span>
        )}
      </div>
    </div>
  )
}
