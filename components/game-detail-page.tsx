"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowLeftIcon,
  CalendarIcon,
  DicesIcon,
  PlayIcon,
  TicketIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react"

import { useHouse } from "@/components/house-provider"
import { HouseResultBreakdown } from "@/components/house-result-breakdown"
import { PlayerRoundsDialog } from "@/components/player-rounds-dialog"
import { RoundHistoryCard } from "@/components/round-history-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useNow } from "@/hooks/use-now"
import { formatDuration } from "@/lib/game-report/format"
import type { GameSessionReport, PlayerReport } from "@/lib/game-report/types"
import { paymentMethodLabel } from "@/lib/payment-methods"
import { ACTIVITY_LABELS, describeActivity } from "@/lib/round-draft/activity-text"
import { signedMoney } from "@/lib/round-draft/balance"
import { formatMoney } from "@/lib/rounds"
import { cn } from "@/lib/utils"

function StatCard({
  label,
  value,
  valueClassName,
  icon,
}: {
  label: string
  value: React.ReactNode
  valueClassName?: string
  icon: React.ReactNode
}) {
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle
          className={cn("text-2xl font-semibold tabular-nums @[250px]/card:text-3xl", valueClassName)}
        >
          {value}
        </CardTitle>
        <CardAction>
          <Badge variant="outline">{icon}</Badge>
        </CardAction>
      </CardHeader>
    </Card>
  )
}

function Money({ value, signed = false }: { value: number; signed?: boolean }) {
  if (value === 0) return <span className="text-muted-foreground">—</span>
  return (
    <span
      className={cn(
        "tabular-nums",
        signed && (value > 0 ? "text-green-600" : "text-destructive")
      )}
    >
      {signed ? signedMoney(value) : formatMoney(value)}
    </span>
  )
}

function PlayersCard({ gameSessionId, players }: { gameSessionId: number; players: PlayerReport[] }) {
  const [roundsOf, setRoundsOf] = React.useState<PlayerReport | null>(null)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Jugadores</CardTitle>
        <CardDescription>
          Entró con + premios + recargas − lo que jugó − pagos = terminó con.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {players.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nadie jugó en esta jornada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 pr-3 font-medium">Jugador</th>
                  <th className="px-3 py-2 text-right font-medium">Entró con</th>
                  <th className="px-3 py-2 text-right font-medium">Jugó</th>
                  <th className="px-3 py-2 text-right font-medium">Premios</th>
                  <th className="px-3 py-2 text-right font-medium">Recargas</th>
                  <th className="px-3 py-2 text-right font-medium">Pagos</th>
                  <th className="px-3 py-2 text-right font-medium">Terminó con</th>
                  <th className="py-2 pl-3" />
                </tr>
              </thead>
              <tbody>
                {players.map((p) => (
                  <tr key={p.id} className="border-b last:border-b-0">
                    <td className="py-2 pr-3 font-medium">
                      {p.name}
                      {p.removed && (
                        <Badge variant="outline" className="ml-2">
                          Retirado
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Money value={p.opening} signed />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Money value={p.played} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Money value={p.prizes} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Money value={p.recharges} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Money value={p.payouts} />
                    </td>
                    <td className="px-3 py-2 text-right font-semibold">
                      <Money value={p.closing} signed />
                    </td>
                    <td className="py-2 pl-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => setRoundsOf(p)}>
                        Ver rondas
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
      {roundsOf && (
        <PlayerRoundsDialog
          gameSessionId={gameSessionId}
          playerId={roundsOf.id}
          playerName={roundsOf.name}
          open
          onOpenChange={(open) => !open && setRoundsOf(null)}
        />
      )}
    </Card>
  )
}

function CashCard({ report }: { report: GameSessionReport }) {
  const recharges = report.cash.reduce((sum, c) => sum + c.recharges, 0)
  const payouts = report.cash.reduce((sum, c) => sum + c.payouts, 0)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Caja</CardTitle>
        <CardDescription>
          Dinero que entró (recargas) y salió (pagos) durante la jornada, por método de pago. No es
          parte del resultado de la casa.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {report.cash.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hubo recargas ni pagos en la jornada.</p>
        ) : (
          <dl className="flex flex-col gap-1.5 text-sm">
            {report.cash.map((c) => (
              <div key={c.method ?? "none"} className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">
                  {c.method ? paymentMethodLabel(c.method) : "Sin método"}
                </dt>
                <dd className="flex gap-4 tabular-nums">
                  <span>Recargas {formatMoney(c.recharges)}</span>
                  <span>Pagos {formatMoney(c.payouts)}</span>
                </dd>
              </div>
            ))}
            <div className="mt-1 flex items-center justify-between gap-4 border-t pt-2 font-semibold">
              <dt>Total</dt>
              <dd className="flex gap-4 tabular-nums">
                <span>Recargas {formatMoney(recharges)}</span>
                <span>Pagos {formatMoney(payouts)}</span>
              </dd>
            </div>
          </dl>
        )}
        {report.settlement && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 text-sm">
            <span>
              Liquidación:{" "}
              {report.settlement.status === "closed"
                ? "cerrada"
                : report.settlement.unresolved > 0
                  ? `abierta · ${report.settlement.unresolved} por resolver`
                  : "abierta · todo resuelto"}{" "}
              · cobrado {formatMoney(report.settlement.received)} · pagado{" "}
              {formatMoney(report.settlement.paid)}
            </span>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href={`/games/${report.id}/settlement`} />}
            >
              Ver liquidación
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function TimelineCard({ report }: { report: GameSessionReport }) {
  const timeZone = useHouse()?.timezone
  // Times are formatted on the client only, so the server HTML can't differ.
  const mounted = useNow() !== null
  const formatTime = (timestamp: number) =>
    new Intl.DateTimeFormat("es-MX", { timeStyle: "short", timeZone }).format(timestamp)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Historial</CardTitle>
        <CardDescription>Cada movimiento de la jornada, del más reciente al primero.</CardDescription>
      </CardHeader>
      <CardContent className="flex max-h-[560px] flex-col gap-3 overflow-y-auto">
        {report.activity.map((entry) => (
          <div key={entry.id} className="flex items-start gap-3 text-sm">
            <span className="w-16 shrink-0 text-xs text-muted-foreground tabular-nums">
              {mounted ? formatTime(entry.timestamp) : " "}
            </span>
            <Badge variant="outline" className="shrink-0">
              {ACTIVITY_LABELS[entry.type]}
            </Badge>
            <span>{describeActivity(entry, report.labels)}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

// /reports/games/[id]: the full report of one game session (Phase 6a), reached
// from Reportes → Jornadas. A game session in progress shows what happened so far.
export function GameDetailPage({ report }: { report: GameSessionReport | null }) {
  if (!report) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-muted-foreground">No se encontró la jornada.</p>
        <Button variant="outline" nativeButton={false} render={<Link href="/reports/games" />}>
          <ArrowLeftIcon />
          Volver a jornadas
        </Button>
      </div>
    )
  }

  const isActive = report.status === "active"
  const house = report.house.total
  const playersCount = report.players.filter((p) => !p.removed).length

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 px-4 lg:px-6">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 w-fit"
          nativeButton={false}
          render={<Link href="/reports/games" />}
        >
          <ArrowLeftIcon />
          Volver
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">Jornada #{report.number}</h1>
          {isActive ? (
            <Badge className="bg-green-500/15 text-green-700 dark:text-green-400">En curso</Badge>
          ) : (
            <Badge variant="secondary">Terminada</Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          <CalendarIcon className="size-4" aria-hidden="true" />
          <span>
            Empezó el {report.startedAtLabel}
            {report.endedAtLabel && ` · terminó el ${report.endedAtLabel}`}
            {!isActive && ` · ${formatDuration(report.durationMs)}`}
          </span>
        </div>
        {isActive && (
          <Button
            size="sm"
            className="w-fit"
            nativeButton={false}
            render={<Link href="/active-round" />}
          >
            <PlayIcon />
            Ir a la ronda activa
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 px-4 @xl/main:grid-cols-2 @4xl/main:grid-cols-4 lg:px-6">
        <StatCard label="Rondas jugadas" value={report.roundsPlayed} icon={<DicesIcon />} />
        <StatCard label="Jugadores" value={playersCount} icon={<UsersIcon />} />
        <StatCard label="Cartones" value={report.ticketsCount} icon={<TicketIcon />} />
        <StatCard
          label="Resultado de la casa"
          value={signedMoney(house)}
          valueClassName={house >= 0 ? "text-green-700 dark:text-green-400" : "text-destructive"}
          icon={
            house >= 0 ? (
              <TrendingUpIcon className="text-green-600 dark:text-green-500" />
            ) : (
              <TrendingDownIcon className="text-destructive" />
            )
          }
        />
      </div>

      <div className="grid gap-4 px-4 @4xl/main:grid-cols-2 lg:px-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <WalletIcon className="size-4" aria-hidden="true" />
              Resultado de la casa
            </CardTitle>
            <CardDescription>
              Ventas − premios + lo que la casa juega con los números regalados y sin vender.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <HouseResultBreakdown house={report.house} />
          </CardContent>
        </Card>
        <CashCard report={report} />
      </div>

      <div className="flex flex-col gap-4 px-4 lg:px-6">
        <RoundHistoryCard
          rounds={[...report.rounds].reverse()}
          emptyText="Todavía no se eligió ninguna ronda."
        />
        <PlayersCard gameSessionId={report.id} players={report.players} />
        <TimelineCard report={report} />
      </div>
    </div>
  )
}
