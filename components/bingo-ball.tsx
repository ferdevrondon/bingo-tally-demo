import { GiftIcon, TrophyIcon } from "lucide-react"

import { formatMoney } from "@/lib/rounds"
import { cn } from "@/lib/utils"

export function BingoBall({
  number,
  amount,
  variant,
  isGift = false,
  isWinner = false,
}: {
  number: number
  amount: number
  variant: "pending" | "taken"
  isGift?: boolean
  /** A winning number of the open round: a trophy and a gold ring. */
  isWinner?: boolean
}) {
  return (
    <div className="relative">
      <span
        className={cn(
          "absolute -top-3.5 left-1/2 z-20 -translate-x-1/2 rounded-full border bg-white px-2 py-0.5 text-sm font-bold whitespace-nowrap shadow-sm",
          variant === "pending" ? "border-amber-500/50 text-amber-700" : "border-ball/50 text-ball"
        )}
      >
        {formatMoney(amount)}
      </span>
      <div
        className={cn(
          "relative flex size-14 items-center justify-center overflow-hidden rounded-full border-2 shadow-inner",
          isWinner && "ring-2 ring-amber-400 ring-offset-2 ring-offset-card",
          variant === "pending"
            ? "border-amber-500/50 bg-gradient-to-br from-amber-300 to-amber-600"
            : "border-ball/60 bg-gradient-to-br from-ball/70 to-ball"
        )}
      >
        <span className="pointer-events-none absolute -top-1.5 -left-1.5 size-6 rounded-full bg-white/70 blur-sm" />
        <div
          className={cn(
            "relative z-10 flex size-10 items-center justify-center rounded-full bg-white text-lg font-bold shadow-sm",
            variant === "pending" ? "text-amber-700" : "text-ball"
          )}
        >
          {number}
        </div>
      </div>
      {isWinner && (
        <div
          title="Número ganador"
          className="absolute -top-1 -left-1.5 z-30 flex size-6 items-center justify-center rounded-full border border-amber-600/60 bg-gradient-to-br from-yellow-300 to-amber-500 shadow-sm"
        >
          <TrophyIcon className="size-3.5 text-amber-900" strokeWidth={2.5} />
        </div>
      )}
      {isGift && (
        <div
          title="Número regalado"
          className="absolute -bottom-1 -right-1 z-20 flex size-5 items-center justify-center rounded-full border border-red-600/60 bg-gradient-to-br from-yellow-400 to-amber-500 shadow-sm"
        >
          <GiftIcon className="size-3 text-red-700" strokeWidth={2.5} />
        </div>
      )}
    </div>
  )
}
