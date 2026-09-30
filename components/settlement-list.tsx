import Link from "next/link"
import { ChevronRightIcon, LockIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import type { SettlementListItem } from "@/lib/settlement"
import { cn } from "@/lib/utils"

// /settlement: every ended game session's settlement, newest first, with how
// many players are still unresolved. Not the game sessions list (Phase 6).
export function SettlementList({ settlements }: { settlements: SettlementListItem[] }) {
  return (
    <div className="flex flex-col gap-4 py-4 md:py-6">
      <div>
        <h1 className="text-2xl font-semibold">Liquidaciones</h1>
        <p className="text-sm text-muted-foreground">
          Al terminar cada jornada, cobra, paga o marca el saldo de cada jugador.
        </p>
      </div>
      {settlements.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
          Todavía no hay jornadas terminadas. La liquidación aparece aquí al terminar una jornada.
        </p>
      ) : (
        <ul className="rounded-xl border">
          {settlements.map((s) => (
            <li key={s.gameSessionId} className="border-b last:border-b-0">
              <Link
                href={`/games/${s.gameSessionId}/settlement`}
                className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-muted/50"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">Jornada #{s.number}</span>
                  <span className="text-sm text-muted-foreground">
                    Terminó el {s.endedAtLabel} · {s.players} jugadores
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {s.status === "closed" ? (
                    <Badge variant="secondary" className="gap-1">
                      <LockIcon className="size-3" />
                      Cerrada
                    </Badge>
                  ) : (
                    <Badge
                      className={cn(
                        s.unresolved > 0
                          ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                          : "bg-green-500/15 text-green-700 dark:text-green-400"
                      )}
                    >
                      {s.unresolved > 0 ? `Abierta · ${s.unresolved} por resolver` : "Abierta · todo resuelto"}
                    </Badge>
                  )}
                  <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
