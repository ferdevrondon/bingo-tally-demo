"use client"

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { isPaymentMethod, PAYMENT_METHOD_OPTIONS, type PaymentMethod } from "@/lib/payment-methods"
import { cn } from "@/lib/utils"

export function PaymentMethodSelect({
  id,
  value,
  onChange,
  className,
}: {
  id?: string
  value: PaymentMethod | null
  onChange: (value: PaymentMethod | null) => void
  className?: string
}) {
  return (
    <Select
      value={value ?? ""}
      onValueChange={(next) => onChange(isPaymentMethod(next) ? next : null)}
      items={PAYMENT_METHOD_OPTIONS}
    >
      <SelectTrigger id={id} className={cn("w-full", className)}>
        <SelectValue placeholder="Método de pago" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {PAYMENT_METHOD_OPTIONS.map((method) => (
            <SelectItem key={method.value} value={method.value}>
              {method.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
