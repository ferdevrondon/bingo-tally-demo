"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatMoney } from "@/lib/rounds"
import { cn } from "@/lib/utils"

// Shared pieces of the balance dialog (components/player-balance-dialog.tsx):
// the side rail (who, how much, the menu), and what the panels are made of:
// a big centered amount, quiet quick-amount chips, labeled selectors, notes
// and a before → after summary.

/** "Saldo a favor" / "Debe" / "Saldo en cero": the player's balance as a card
 *  tinted by its sign (success: positive, danger: they owe, neutral: zero). */
export function BalanceCard({
  balance,
  className,
}: {
  balance: number
  className?: string
}) {
  const label =
    balance > 0 ? "Saldo a favor" : balance < 0 ? "Debe" : "Saldo en cero"
  return (
    <div
      className={cn(
        "rounded-xl px-3 py-2 text-right sm:p-4 sm:text-left",
        balance > 0 && "bg-success/10 text-success",
        balance < 0 && "bg-destructive/10 text-destructive",
        balance === 0 && "bg-muted text-muted-foreground",
        className
      )}
    >
      <div className="text-[11px] font-medium sm:text-xs">{label}</div>
      <div className="text-xl font-medium tracking-tight tabular-nums sm:mt-1 sm:text-3xl">
        {formatMoney(Math.abs(balance))}
      </div>
    </div>
  )
}

/** Left rail of the dialog: avatar and name, the balance card, the menu
 *  (`children`) and a small note at the bottom. On narrow screens it is a
 *  block on top: identity and balance in one row, the menu under it. */
export function BalanceRail({
  name,
  balance,
  note,
  children,
}: {
  name: string
  balance: number
  note?: string
  children: React.ReactNode
}) {
  return (
    <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto border-b p-4 sm:gap-4 sm:border-r sm:border-b-0 sm:p-5">
      <div className="flex items-center justify-between gap-3 pr-9 sm:flex-col sm:items-stretch sm:justify-start sm:pr-0">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
            {name.charAt(0).toUpperCase()}
          </span>
          <span className="truncate text-[13px] font-medium uppercase">
            {name}
          </span>
        </div>
        <BalanceCard balance={balance} />
      </div>
      {children}
      {note ? (
        <p className="text-[11px] text-muted-foreground sm:mt-auto">{note}</p>
      ) : null}
    </aside>
  )
}

/** Body of a panel: its fields, stacked. */
export function PanelBody({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-0 flex-col gap-4">{children}</div>
}

/** Large centered amount: muted until the user types. */
export function AmountField({
  label,
  value,
  onChange,
  step,
  inputMode = "decimal",
  disabled,
  autoFocus,
  hint,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  step?: number
  inputMode?: "decimal" | "numeric"
  disabled?: boolean
  autoFocus?: boolean
  hint?: React.ReactNode
}) {
  return (
    <label className="flex flex-col items-center gap-1 py-2 has-disabled:opacity-60">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="flex items-baseline justify-center gap-1">
        <span className="text-[40px] leading-tight font-medium text-muted-foreground">
          $
        </span>
        <input
          type="number"
          inputMode={inputMode}
          min={0}
          step={step}
          placeholder="0"
          aria-label={label}
          disabled={disabled}
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "[field-sizing:content] min-w-[2ch] appearance-none border-none bg-transparent text-center text-[40px] leading-tight font-medium tabular-nums outline-none placeholder:text-muted-foreground [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
            value === "" ? "text-muted-foreground" : "text-foreground"
          )}
        />
      </span>
      {hint ? (
        <span className="text-xs text-muted-foreground">{hint}</span>
      ) : null}
    </label>
  )
}

/** Quiet outline chips that fill the amount, centered. */
export function QuickAmounts({
  options,
  current,
  onPick,
}: {
  options: { label: string; amount: number }[]
  /** The parsed amount in the field, to mark the matching chip. */
  current: number
  onPick: (amount: number) => void
}) {
  if (options.length === 0) return null
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {options.map((option) => (
        <Button
          key={option.label}
          type="button"
          size="sm"
          variant={current === option.amount ? "default" : "outline"}
          aria-pressed={current === option.amount}
          className={cn(
            "rounded-full px-3.5",
            current === option.amount ? "font-medium" : "font-normal"
          )}
          onClick={() => onPick(option.amount)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  )
}

/** Class for the white, rounded selectors (with their chevron). */
export const SELECTOR_CLASS =
  "h-10 rounded-full border-input bg-background px-4 dark:bg-background dark:hover:bg-background"

/** A label over a control (selector, combobox) that fills its width. */
export function SelectField({
  label,
  htmlFor,
  children,
  className,
}: {
  label: string
  htmlFor?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="text-[11px] font-medium text-muted-foreground"
      >
        {label}
      </label>
      {children}
    </div>
  )
}

/** "Notas (opcional)": a single line. */
export function NotesField({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  return (
    <SelectField label="Notas (opcional)" htmlFor={id}>
      <Input
        id={id}
        value={value}
        maxLength={200}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ej. referencia"
      />
    </SelectField>
  )
}

/** A short line under the fields: what is missing, or a warning. */
export function FormMessage({
  tone = "default",
  children,
}: {
  tone?: "default" | "destructive"
  children: React.ReactNode
}) {
  return (
    <p
      className={cn(
        "text-center text-xs",
        tone === "destructive" ? "text-destructive" : "text-muted-foreground"
      )}
    >
      {children}
    </p>
  )
}

/** Before → after summary: rows and an optional bold final line. */
export function SummaryRows({
  rows,
  total,
  tone = "default",
}: {
  rows: { label: string; value: React.ReactNode }[]
  total?: { label: string; value: React.ReactNode }
  tone?: "default" | "destructive"
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 rounded-xl bg-muted/50 px-4 py-3 text-[13px]",
        tone === "destructive" && "text-destructive"
      )}
    >
      {rows.map((row) => (
        <div
          key={row.label}
          className="flex items-baseline justify-between gap-3"
        >
          <span className="text-muted-foreground">{row.label}</span>
          <span className="tabular-nums">{row.value}</span>
        </div>
      ))}
      {total ? (
        <div className="mt-0.5 flex items-baseline justify-between gap-3 border-t pt-2 font-medium">
          <span>{total.label}</span>
          <span className="tabular-nums">{total.value}</span>
        </div>
      ) : null}
    </div>
  )
}
