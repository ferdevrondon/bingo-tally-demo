"use client"

import Link from "next/link"
import { DicesIcon, TicketIcon, TrendingDownIcon, TrendingUpIcon, UsersIcon } from "lucide-react"

import { HouseResultBreakdown } from "@/components/house-result-breakdown"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { PeriodReport } from "@/lib/game-report/types"
import { paymentMethodLabel } from "@/lib/payment-methods"
import { signedMoney } from "@/lib/round-draft/balance"
import { formatMoney } from "@/lib/rounds"
import { cn } from "@/lib/utils"

function Stat({ label, value, icon, className }: {
  label: string
  value: React.ReactNode
  icon: React.ReactNode
  className?: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className={cn("text-2xl font-semibold tabular-nums", className)}>{value}</CardTitle>
        <CardAction>
          <Badge variant="outline">{icon}</Badge>
        </CardAction>
      </CardHeader>
    </Card>
  )
}

function Amount({ value }: { value: number }) {
  return value === 0 ? (
    <span className="text-muted-foreground">—</span>
  ) : (
    <span className="tabular-nums">{formatMoney(value)}</span>
  )
}

function CashCard({ report }: { report: PeriodReport }) {
  const sum = (pick: (l: PeriodReport["cash"][number]) => number) =>
    report.cash.reduce((total, line) => total + pick(line), 0)
  const totals = {
    inRecharges: sum((l) => l.inGame.recharges),
    inPayouts: sum((l) => l.inGame.payouts),
    outRecharges: sum((l) => l.outside.recharges),
    outPayouts: sum((l) => l.outside.payouts),
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Caja</CardTitle>
        <CardDescription>
          Recargas (entra) y pagos (sale) por método. &quot;Fuera de jornada&quot; son los de la
          liquidación y de Jugadores. No es parte del resultado de la casa.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {report.cash.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hubo recargas ni pagos.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th rowSpan={2} className="py-1 pr-3 text-left font-medium">
                    Método
                  </th>
                  <th colSpan={2} className="px-3 py-1 text-center font-medium">
                    Durante la jornada
                  </th>
                  <th colSpan={2} className="px-3 py-1 text-center font-medium">
                    Fuera de jornada
                  </th>
                </tr>
                <tr className="border-b">
                  <th className="px-3 py-1 text-right font-medium">Recargas</th>
                  <th className="px-3 py-1 text-right font-medium">Pagos</th>
                  <th className="px-3 py-1 text-right font-medium">Recargas</th>
                  <th className="px-3 py-1 text-right font-medium">Pagos</th>
                </tr>
              </thead>
              <tbody>
                {report.cash.map((line) => (
                  <tr key={line.method ?? "none"} className="border-b last:border-b-0">
                    <td className="py-2 pr-3">
                      {line.method ? paymentMethodLabel(line.method) : "Sin método"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Amount value={line.inGame.recharges} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Amount value={line.inGame.payouts} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Amount value={line.outside.recharges} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Amount value={line.outside.payouts} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t font-semibold">
                <tr>
                  <td className="py-2 pr-3">Total</td>
                  <td className="px-3 py-2 text-right">
                    <Amount value={totals.inRecharges} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Amount value={totals.inPayouts} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Amount value={totals.outRecharges} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Amount value={totals.outPayouts} />
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function TopList({
  title,
  rows,
}: {
  title: string
  rows: PeriodReport["topPlayers"]["played"]
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{title}</span>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">—</p>
      ) : (
        <ol className="flex flex-col gap-1 text-sm">
          {rows.map((row, i) => (
            <li key={row.playerId} className="flex items-center justify-between gap-3">
              <span>
                <span className="mr-2 text-muted-foreground tabular-nums">{i + 1}.</span>
                {row.name}
              </span>
              <span className="font-medium tabular-nums">{formatMoney(row.amount)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

// The body of Reportes → Diario and Mensual (Phase 6b2): house result, cash
// by payment method and origin, activity and top players of the period.
export function PeriodReportView({ report }: { report: PeriodReport }) {
  const house = report.house.total
  const empty = report.activity.gameSessions === 0 && report.cash.length === 0

  if (empty) {
    return (
      <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
        No hubo movimiento en este periodo.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @4xl/main:grid-cols-4">
        <Stat
          label="Resultado de la casa"
          value={signedMoney(house)}
          className={house >= 0 ? "text-green-700 dark:text-green-400" : "text-destructive"}
          icon={house >= 0 ? <TrendingUpIcon /> : <TrendingDownIcon />}
        />
        <Stat label="Jornadas" value={report.activity.gameSessions} icon={<DicesIcon />} />
        <Stat label="Rondas jugadas" value={report.activity.roundsPlayed} icon={<TicketIcon />} />
        <Stat label="Jugadores" value={report.activity.players} icon={<UsersIcon />} />
      </div>

      <div className="grid gap-4 @4xl/main:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Resultado de la casa</CardTitle>
            <CardDescription>
              De las jornadas que empezaron en el periodo · {report.activity.tickets}{" "}
              {report.activity.tickets === 1 ? "cartón" : "cartones"}.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <HouseResultBreakdown house={report.house} />
            {report.gameSessions.length > 0 && (
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
        <Card>
          <CardHeader>
            <CardTitle>Mejores jugadores</CardTitle>
            <CardDescription>Lo que jugó cada uno (neto) y lo que ganó en premios.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 sm:grid-cols-2">
            <TopList title="Más jugó" rows={report.topPlayers.played} />
            <TopList title="Más ganó" rows={report.topPlayers.won} />
          </CardContent>
        </Card>
      </div>

      <CashCard report={report} />
    </div>
  )
}
