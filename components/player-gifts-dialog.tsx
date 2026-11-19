"use client"

import * as React from "react"
import { TrophyIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  fetchGiftHistory,
  groupGiftHistory,
  summarizeGifts,
  type PlayerGiftEntry,
} from "@/lib/game-report/player-gifts"
import { formatMoney } from "@/lib/rounds"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

/** One gift: number, ticket and value; gold with what it paid when it won. */
function GiftEntryChip({ gift }: { gift: PlayerGiftEntry }) {
  return (
    <span
      title={
        gift.won
          ? `Ganó: se pagó ${formatMoney(gift.paid ?? 0)} (premio − ${formatMoney(gift.value)})`
          : `Valor ${formatMoney(gift.value)}`
      }
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full border pr-2.5 pl-1 text-xs font-medium",
        gift.won
          ? "border-warning/60 bg-amber-100 text-amber-950 dark:bg-warning/15 dark:text-amber-100"
          : "border-destructive/20 bg-destructive/5"
      )}
    >
      <span
        className={cn(
          "flex size-5 items-center justify-center rounded-full text-[11px] font-bold tabular-nums",
          gift.won ? "bg-amber-400 text-amber-950" : "bg-destructive/15 text-destructive"
        )}
      >
        {gift.number}
      </span>
      <span className="text-muted-foreground">Cartón {gift.ticketIndex}</span>
      <strong className="tabular-nums">{formatMoney(gift.value)}</strong>
      {gift.won && (
        <>
          <TrophyIcon className="size-3 text-warning" aria-hidden="true" />
          {gift.paid !== null && (
            <span className="text-success tabular-nums">paga {formatMoney(gift.paid)}</span>
          )}
        </>
      )}
    </span>
  )
}

/** "Regalos de NAME": the player's effective gifts in one game session
 *  (lib/game-report/player-gifts.ts), by round. Read-only, for both roles. */
export function PlayerGiftsDialog({
  gameSessionId,
  gameNumber,
  playerId,
  playerName,
  open,
  onOpenChange,
}: {
  gameSessionId: number
  gameNumber: number
  playerId: number
  playerName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [entries, setEntries] = React.useState<PlayerGiftEntry[] | null>(null)
  const [failed, setFailed] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    let cancelled = false
    fetchGiftHistory(createClient(), { gameSessionId, playerId })
      .then((result) => {
        if (cancelled) return
        setEntries(result)
        setFailed(false)
      })
      .catch((error) => {
        console.error("gift history read failed", error)
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [open, gameSessionId, playerId])

  const summary = entries ? summarizeGifts(entries) : null
  const rounds = entries ? (groupGiftHistory(entries)[0]?.rounds ?? []) : []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GiftBox3D className="size-5" />
            Regalos de {playerName}
          </DialogTitle>
          <DialogDescription>
            En la jornada #{gameNumber}. Un regalo no se cobra; si gana se paga el premio menos el
            valor de la línea.
          </DialogDescription>
        </DialogHeader>

        {summary && summary.count > 0 && (
          <div className="mx-6 mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
            <span>
              <strong className="tabular-nums">{summary.count}</strong>{" "}
              {summary.count === 1 ? "regalo" : "regalos"} · valor{" "}
              <strong className="tabular-nums">{formatMoney(summary.value)}</strong>
            </span>
            <span className={cn(summary.wins > 0 ? "text-success" : "text-muted-foreground")}>
              {summary.wins > 0
                ? `Ganó con ${summary.wins} · se le pagó ${formatMoney(summary.paid)}`
                : "Ningún regalo ganó"}
            </span>
          </div>
        )}

        <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto px-6 pt-3 pb-6">
          {failed ? (
            <p className="text-sm text-destructive">No se pudieron leer sus regalos.</p>
          ) : entries === null ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin regalos en esta jornada.</p>
          ) : (
            rounds.map((round) => (
              <div key={round.roundId} className="flex flex-col gap-1.5 rounded-lg border p-2.5">
                <div className="flex items-center gap-2 text-sm font-medium">
                  Ronda {round.roundSeq} · {round.roundName}
                  {round.open && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                      En juego
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {round.gifts.map((gift) => (
                    <GiftEntryChip key={`${gift.number}-${gift.ticketIndex}`} gift={gift} />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** A gift box drawn in 3D (red box, gold ribbon and bow), like the 🎁
 *  emoji but the same on every device. Gradient ids are per instance. */
export function GiftBox3D({ className }: { className?: string }) {
  const uid = React.useId().replace(/:/g, "")
  const id = (name: string) => `${name}-${uid}`
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id("front")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f43f5e" />
          <stop offset="1" stopColor="#be123c" />
        </linearGradient>
        <linearGradient id={id("side")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#be123c" />
          <stop offset="1" stopColor="#881337" />
        </linearGradient>
        <linearGradient id={id("lid")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fb7185" />
          <stop offset="1" stopColor="#e11d48" />
        </linearGradient>
        <linearGradient id={id("gold")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fef3c7" />
          <stop offset="0.45" stopColor="#fbbf24" />
          <stop offset="1" stopColor="#b45309" />
        </linearGradient>
      </defs>
      {/* shadow */}
      <ellipse cx="16" cy="29.2" rx="12" ry="1.8" fill="#000" opacity="0.18" />
      {/* box: front and side */}
      <rect x="4.5" y="15" width="17" height="13" rx="0.8" fill={`url(#${id("front")})`} />
      <path d="M21.5 15 L27.5 12.2 L27.5 25.2 L21.5 28 Z" fill={`url(#${id("side")})`} />
      {/* lid: top, front and side */}
      <path d="M3 11 L9 8 L29 8 L23 11 Z" fill={`url(#${id("lid")})`} />
      <rect x="3" y="11" width="20" height="4.6" rx="0.6" fill={`url(#${id("lid")})`} />
      <path d="M23 11 L29 8 L29 12.4 L23 15.6 Z" fill={`url(#${id("side")})`} />
      <rect x="3" y="15" width="20" height="0.8" fill="#000" opacity="0.15" />
      {/* ribbon: down the front, across the top, down the side */}
      <rect x="11.6" y="11" width="2.8" height="17" fill={`url(#${id("gold")})`} />
      <path d="M11.6 11 L17.6 8 L20.4 8 L14.4 11 Z" fill={`url(#${id("gold")})`} />
      <path d="M5.4 9.8 L25.4 9.8 L26.6 9.2 L6.6 9.2 Z" fill={`url(#${id("gold")})`} />
      <path d="M25.3 9.5 L26.7 8.8 L26.7 13.2 L25.3 13.9 Z" fill={`url(#${id("gold")})`} opacity="0.8" />
      <path d="M23.8 13.9 L25.2 13.2 L25.2 26.2 L23.8 26.9 Z" fill={`url(#${id("gold")})`} opacity="0.75" />
      {/* bow */}
      <path
        d="M16 9.4 C12.5 4.2 7.6 5.6 9.6 8.6 C10.8 10.2 13.6 9.9 16 9.4 Z"
        fill={`url(#${id("gold")})`}
        stroke="#b45309"
        strokeWidth="0.4"
      />
      <path
        d="M16 9.4 C19.5 4.2 24.4 5.6 22.4 8.6 C21.2 10.2 18.4 9.9 16 9.4 Z"
        fill={`url(#${id("gold")})`}
        stroke="#b45309"
        strokeWidth="0.4"
      />
      <ellipse cx="16" cy="9.2" rx="1.6" ry="1.2" fill="#f59e0b" stroke="#b45309" strokeWidth="0.4" />
      {/* shine */}
      <path d="M6 16.5 L6 26" stroke="#fff" strokeWidth="1" strokeLinecap="round" opacity="0.35" />
    </svg>
  )
}

/** The gift box button that opens a player's gifts of the game session. */
export function GiftHistoryButton({
  playerName,
  onClick,
  className,
}: {
  playerName: string
  onClick: () => void
  className?: string
}) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className={cn(
        "size-7 rounded-full transition-transform hover:scale-110 hover:bg-transparent active:scale-95 dark:hover:bg-transparent pointer-coarse:size-9",
        className
      )}
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      title="Regalos en esta jornada"
      aria-label={`Regalos de ${playerName} en esta jornada`}
    >
      <GiftBox3D className="size-6 pointer-coarse:size-7" />
    </Button>
  )
}
