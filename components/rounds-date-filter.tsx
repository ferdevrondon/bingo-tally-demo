"use client"

import * as React from "react"
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

const WEEKDAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"]
const MONTH_FORMATTER = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" })

export function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function startOfDay(date: Date) {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

export function addDays(date: Date, delta: number) {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + delta)
  return copy
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function formatFilterDateLabel(date: Date) {
  const formatted = date.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

function MonthCalendar({
  selected,
  onSelect,
}: {
  selected: Date
  onSelect: (date: Date) => void
}) {
  const today = startOfDay(new Date())
  const [viewMonth, setViewMonth] = React.useState(() => startOfMonth(selected))

  const isCurrentMonth = isSameDay(startOfMonth(today), viewMonth)
  const firstWeekday = (viewMonth.getDay() + 6) % 7
  const daysInMonth = new Date(
    viewMonth.getFullYear(),
    viewMonth.getMonth() + 1,
    0
  ).getDate()
  const cells: (Date | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from(
      { length: daysInMonth },
      (_, i) => new Date(viewMonth.getFullYear(), viewMonth.getMonth(), i + 1)
    ),
  ]

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() =>
            setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))
          }
          aria-label="Mes anterior"
        >
          <ChevronLeftIcon />
        </Button>
        <span className="text-sm font-medium capitalize">
          {MONTH_FORMATTER.format(viewMonth)}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() =>
            setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))
          }
          disabled={isCurrentMonth}
          aria-label="Mes siguiente"
        >
          <ChevronRightIcon />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="py-1 font-medium">
            {label}
          </div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const isFuture = day > today
          const isSelected = isSameDay(day, selected)
          const isToday = isSameDay(day, today)
          return (
            <button
              key={i}
              type="button"
              disabled={isFuture}
              onClick={() => onSelect(day)}
              className={cn(
                "flex size-8 items-center justify-center rounded-full text-sm transition-colors",
                isSelected
                  ? "bg-primary font-semibold text-primary-foreground"
                  : isToday
                    ? "border border-primary/50 text-primary"
                    : "hover:bg-muted",
                isFuture && "cursor-not-allowed opacity-30 hover:bg-transparent"
              )}
            >
              {day.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function RoundsDateFilter({
  date,
  onDateChange,
}: {
  date: Date
  onDateChange: (date: Date) => void
}) {
  const [isCalendarOpen, setIsCalendarOpen] = React.useState(false)
  const today = startOfDay(new Date())
  const canGoForward = date < today

  return (
    <div className="flex w-fit items-center gap-1 self-end">
      <Button
        variant="ghost"
        size="icon-sm"
        className="rounded-full"
        onClick={() => onDateChange(addDays(date, -1))}
        aria-label="Día anterior"
      >
        <ChevronLeftIcon />
      </Button>

      <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
        <PopoverTrigger
          render={
            <Button   variant="link" size="sm" className="gap-1.5 no-underline hover:underline text-black" />
          }
        >
          <CalendarIcon className="size-4" />
          {formatFilterDateLabel(date)}
        </PopoverTrigger>
        <PopoverContent align="center" className="w-auto">
          <MonthCalendar
            selected={date}
            onSelect={(selectedDate) => {
              onDateChange(selectedDate)
              setIsCalendarOpen(false)
            }}
          />
        </PopoverContent>
      </Popover>

      <Button
        variant="ghost"
        size="icon-sm"
        className="rounded-full"
        onClick={() => onDateChange(addDays(date, 1))}
        disabled={!canGoForward}
        aria-label="Día siguiente"
      >
        <ChevronRightIcon />
      </Button>
    </div>
  )
}
