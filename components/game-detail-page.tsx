"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CalendarIcon,
  ClockIcon,
  PlayIcon,
  WalletIcon,
} from "lucide-react"

import { GameTimelineCard } from "@/components/game-timeline-card"
import { NumbersInfoList } from "@/components/house-result-breakdown"
import { PlayerRoundsDialog } from "@/components/player-rounds-dialog"
import {
  HouseResultWaterfall,
  KpiCard,
  signTone,
} from "@/components/report-cards"
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
import { formatDuration } from "@/lib/game-report/format"
import { sumNumbers } from "@/lib/game-report/round-counts"
import type { GameSessionReport, PlayerReport } from "@/lib/game-report/types"
import { paymentMethodLabel } from "@/lib/payment-methods"
import { signedMoney } from "@/lib/round-draft/balance"
import { getPlayerChartColorClass } from "@/lib/round-draft/colors"
import { formatMoney } from "@/lib/rounds"
import { cn } from "@/lib/utils"

function Money({ value, signed = false }: { value: number; signed?: boolean }) {
  if (value === 0) return <span className="text-muted-foreground">—</span>
  return (
    <span className={cn("tabular-nums", signed && signTone(value))}>
      {signed ? signedMoney(value) : formatMoney(value)}
    </span>
  )
}

function HouseCard({ report }: { report: GameSessionReport }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <WalletIcon className="size-4" aria-hidden="true" />
          De dónde sale el resultado
        </CardTitle>
        <CardDescription>
          Ventas − premios pagados. Los números regalados y los que se quedó la
          casa se muestran con su valor, pero no suman ni restan.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <NumbersInfoList
          numbers={{ ...sumNumbers(report.rounds), tickets: report.ticketsCount }}
          className="mb-3"
        />
        <HouseResultWaterfall house={report.house} />
      </CardContent>
    </Card>
  )
}

function SettlementCard({ report }: { report: GameSessionReport }) {
  const settlement = report.settlement
  if (!settlement) return null
  const resolved = settlement.total - settlement.unresolved
  const closed = settlement.status === "closed"
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Liquidación</CardTitle>
        <CardAction>
          {closed ? (
            <Badge variant="secondary">Cerrada</Badge>
          ) : (
            <Badge className="bg-warning/15 text-warning-solid dark:text-warning">
              Abierta
            </Badge>
          )}
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {settlement.total > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-sm">
              <span>
                <span className="font-semibold tabular-nums">{resolved}</span>{" "}
                de <span className="tabular-nums">{settlement.total}</span>{" "}
                resueltos
              </span>
              {settlement.unresolved > 0 && (
                <span className="text-muted-foreground">
                  <span className="tabular-nums">{settlement.unresolved}</span>{" "}
                  por resolver
                </span>
              )}
            </div>
            <div
              role="progressbar"
              aria-label="Jugadores resueltos"
              aria-valuemin={0}
              aria-valuemax={settlement.total}
              aria-valuenow={resolved}
              className="h-2 overflow-hidden rounded-full bg-muted"
            >
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${(resolved / settlement.total) * 100}%` }}
              />
            </div>
          </div>
        )}
        <dl className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-0.5 rounded-xl bg-muted px-3.5 py-3">
            <dt className="text-xs text-muted-foreground">Cobrado</dt>
            <dd className="text-lg font-semibold tabular-nums">
              {formatMoney(settlement.received)}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5 rounded-xl bg-muted px-3.5 py-3">
            <dt className="text-xs text-muted-foreground">Pagado</dt>
            <dd className="text-lg font-semibold tabular-nums">
              {formatMoney(settlement.paid)}
            </dd>
          </div>
        </dl>
        <Button
          variant={closed ? "outline" : "default"}
          nativeButton={false}
          render={<Link href={`/games/${report.id}/settlement`} />}
        >
          Ver liquidación
        </Button>
      </CardContent>
    </Card>
  )
}

function CashCard({ report }: { report: GameSessionReport }) {
  const recharges = report.cash.reduce((sum, c) => sum + c.recharges, 0)
  const payouts = report.cash.reduce((sum, c) => sum + c.payouts, 0)
  return (
    <Card size="sm" className="flex-1">
      <CardHeader>
        <CardTitle>Caja</CardTitle>
        <CardDescription>
          Recargas y pagos por método de pago. No es parte del resultado de la
          casa.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {report.cash.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl border border-dashed p-3.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <WalletIcon className="size-4" aria-hidden="true" />
            </span>
            <div className="flex flex-col">
              <span className="text-sm font-medium">
                Sin movimientos de caja
              </span>
              <span className="text-xs text-muted-foreground">
                No hubo recargas ni pagos en la jornada.
              </span>
            </div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="py-1 text-left font-medium">Método</th>
                <th className="py-1 text-right font-medium">Recargas</th>
                <th className="py-1 text-right font-medium">Pagos</th>
              </tr>
            </thead>
            <tbody>
              {report.cash.map((c) => (
                <tr key={c.method ?? "none"} className="border-t">
                  <td className="py-1.5 text-muted-foreground">
                    {c.method ? paymentMethodLabel(c.method) : "Sin método"}
                  </td>
                  <td className="py-1.5 text-right">
                    <Money value={c.recharges} />
                  </td>
                  <td className="py-1.5 text-right">
                    <Money value={c.payouts} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t font-semibold">
                <th scope="row" className="py-1.5 text-left font-semibold">
                  Total
                </th>
                <td className="py-1.5 text-right tabular-nums">
                  {formatMoney(recharges)}
                </td>
                <td className="py-1.5 text-right tabular-nums">
                  {formatMoney(payouts)}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </CardContent>
    </Card>
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

function PlayersCard({
  gameSessionId,
  players,
}: {
  gameSessionId: number
  players: PlayerReport[]
}) {
  const [roundsOf, setRoundsOf] = React.useState<PlayerReport | null>(null)
  // Colors follow the order players joined, like in the live game.
  const colorOf = new Map(players.map((p, i) => [p.id, getPlayerChartColorClass(i)]))
  const sorted = [...players].sort((a, b) => b.closing - a.closing)
  const maxAbs = Math.max(1, ...players.map((p) => Math.abs(p.closing)))
  const owed = players.filter((p) => p.closing > 0)
  const owing = players.filter((p) => p.closing < 0)
  const sum = (
    list: PlayerReport[],
    key: keyof Pick<
      PlayerReport,
      "opening" | "played" | "prizes" | "recharges" | "payouts" | "closing"
    >
  ) => list.reduce((total, p) => total + p[key], 0)

  return (
    <Card className="pb-0">
      <CardHeader className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <CardTitle>Jugadores</CardTitle>
          <CardDescription>
            Entró con + premios + recargas − lo que jugó − pagos = terminó con.
          </CardDescription>
        </div>
        {players.length > 0 && (
          <div className="flex flex-wrap gap-2 text-xs font-medium">
            {owed.length > 0 && (
              <span className="rounded-full bg-success/10 px-3 py-1 text-success">
                La casa debe{" "}
                <span className="font-bold tabular-nums">
                  {formatMoney(sum(owed, "closing"))}
                </span>{" "}
                a {owed.length}
              </span>
            )}
            {owing.length > 0 && (
              <span className="rounded-full bg-destructive/10 px-3 py-1 text-destructive">
                {owing.length} {owing.length === 1 ? "debe" : "deben"}{" "}
                <span className="font-bold tabular-nums">
                  {formatMoney(-sum(owing, "closing"))}
                </span>
              </span>
            )}
          </div>
        )}
      </CardHeader>
      {players.length === 0 ? (
        <CardContent className="pb-6">
          <p className="text-sm text-muted-foreground">
            Nadie jugó en esta jornada.
          </p>
        </CardContent>
      ) : (
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-muted text-xs text-muted-foreground">
              <tr>
                <th className="sticky left-0 z-10 bg-muted py-2.5 pr-3 pl-6 text-left font-medium">
                  Jugador
                </th>
                <th className="px-3 py-2.5 text-right font-medium">
                  Entró con
                </th>
                <th className="px-3 py-2.5 text-right font-medium">Jugó</th>
                <th className="px-3 py-2.5 text-right font-medium">Premios</th>
                <th className="px-3 py-2.5 text-right font-medium">Recargas</th>
                <th className="px-3 py-2.5 text-right font-medium">Pagos</th>
                <th className="w-56 px-3 py-2.5 text-right font-medium">
                  Terminó con
                </th>
                <th className="py-2.5 pr-6 pl-3">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => {
                const width = (Math.abs(p.closing) / maxAbs) * 50
                return (
                  <tr
                    key={p.id}
                    className="group/row border-t hover:bg-muted/50"
                  >
                    <th
                      scope="row"
                      className="sticky left-0 z-10 bg-card py-2.5 pr-3 pl-6 text-left font-medium group-hover/row:bg-muted"
                    >
                      <span className="flex items-center gap-3">
                        <span
                          aria-hidden="true"
                          className={cn(
                            "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white",
                            colorOf.get(p.id)
                          )}
                        >
                          {initials(p.name)}
                        </span>
                        <span>{p.name}</span>
                        {p.removed && <Badge variant="outline">Retirado</Badge>}
                      </span>
                    </th>
                    <td className="px-3 py-2.5 text-right">
                      <Money value={p.opening} signed />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Money value={p.played} />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Money value={p.prizes} />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Money value={p.recharges} />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Money value={p.payouts} />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-3">
                        <div
                          aria-hidden="true"
                          className="relative h-2 flex-1 rounded-full bg-muted"
                        >
                          <div className="absolute -inset-y-1 left-1/2 w-px bg-border" />
                          {p.closing !== 0 && (
                            <div
                              className={cn(
                                "absolute inset-y-0 rounded-full",
                                p.closing > 0 ? "bg-success" : "bg-destructive"
                              )}
                              style={{
                                left: `${p.closing > 0 ? 50 : 50 - width}%`,
                                width: `${width}%`,
                              }}
                            />
                          )}
                        </div>
                        <span
                          className={cn(
                            "w-16 shrink-0 text-right font-bold tabular-nums",
                            signTone(p.closing)
                          )}
                        >
                          {signedMoney(p.closing)}
                        </span>
                      </div>
                    </td>
                    <td className="py-2 pr-6 pl-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRoundsOf(p)}
                      >
                        Ver rondas
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 font-semibold">
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-card py-3 pr-3 pl-6 text-left font-semibold"
                >
                  Total
                </th>
                <td
                  className={cn(
                    "px-3 py-3 text-right tabular-nums",
                    signTone(sum(players, "opening"))
                  )}
                >
                  {signedMoney(sum(players, "opening"))}
                </td>
                <td className="px-3 py-3 text-right tabular-nums">
                  {formatMoney(sum(players, "played"))}
                </td>
                <td className="px-3 py-3 text-right tabular-nums">
                  {formatMoney(sum(players, "prizes"))}
                </td>
                <td className="px-3 py-3 text-right tabular-nums">
                  {formatMoney(sum(players, "recharges"))}
                </td>
                <td className="px-3 py-3 text-right tabular-nums">
                  {formatMoney(sum(players, "payouts"))}
                </td>
                <td
                  className={cn(
                    "px-3 py-3 text-right tabular-nums",
                    signTone(sum(players, "closing"))
                  )}
                >
                  {signedMoney(sum(players, "closing"))}
                </td>
                <td className="py-3 pr-6 pl-3" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
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

// /reports/games/[id]: the full report of one game session (Phase 6a), reached
// from Reportes → Jornadas. A game session in progress shows what happened so far.
export function GameDetailPage({
  report,
}: {
  report: GameSessionReport | null
}) {
  if (!report) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          No se encontró la jornada.
        </p>
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href="/reports/games" />}
        >
          <ArrowLeftIcon />
          Volver a jornadas
        </Button>
      </div>
    )
  }

  const isActive = report.status === "active"
  const house = report.house.total
  const players = report.players.filter((p) => !p.removed)
  const owed = players.filter((p) => p.closing > 0).length
  const owing = players.filter((p) => p.closing < 0).length

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4 px-4 lg:px-6">
        <div className="flex min-w-0 flex-col gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 w-fit text-muted-foreground"
            nativeButton={false}
            render={<Link href="/reports/games" />}
          >
            <ArrowLeftIcon />
            Todas las jornadas
          </Button>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-3xl font-bold tracking-tight">
              Jornada #{report.number}
            </h2>
            {isActive ? (
              <Badge className="bg-success/15 text-success">En curso</Badge>
            ) : (
              <Badge variant="secondary">Terminada</Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CalendarIcon className="size-4" aria-hidden="true" />
              <span className="tabular-nums">{report.startedAtLabel}</span>
              {report.endedAtLabel && (
                <>
                  <ArrowRightIcon className="size-3.5" aria-label="hasta" />
                  <span className="tabular-nums">{report.endedAtLabel}</span>
                </>
              )}
            </span>
            {!isActive && (
              <span className="flex items-center gap-1.5">
                <ClockIcon className="size-4" aria-hidden="true" />
                <span className="tabular-nums">
                  {formatDuration(report.durationMs)}
                </span>
              </span>
            )}
          </div>
        </div>
        {isActive ? (
          <Button nativeButton={false} render={<Link href="/active-round" />}>
            <PlayIcon />
            Ir a la ronda activa
          </Button>
        ) : (
          report.settlement && (
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={`/games/${report.id}/settlement`} />}
            >
              Ver liquidación
            </Button>
          )
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        <KpiCard
          label="Resultado de la casa"
          footer={
            house > 0
              ? "La casa ganó en esta jornada"
              : house < 0
                ? "La casa perdió en esta jornada"
                : "Sin ganancia ni pérdida"
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
          footer={isActive ? "En curso" : formatDuration(report.durationMs)}
        >
          <span className="flex items-baseline gap-5">
            <span className="flex items-baseline gap-1.5">
              {report.roundsPlayed}
              <span className="text-xs font-normal text-muted-foreground">
                {report.roundsPlayed === 1 ? "ronda" : "rondas"}
              </span>
            </span>
            <span className="flex items-baseline gap-1.5">
              {report.ticketsCount}
              <span className="text-xs font-normal text-muted-foreground">
                {report.ticketsCount === 1 ? "cartón" : "cartones"}
              </span>
            </span>
          </span>
        </KpiCard>
        <KpiCard
          label="Jugadores"
          footer={
            <>
              <span className="font-semibold text-success tabular-nums">
                {owed}
              </span>{" "}
              a favor ·{" "}
              <span className="font-semibold text-destructive tabular-nums">
                {owing}
              </span>{" "}
              {owing === 1 ? "debe" : "deben"}
            </>
          }
        >
          {players.length}
        </KpiCard>
      </div>

      <div className="grid gap-4 px-4 lg:px-6 @5xl/main:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <HouseCard report={report} />
        <div className="flex flex-col gap-4">
          <SettlementCard report={report} />
          <CashCard report={report} />
        </div>
      </div>

      <div className="flex flex-col gap-4 px-4 lg:px-6">
        <PlayersCard gameSessionId={report.id} players={report.players} />
        <RoundHistoryCard
          rounds={[...report.rounds].reverse()}
          emptyText="Todavía no se eligió ninguna ronda."
        />
        <GameTimelineCard report={report} />
      </div>
    </div>
  )
}
