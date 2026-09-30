"use client"

import Link from "next/link"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { bankLabel } from "@/lib/banks"
import type { DebtRow } from "@/lib/data/debts"
import { paymentMethodLabel } from "@/lib/payment-methods"
import { signedMoney } from "@/lib/round-draft/balance"
import { formatMoney } from "@/lib/rounds"
import { cn } from "@/lib/utils"

type Group = {
  key: string
  title: string
  description: string
  match: (row: DebtRow) => boolean
}

// The same statuses as /players and "Iniciar jornada" (lib/accounts.ts).
const GROUPS: Group[] = [
  {
    key: "owes",
    title: "Deben",
    description: "Le deben a la casa.",
    match: (r) => r.balance < 0,
  },
  {
    key: "pending_payout",
    title: "Pendiente de pago",
    description: "La casa les debe pagar; no se pudo todavía.",
    match: (r) => r.balance > 0 && r.status === "pending_payout",
  },
  {
    key: "undecided",
    title: "Por definir",
    description: "Tienen saldo a favor y nadie decidió qué hacer con él.",
    match: (r) => r.balance > 0 && r.status !== "pending_payout" && r.status !== "play",
  },
  {
    key: "play",
    title: "Para jugar",
    description: "Dejaron su saldo a favor en la casa para seguir jugando.",
    match: (r) => r.balance > 0 && r.status === "play",
  },
]

function DebtLine({ row }: { row: DebtRow }) {
  const reference = [paymentMethodLabel(row.paymentMethod), bankLabel(row.bank)]
    .filter(Boolean)
    .join(" · ")
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="font-medium">
          {row.name}
          {row.inGame && <span className="ml-2 text-xs text-muted-foreground">(en jornada)</span>}
        </span>
        <span className="text-xs text-muted-foreground">
          {row.note && <span>{row.note} · </span>}
          {row.lastGameSession ? (
            <Link
              href={`/reports/games/${row.lastGameSession.id}`}
              className="underline-offset-4 hover:underline"
            >
              última jornada #{row.lastGameSession.number}
            </Link>
          ) : (
            "fuera de jornada"
          )}
          {reference && <span> · {reference}</span>}
        </span>
      </div>
      <span
        className={cn(
          "font-semibold tabular-nums",
          row.balance < 0 ? "text-destructive" : "text-green-600"
        )}
      >
        {signedMoney(row.balance)}
      </span>
    </li>
  )
}

// Reportes → Deudas: pending balances today, grouped like the settlement.
export function DebtsReport({ rows }: { rows: DebtRow[] }) {
  const owed = rows.filter((r) => r.balance < 0).reduce((sum, r) => sum - r.balance, 0)
  const owing = rows.filter((r) => r.balance > 0).reduce((sum, r) => sum + r.balance, 0)

  return (
    <div className="flex flex-col gap-4 px-4 lg:px-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardDescription>Le deben a la casa</CardDescription>
            <CardTitle className="text-2xl text-destructive tabular-nums">{formatMoney(owed)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>La casa les debe</CardDescription>
            <CardTitle className="text-2xl text-green-600 tabular-nums">{formatMoney(owing)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {rows.length === 0 && (
        <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
          Nadie tiene saldo pendiente.
        </p>
      )}

      {GROUPS.map((group) => {
        const groupRows = rows.filter(group.match)
        if (groupRows.length === 0) return null
        const total = groupRows.reduce((sum, r) => sum + r.balance, 0)
        return (
          <Card key={group.key}>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div>
                <CardTitle>
                  {group.title} · {groupRows.length}
                </CardTitle>
                <CardDescription>{group.description}</CardDescription>
              </div>
              <span
                className={cn(
                  "font-semibold tabular-nums",
                  total < 0 ? "text-destructive" : "text-green-600"
                )}
              >
                {signedMoney(total)}
              </span>
            </CardHeader>
            <CardContent>
              <ul className="divide-y rounded-lg border">
                {groupRows.map((row) => (
                  <DebtLine key={row.playerId} row={row} />
                ))}
              </ul>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
