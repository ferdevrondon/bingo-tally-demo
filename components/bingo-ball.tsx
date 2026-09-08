import { cn } from "@/lib/utils"

export function BingoBall({
  number,
  amount,
  variant,
}: {
  number: number
  amount: number
  variant: "pending" | "taken"
}) {
  return (
    <div className="relative">
      <span
        className={cn(
          "absolute -top-2.5 left-1/2 z-20 -translate-x-1/2 rounded-full border bg-white px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap shadow-sm",
          variant === "pending" ? "border-amber-500/50 text-amber-700" : "border-primary/50 text-primary"
        )}
      >
        ${amount}
      </span>
      <div
        className={cn(
          "relative flex size-12 items-center justify-center overflow-hidden rounded-full border-2 shadow-inner",
          variant === "pending"
            ? "border-amber-500/50 bg-gradient-to-br from-amber-300 to-amber-600"
            : "border-primary/60 bg-gradient-to-br from-primary/70 to-primary"
        )}
      >
        <span className="pointer-events-none absolute -top-1.5 -left-1.5 size-6 rounded-full bg-white/70 blur-sm" />
        <div
          className={cn(
            "relative z-10 flex size-8 items-center justify-center rounded-full bg-white text-base font-bold shadow-sm",
            variant === "pending" ? "text-amber-700" : "text-primary"
          )}
        >
          {number}
        </div>
      </div>
    </div>
  )
}
