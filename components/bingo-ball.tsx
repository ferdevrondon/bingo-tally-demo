import { GiftIcon, TrophyIcon } from "lucide-react"

import { formatMoney } from "@/lib/rounds"
import { cn } from "@/lib/utils"

export function BingoBall({
  number,
  amount,
  variant,
  isGift = false,
  plays = 1,
  giftCount = 0,
  giftDiscount = 0,
  isWinner = false,
  size = "default",
}: {
  number: number
  amount: number
  variant: "pending" | "taken"
  isGift?: boolean
  /** Tickets where the player holds the number; `amount` is for all of them. */
  plays?: number
  /** How many of those plays are gifts (valued in `amount`, not charged). */
  giftCount?: number
  /** What the gifts are worth, shown on the gift badge ("−$10"). */
  giftDiscount?: number
  /** A winning number of the open round: a trophy and a gold ring. */
  isWinner?: boolean
  /** "sm" is the compact ball of the player cards in /active-round. */
  size?: "default" | "sm"
}) {
  const sm = size === "sm"
  return (
    <div className="relative">
      <span
        className={cn(
          "absolute left-1/2 z-20 -translate-x-1/2 rounded-full border bg-white font-bold whitespace-nowrap shadow-sm",
          sm ? "-top-2.5 px-1.5 text-[9px] leading-tight" : "-top-3.5 px-2 py-0.5 text-sm",
          variant === "pending" ? "border-warning/50 text-warning-solid" : "border-ball/50 text-ball"
        )}
      >
        {formatMoney(amount)}
      </span>
      <div
        className={cn(
          "relative flex items-center justify-center overflow-hidden rounded-full border-2 shadow-inner",
          sm ? "size-8" : "size-14",
          isWinner && (sm ? "ring-2 ring-amber-400 ring-offset-1 ring-offset-card" : "ring-2 ring-amber-400 ring-offset-2 ring-offset-card"),
          variant === "pending"
            ? "border-warning/50 bg-gradient-to-br from-amber-300 to-amber-600"
            : "border-ball/60 bg-gradient-to-br from-ball/70 to-ball"
        )}
      >
        <span
          className={cn(
            "pointer-events-none absolute rounded-full bg-white/70 blur-sm",
            sm ? "-top-1 -left-1 size-4" : "-top-1.5 -left-1.5 size-6"
          )}
        />
        <div
          className={cn(
            "relative z-10 flex items-center justify-center rounded-full bg-white font-bold shadow-sm",
            sm ? "size-5 text-[11px]" : "size-10 text-lg",
            variant === "pending" ? "text-warning-solid" : "text-ball"
          )}
        >
          {number}
        </div>
      </div>
      {isWinner && (
        <div
          title="Número ganador"
          className={cn(
            "absolute z-30 flex items-center justify-center rounded-full border border-warning/60 bg-gradient-to-br from-yellow-300 to-amber-500 shadow-sm",
            sm ? "-top-1 -left-1 size-4" : "-top-1 -left-1.5 size-6"
          )}
        >
          <TrophyIcon
            className={sm ? "size-2.5 text-amber-900" : "size-3.5 text-amber-900"}
            strokeWidth={2.5}
          />
        </div>
      )}
      {isGift && (
        <div
          title={
            plays > 1 && giftCount > 0
              ? `${giftCount} de ${plays} jugadas ${giftCount === 1 ? "es regalo" : "son regalo"} (−${formatMoney(giftDiscount)})`
              : "Número regalado"
          }
          className={cn(
            "absolute -right-1 -bottom-1 z-20 flex items-center justify-center gap-0.5 rounded-full border border-destructive/60 bg-gradient-to-br from-yellow-400 to-amber-500 shadow-sm",
            sm ? "h-3.5 min-w-3.5 px-0.5" : "h-5 min-w-5 px-1"
          )}
        >
          <GiftIcon
            className={sm ? "size-2 text-destructive" : "size-3 text-destructive"}
            strokeWidth={2.5}
          />
          {giftDiscount > 0 && (
            <span
              className={cn(
                "leading-none font-bold text-destructive",
                sm ? "text-[8px]" : "text-[10px]"
              )}
            >
              −{formatMoney(giftDiscount)}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
