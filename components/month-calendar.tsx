import type * as React from "react"

import Link from "next/link"

import { signTone } from "@/components/report-cards"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { monthGrid, monthHighlights } from "@/lib/game-report/calendar"
import type { PeriodDay, PeriodReport } from "@/lib/game-report/types"
import { signedMoney } from "@/lib/round-draft/balance"
import { cn } from "@/lib/utils"

const WEEKDAYS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"]

function jornadas(count: number) {
  return count === 1 ? "1 jornada" : `${count} jornadas`
}

function Highlight({
  label,
  day,
  value,
}: {
  label: string
  day: string
  value: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-semibold">
        {day} · {value}
      </dd>
    </div>
  )
}

function joinDays(days: PeriodDay[]) {
  const labels = days.map((d) => d.label)
  return labels.length <= 1
    ? labels.join("")
    : `${labels.slice(0, -1).join(", ")} y ${labels.at(-1)}`
}

// Reportes → Mensual: the month day by day. Each day with games opens its Diario.
export function MonthCalendar({
  report,
  today,
}: {
  report: PeriodReport
  today: string
}) {
  const { leading, cells } = monthGrid(report.days, report.gameSessions, today)
  const highlights = monthHighlights(report.days, today)

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <CardTitle>Día por día</CardTitle>
          <CardDescription>
            Resultado de la casa de cada día. Abre un día para ver su reporte
            diario.
          </CardDescription>
        </div>
        <div
          className="flex items-center gap-3.5 text-xs text-muted-foreground"
          aria-hidden="true"
        >
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px] bg-success/40" />
            Ganó
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px] bg-destructive/45" />
            Perdió
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px] ring-2 ring-primary ring-inset" />
            Hoy
          </span>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="overflow-x-auto">
          <div className="grid min-w-[540px] grid-cols-7 gap-1.5">
            {WEEKDAYS.map((w) => (
              <span
                key={w}
                className="px-1 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase"
              >
                {w}
              </span>
            ))}
            {Array.from({ length: leading }, (_, i) => (
              <div key={`blank-${i}`} aria-hidden="true" />
            ))}
            {cells.map((cell) => {
              const ring = cell.isToday && "ring-2 ring-primary ring-inset"
              if (cell.day.gameSessions === 0) {
                return (
                  <div
                    key={cell.day.day}
                    className={cn(
                      "h-24 rounded-lg px-2.5 py-2 text-[13px] font-medium tabular-nums",
                      cell.isFuture
                        ? "text-muted-foreground/50"
                        : "bg-muted/60 text-muted-foreground",
                      ring
                    )}
                  >
                    {cell.date}
                  </div>
                )
              }
              const tone =
                cell.day.houseTotal < 0
                  ? "var(--destructive)"
                  : "var(--success)"
              return (
                <Link
                  key={cell.day.day}
                  href={`/reports/daily?date=${cell.day.day}`}
                  aria-label={`${cell.day.label}: ${signedMoney(cell.day.houseTotal)}, ${jornadas(cell.day.gameSessions)}${cell.sessions.some((s) => s.active) ? ", en curso" : ""}`}
                  className={cn(
                    "flex h-24 flex-col justify-between rounded-lg px-2.5 py-2 outline-none hover:ring-2 hover:ring-ring hover:ring-inset focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-inset",
                    ring
                  )}
                  style={{
                    background: `color-mix(in oklch, ${tone} ${Math.round(14 + cell.strength * 34)}%, var(--card))`,
                  }}
                >
                  <span className="flex items-center justify-between gap-1">
                    <span className="text-[13px] font-bold tabular-nums">
                      {cell.date}
                    </span>
                    {cell.sessions.some((s) => s.active) && (
                      <span
                        className="size-2 rounded-full bg-success"
                        title="Jornada en curso"
                      />
                    )}
                  </span>
                  <span className="text-[17px] font-bold tracking-tight tabular-nums">
                    {signedMoney(cell.day.houseTotal)}
                  </span>
                  <span className="truncate text-[11px] text-muted-foreground tabular-nums">
                    {cell.sessions.map((s) => `#${s.number}`).join(" · ")}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
        {highlights.daysPlayed > 0 && (
          <dl className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3 border-t pt-4 text-sm">
            {highlights.worst && (
              <Highlight
                label={highlights.best ? "Peor día" : "Único día con juego"}
                day={highlights.worst.label}
                value={
                  <span
                    className={cn(
                      "tabular-nums",
                      signTone(highlights.worst.houseTotal)
                    )}
                  >
                    {signedMoney(highlights.worst.houseTotal)}
                  </span>
                }
              />
            )}
            {highlights.best && (
              <Highlight
                label="Mejor día"
                day={highlights.best.label}
                value={
                  <span
                    className={cn(
                      "tabular-nums",
                      signTone(highlights.best.houseTotal)
                    )}
                  >
                    {signedMoney(highlights.best.houseTotal)}
                  </span>
                }
              />
            )}
            {highlights.busiest.length > 0 && (
              <Highlight
                label="Día con más jornadas"
                day={joinDays(highlights.busiest)}
                value={
                  <span className="tabular-nums">
                    {highlights.busiest[0].gameSessions}
                  </span>
                }
              />
            )}
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">Días con juego</dt>
              <dd className="font-semibold tabular-nums">
                {highlights.daysPlayed} de {highlights.daysElapsed}
              </dd>
            </div>
          </dl>
        )}
      </CardContent>
    </Card>
  )
}
