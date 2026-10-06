"use client"

import { Button } from "@/components/ui/button"
import { PAYMENT_METHOD_OPTIONS, type PaymentMethod } from "@/lib/payment-methods"

// Payment methods as chips: one click to choose (instead of a select).
export function PaymentMethodChips({
  value,
  onChange,
  "aria-labelledby": labelledBy,
}: {
  value: PaymentMethod | null
  onChange: (method: PaymentMethod) => void
  "aria-labelledby"?: string
}) {
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="flex flex-wrap gap-2">
      {PAYMENT_METHOD_OPTIONS.map((method) => (
        <Button
          key={method.value}
          type="button"
          role="radio"
          aria-checked={value === method.value}
          variant={value === method.value ? "default" : "outline"}
          className="rounded-full"
          onClick={() => onChange(method.value)}
        >
          {method.label}
        </Button>
      ))}
    </div>
  )
}
