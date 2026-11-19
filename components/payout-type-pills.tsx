"use client"

import { CheckIcon } from "lucide-react"
import * as React from "react"

import { cn } from "@/lib/utils"
import {
  PAYOUT_TYPE_OPTIONS,
  payoutTypeLabel,
  type PayoutType,
} from "@/lib/payout-types"

// "Tipo de pago" (ERNIE / DAIRY) of a cash move (*_payout_type.sql): compact
// teal pills, kept apart from the indigo quick amounts. The selected one is
// filled with a check; the other is dashed.
export function PayoutTypePills({
  value,
  onChange,
  label = "Tipo de pago",
}: {
  value: PayoutType
  onChange: (value: PayoutType) => void
  label?: string
}) {
  const labelId = React.useId()
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span id={labelId} className="text-[11px] font-medium text-muted-foreground">
        {label}
      </span>
      <div role="group" aria-labelledby={labelId} className="flex flex-wrap items-center gap-2">
        {PAYOUT_TYPE_OPTIONS.map((option) => {
          const selected = option.value === value
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option.value)}
              className={cn(
                "inline-flex h-7 items-center gap-1 rounded-full border px-3 text-xs font-semibold tracking-wider uppercase transition-colors outline-none focus-visible:ring-3 focus-visible:ring-payout-type/40",
                selected
                  ? "border-payout-type bg-payout-type pl-2.5 text-payout-type-foreground"
                  : "border-dashed border-payout-type/70 bg-input/30 text-foreground hover:bg-payout-type/10"
              )}
            >
              {selected && <CheckIcon className="size-3" strokeWidth={3} aria-hidden />}
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** The chosen type as a small filled chip (summary, confirmation, movements). */
export function PayoutTypeChip({
  value,
  className,
}: {
  value: PayoutType
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-full bg-payout-type px-2 text-[11px] font-semibold tracking-wide text-payout-type-foreground",
        className
      )}
    >
      {payoutTypeLabel(value)}
    </span>
  )
}
