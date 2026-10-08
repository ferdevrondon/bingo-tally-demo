"use client"

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { BANK_OPTIONS, BANK_OPTIONS_WITH_NONE, isBank, NO_BANK, type Bank } from "@/lib/banks"
import { cn } from "@/lib/utils"

/** "Entidad bancaria (ingreso)" of a cash move; "Sin banco" is null. */
export function BankSelect({
  id,
  value,
  onChange,
  className,
}: {
  id?: string
  value: Bank | null
  onChange: (value: Bank | null) => void
  className?: string
}) {
  return (
    <Select
      value={value ?? NO_BANK}
      onValueChange={(next) => onChange(isBank(next) ? next : null)}
      items={BANK_OPTIONS_WITH_NONE}
    >
      <SelectTrigger id={id} className={cn("w-full", className)}>
        <SelectValue placeholder="Banco" />
      </SelectTrigger>
      {/* A short list so it opens downward: 16 banks don't fit below the
          trigger and the popup would flip up. */}
      <SelectContent className="max-h-48">
        <SelectGroup>
          <SelectItem value={NO_BANK}>Sin banco</SelectItem>
          {BANK_OPTIONS.map((bank) => (
            <SelectItem key={bank.value} value={bank.value}>
              {bank.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
