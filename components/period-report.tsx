"use client"

import type * as React from "react"
import Link from "next/link"

import {
  HouseResultWaterfall,
  KpiCard,
  signTone,
} from "@/components/report-cards"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { PeriodReport } from "@/lib/game-report/types"
import { paymentMethodLabel } from "@/lib/payment-methods"
import { signedMoney } from "@/lib/round-draft/balance"
import { getPlayerChartColorClass } from "@/lib/round-draft/colors"
import { formatMoney } from "@/lib/rounds"
import { cn } from "@/lib/utils"

function Amount({ value }: { value: number }) {
  return value === 0 ? (
    <span className="text-muted-foreground">—</span>
  ) : (
    <span className="tabular-nums">{formatMoney(value)}</span>
  )
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

function cashTotals(report: PeriodReport) {
  const sum = (pick: (l: PeriodReport["cash"][number]) => number) =>
    report.cash.reduce((total, line) => total + pick(line), 0)
  return {
    inRecharges: sum((l) => l.inGame.recharges),
    inPayouts: sum((l) => l.inGame.payouts),
    outRecharges: sum((l) => l.outside.recharges),
    outPayouts: sum((l) => l.outside.payouts),
  }
}

function CashCard({ report }: { report: PeriodReport }) {
  const totals = cashTotals(report)
  // One row per method and origin that moved money.
  const rows = report.cash.flatMap((line) =>
    (
      [
        ["inGame", "En jornada", line.inGame],
        ["outside", "Fuera", line.outside],
      ] as const
    )
      .filter(([, , moves]) => moves.recharges !== 0 || moves.payouts !== 0)
      .map(([origin, label, moves]) => ({
        key: `${line.method ?? "none"}-${origin}`,
        method: line.method ? paymentMethodLabel(line.method) : "Sin método",
        origin,
        label,
        ...moves,
      }))
  )
  return (
    <Card>
      <CardHeader>
        <CardTitle>Caja</CardTitle>
        <CardDescription>
          Recargas (entra) y pagos (sale). No es parte del resultado de la casa.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {report.cash.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hubo recargas ni pagos.
          </p>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {(
                [
                  ["Durante la jornada", totals.inRecharges, totals.inPayouts],
                  ["Fuera de jornada", totals.outRecharges, totals.outPayouts],
                ] as const
              ).map(([label, recharges, payouts]) => (
                <div
                  key={label}
                  className="flex flex-col gap-1 rounded-xl bg-muted px-3.5 py-3"
                >
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="flex flex-col">
                    <span
                      className={cn(recharges === 0 && "text-muted-foreground")}
                    >
                      Recargas{" "}
                      <span className="font-bold tabular-nums">
                        {formatMoney(recharges)}
                      </span>
                    </span>
                    <span
                      className={cn(payouts === 0 && "text-muted-foreground")}
                    >
                      Pagos{" "}
                      <span className="font-bold tabular-nums">
                        {formatMoney(payouts)}
                      </span>
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="py-1.5 text-left font-medium">Método</th>
                  <th className="px-2 py-1.5 text-left font-medium">Origen</th>
                  <th className="py-1.5 pl-2 text-right font-medium">
                    Recargas
                  </th>
                  <th className="py-1.5 pl-2 text-right font-medium">Pagos</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key} className="border-t">
                    <td className="py-2 font-medium">{row.method}</td>
                    <td className="px-2 py-2">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px]",
                          row.origin === "inGame"
                            ? "bg-primary/15"
                            : "ring-1 ring-border ring-inset"
                        )}
                      >
                        {row.label}
                      </span>
                    </td>
                    <td className="py-2 pl-2 text-right">
                      <Amount value={row.recharges} />
                    </td>
                    <td className="py-2 pl-2 text-right">
                      <Amount value={row.payouts} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 font-bold">
                  <th
                    scope="row"
                    colSpan={2}
                    className="py-2 text-left font-bold"
                  >
                    Total
                  </th>
                  <td className="py-2 pl-2 text-right tabular-nums">
                    {formatMoney(totals.inRecharges + totals.outRecharges)}
                  </td>
                  <td className="py-2 pl-2 text-right tabular-nums">
                    {formatMoney(totals.inPayouts + totals.outPayouts)}
                  </td>
                </tr>
              </tfoot>
            </table>
            <p className="text-xs text-muted-foreground">
              &quot;Fuera de jornada&quot; son los movimientos de la liquidación
              y de Jugadores.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function TopList({
  title,
  rows,
  max,
  barClassName,
  colorOf,
}: {
  title: string
  rows: PeriodReport["topPlayers"]["played"]
  max: number
  barClassName: string
  colorOf: (playerId: number) => string
}) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        {title}
      </h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">—</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {rows.map((row, i) => (
            <li key={row.playerId} className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white",
                  colorOf(row.playerId)
                )}
              >
                {initials(row.name)}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex justify-between gap-2 text-sm">
                  <span className="truncate font-medium">
                    <span className="mr-1.5 text-muted-foreground tabular-nums">
                      {i + 1}
                    </span>
                    {row.name}
                  </span>
                  <span className="font-bold tabular-nums">
                    {formatMoney(row.amount)}
                  </span>
                </div>
                <div
                  aria-hidden="true"
                  className="h-1.5 overflow-hidden rounded-full bg-muted"
                >
                  <div
                    className={cn("h-full rounded-full", barClassName)}
                    style={{ width: `${(row.amount / max) * 100}%` }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

function TopPlayersCard({ report }: { report: PeriodReport }) {
  // The same player keeps one color in both lists.
  const ids = [
    ...new Set(
      [...report.topPlayers.played, ...report.topPlayers.won].map(
        (r) => r.playerId
      )
    ),
  ]
  const colorOf = (playerId: number) =>
    getPlayerChartColorClass(ids.indexOf(playerId))
  // Both lists share one scale, so what they played and won compare.
  const max = Math.max(
    1,
    ...[...report.topPlayers.played, ...report.topPlayers.won].map(
      (r) => r.amount
    )
  )
  return (
    <Card>
      <CardHeader>
        <CardTitle>Mejores jugadores</CardTitle>
        <CardDescription>
          Lo que jugó cada uno (neto) y lo que ganó en premios.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-7">
        <TopList
          title="Más jugó"
          rows={report.topPlayers.played}
          max={max}
          barClassName="bg-primary"
          colorOf={colorOf}
        />
        <TopList
          title="Más ganó"
          rows={report.topPlayers.won}
          max={max}
          barClassName="bg-success"
          colorOf={colorOf}
        />
      </CardContent>
    </Card>
  )
}

function HouseCard({
  report,
  showSessions,
}: {
  report: PeriodReport
  showSessions: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>De dónde sale el resultado</CardTitle>
        <CardDescription>
          De las jornadas que empezaron en el periodo ·{" "}
          {report.activity.tickets}{" "}
          {report.activity.tickets === 1 ? "cartón" : "cartones"}.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <HouseResultWaterfall house={report.house} />
        {showSessions && report.gameSessions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {report.gameSessions.map((g) => (
              <Link
                key={g.id}
                href={`/reports/games/${g.id}`}
                title={g.startedAtLabel}
                className="rounded-full border px-3 py-1 text-xs font-medium hover:bg-muted"
              >
                Jornada #{g.number}
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// The body of Reportes → Diario and Mensual (Phase 6b2): house result, cash
// by payment method and origin, activity and top players of the period.
// Mensual passes its calendar, which then lists the game sessions by day.
export function PeriodReportView({
  report,
  calendar,
}: {
  report: PeriodReport
  calendar?: React.ReactNode
}) {
  const house = report.house.total
  const sessions = report.activity.gameSessions
  const empty = sessions === 0 && report.cash.length === 0
  const totals = cashTotals(report)
  const recharges = totals.inRecharges + totals.outRecharges
  const payouts = totals.inPayouts + totals.outPayouts

  if (empty) {
    return (
      <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
        No hubo movimiento en este periodo.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        <KpiCard
          label="Resultado de la casa"
          footer={
            sessions > 0 && (
              <>
                Promedio{" "}
                <span className="font-medium text-foreground tabular-nums">
                  {signedMoney(Math.round(house / sessions))}
                </span>{" "}
                por jornada
              </>
            )
          }
        >
          <span className={signTone(house)}>{signedMoney(house)}</span>
        </KpiCard>
        <KpiCard
          label="Ventas de números"
          footer={
            <>
              Premios pagados{" "}
              <span className="font-medium text-foreground tabular-nums">
                {formatMoney(report.house.prizes)}
              </span>
            </>
          }
        >
          {formatMoney(report.house.sales)}
        </KpiCard>
        <KpiCard
          label="Juego"
          footer={`${report.activity.tickets} ${report.activity.tickets === 1 ? "cartón" : "cartones"} · ${report.activity.players} ${report.activity.players === 1 ? "jugador" : "jugadores"}`}
        >
          <span className="flex items-baseline gap-5">
            <span className="flex items-baseline gap-1.5">
              {sessions}
              <span className="text-xs font-normal text-muted-foreground">
                {sessions === 1 ? "jornada" : "jornadas"}
              </span>
            </span>
            <span className="flex items-baseline gap-1.5">
              {report.activity.roundsPlayed}
              <span className="text-xs font-normal text-muted-foreground">
                {report.activity.roundsPlayed === 1 ? "ronda" : "rondas"}
              </span>
            </span>
          </span>
        </KpiCard>
        <KpiCard
          label="Caja neta"
          footer={
            <>
              Entró{" "}
              <span className="font-medium text-foreground tabular-nums">
                {formatMoney(recharges)}
              </span>{" "}
              · salió{" "}
              <span className="font-medium text-foreground tabular-nums">
                {formatMoney(payouts)}
              </span>
            </>
          }
        >
          {signedMoney(recharges - payouts)}
        </KpiCard>
      </div>

      {calendar ? (
        <>
          <div className="grid gap-4 @5xl/main:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            {calendar}
            <HouseCard report={report} showSessions={false} />
          </div>
          <div className="grid gap-4 @5xl/main:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            <TopPlayersCard report={report} />
            <CashCard report={report} />
          </div>
        </>
      ) : (
        <>
          <div className="grid gap-4 @4xl/main:grid-cols-2">
            <HouseCard report={report} showSessions />
            <TopPlayersCard report={report} />
          </div>
          <CashCard report={report} />
        </>
      )}
    </div>
  )
}
