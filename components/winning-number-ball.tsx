"use client"

import * as React from "react"
import { CheckIcon, Crown } from "lucide-react"

import { fireConfetti } from "@/lib/confetti"
import { formatMoney } from "@/lib/rounds"
import { cn } from "@/lib/utils"

export function WinningNumberBall({
  prize,
  value,
  usedNumbers,
  onSubmit,
}: {
  slotIndex: number
  /** Prize per winning ticket for this slot (the round's configured prize). */
  prize: number
  value: number | null
  usedNumbers: Set<number>
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
    fireConfetti()
  }

  const ball = (
    <div className="relative flex size-12 items-center justify-center overflow-hidden rounded-full border-2 border-green-500/50 bg-gradient-to-br from-green-300 to-green-600 shadow-inner">
      <span className="pointer-events-none absolute -top-1.5 -left-1.5 size-6 rounded-full bg-white/70 blur-sm" />
      {value !== null ? (
        <div className="relative z-10 flex size-8 items-center justify-center rounded-full bg-white text-base font-bold text-green-700 shadow-sm">
          {value}
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

  return (
    <div className="relative">
      <Crown className="absolute -top-4 left-1/2 z-30 -translate-x-1/2 size-4 fill-green-400 text-green-600" />
      <span className="absolute -top-2.5 left-1/2 z-20 -translate-x-1/2 rounded-full border border-green-500/50 bg-white px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap text-green-700 shadow-sm">
        {formatMoney(prize)}
      </span>
      {value !== null ? (
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
}
