"use client"

import * as React from "react"
import { CheckIcon, ChevronRightIcon, WalletIcon } from "lucide-react"
import { toast } from "sonner"

import {
  BalanceTransferForm,
  type TransferValues,
} from "@/components/balance-transfer-form"
import { BingoBall } from "@/components/bingo-ball"
import {
  RecentMovementsPanel,
  type CorrectionValues,
  type VoidTransferValues,
} from "@/components/recent-movements-panel"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Toggle } from "@/components/ui/toggle"
import { PlayerEditNumbersDialog } from "@/components/player-edit-numbers-dialog"
import { PlayerBalanceDialog } from "@/components/player-balance-dialog"
import { PlayerRechargeForm } from "@/components/player-recharge-form"
import { PlayerReleaseNumbersDialog } from "@/components/player-release-numbers-dialog"
import { GiftHistoryButton, PlayerGiftsDialog } from "@/components/player-gifts-dialog"
import { PlayerRoundsDialog } from "@/components/player-rounds-dialog"
import { RemovePlayerDialog } from "@/components/remove-player-dialog"
import { useCheckInToggle } from "@/components/check-in-dialog"
import {
  correctMovement,
  transferBalance,
  voidTransfer,
} from "@/lib/data/account-actions"
import { GAME_ACTION_ERROR_MESSAGES } from "@/lib/data/game-action-result"
import { balanceLabel, signedMoney } from "@/lib/round-draft/balance"
import { useRoundDraft } from "@/lib/round-draft/context"
import {
  getLastRechargeActivity,
  getPlayerNumberSummary,
  getSlotWinners,
  hasGiftHistory,
} from "@/lib/round-draft/selectors"
import { formatRelativeTime } from "@/lib/format-relative-time"
import { formatMoney } from "@/lib/rounds"
import type { DraftPlayer } from "@/lib/round-draft/types"
import { cn } from "@/lib/utils"

export function PlayerActiveCard({
  player,
  className,
}: {
  player: DraftPlayer
  className?: string
}) {
  const { state, readOnly, resolveCarryOver } = useRoundDraft()
  const checkInToggle = useCheckInToggle()
  const linePrice = state.round?.linePrice ?? 0
  const [isEditOpen, setIsEditOpen] = React.useState(false)
  const [isBalanceOpen, setIsBalanceOpen] = React.useState(false)
  const [isRoundsOpen, setIsRoundsOpen] = React.useState(false)
  const [isGiftsOpen, setIsGiftsOpen] = React.useState(false)
  const showGifts = hasGiftHistory(state, player.id)
  const [isRemoveConfirmOpen, setIsRemoveConfirmOpen] = React.useState(false)
  const [isReleaseOpen, setIsReleaseOpen] = React.useState(false)

  const balance = player.balance
  const lastRecharge = getLastRechargeActivity(state, player.id)

  // A correction from "Últimos movimientos": the game session re-syncs from
  // the new ledger row.
  async function handleCorrection(values: CorrectionValues): Promise<boolean> {
    const result = await correctMovement(values)
    if (result.ok) {
      toast.success("Movimiento corregido")
      return true
    }
    if (result.error !== "session_replaced")
      toast.error(GAME_ACTION_ERROR_MESSAGES[result.error])
    return false
  }

  async function handleVoidTransfer(
    values: VoidTransferValues
  ): Promise<boolean> {
    const result = await voidTransfer(values)
    if (result.ok) {
      toast.success("Transferencia anulada")
      return true
    }
    if (result.error !== "session_replaced")
      toast.error(GAME_ACTION_ERROR_MESSAGES[result.error])
    return false
  }

  // "Transferir saldo": the game session re-syncs from the new ledger rows.
  async function handleTransfer(values: TransferValues): Promise<boolean> {
    const result = await transferBalance({ fromPlayerId: player.id, ...values })
    if (result.ok) {
      toast.success("Transferencia registrada")
      return true
    }
    if (result.error !== "session_replaced")
      toast.error(GAME_ACTION_ERROR_MESSAGES[result.error])
    return false
  }

  const numbers = getPlayerNumberSummary(state, player.id).map(
    ({ number, count, gifts }) => ({
      number,
      amount: count * linePrice, // the real value; gifts are shown apart
      plays: count,
      giftCount: gifts,
      giftDiscount: gifts * linePrice,
      isGift: gifts > 0,
    })
  )
  const totalPlayed = numbers.reduce((sum, n) => sum + n.amount, 0)
  const giftsValue = numbers.reduce(
    (sum, n) => sum + n.giftCount * linePrice,
    0
  )
  const giftPlays = numbers.reduce((sum, n) => sum + n.giftCount, 0)

  // The winning numbers of the open round this player holds, and what they
  // were paid for them (the trophy goes away when the round closes).
  const winningNumbers = new Set(
    state.winningNumbers.filter((n): n is number => n !== null)
  )
  const slotWinners = getSlotWinners(state)
  const won = state.winningNumbers.flatMap((number, slot) => {
    if (number === null || !numbers.some((n) => n.number === number)) return []
    const amount =
      slotWinners[slot]?.find((w) => w.playerId === player.id)?.amount ?? 0
    return [{ number, amount }]
  })
  const wonTotal = won.reduce((sum, w) => sum + w.amount, 0)

  return (
    <Card className={cn("gap-2 px-3.5 py-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <div className="flex min-w-36 flex-1 items-baseline gap-2">
          <span className="font-heading truncate text-[13px] font-semibold">
            {player.name}
          </span>
          {showGifts && (
            <GiftHistoryButton
              playerName={player.name}
              onClick={() => setIsGiftsOpen(true)}
              className="-my-1 shrink-0 self-center"
            />
          )}
          <span
            className={cn(
              "shrink-0 text-base font-bold",
              balance >= 0 ? "text-success" : "text-destructive"
            )}
          >
            {signedMoney(balance)}
          </span>
        </div>
        {/* After a round closes the player first keeps or releases their numbers;
            the new round's charge (and the check-in) comes after that. */}
        {!player.pendingCarryOverDecision && (
          <div
            title={
              balance < 0 && !player.checkedIn
                ? balanceLabel(balance)
                : undefined
            }
            className={cn(
              "flex h-6 shrink-0 items-center gap-1 rounded-full border pr-0.5 pl-2 text-[11px] font-medium transition-colors",
              player.checkedIn
                ? "border-success/40 bg-success/10 text-success"
                : cn(
                    "border-warning bg-warning/10 text-warning-solid",
                    balance < 0 && "animate-pulse"
                  ),
              readOnly && "pr-2"
            )}
          >
            <span>{player.checkedIn ? "Check-in" : "Sin check-in"}</span>
            {!readOnly && (
              <Toggle
                pressed={player.checkedIn}
                onPressedChange={() => checkInToggle.toggle(player)}
                aria-label="Check-in"
                className={cn(
                  "size-5 h-5 min-w-5 rounded-full border p-0 transition-all duration-300 [&_svg:not([class*='size-'])]:size-3",
                  player.checkedIn
                    ? "animate-in zoom-in-50 border-success-solid bg-success-solid text-white hover:bg-success-solid/90 aria-pressed:bg-success-solid aria-pressed:text-white"
                    : "border-warning text-warning-solid hover:bg-warning/10"
                )}
              >
                <CheckIcon />
              </Toggle>
            )}
          </div>
        )}
      </div>
      {/* Takes the spare height of the row so the money and action rows line up across cards. */}
      <div className="flex flex-1 flex-col gap-2">
        {balance < 0 &&
          !player.checkedIn &&
          !player.pendingCarryOverDecision && (
            <span className="-mt-1 text-[11px] font-semibold text-destructive">
              {balanceLabel(balance)}
            </span>
          )}

        {numbers.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Sin números asignados.
          </p>
        ) : (
          <div className="flex flex-wrap gap-x-1.5 gap-y-4 pt-2.5">
            {numbers.map(
              ({ number, amount, plays, giftCount, giftDiscount, isGift }) => (
                <BingoBall
                  key={number}
                  size="sm"
                  number={number}
                  amount={amount}
                  plays={plays}
                  giftCount={giftCount}
                  giftDiscount={giftDiscount}
                  variant="taken"
                  isGift={isGift}
                  isWinner={winningNumbers.has(number)}
                />
              )
            )}
          </div>
        )}
        {won.length > 0 && (
          <p className="rounded-lg border border-warning/60 bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-950 dark:bg-warning/15 dark:text-amber-100">
            🏆 {wonTotal > 0 ? `Ganó ${formatMoney(wonTotal)}` : "Ganó"} con el{" "}
            {won.map((w) => w.number).join(" y el ")}
          </p>
        )}
      </div>

      <div className="flex items-start justify-between gap-2 border-t pt-2 text-xs">
        <div className="flex min-w-0 flex-col">
          <span>
            <span className="text-muted-foreground">Total jugada </span>
            <span className="font-semibold text-foreground">
              ${totalPlayed}
            </span>
          </span>
          {giftPlays > 0 && (
            <span className="text-[11px] text-muted-foreground">
              De los cuales {giftPlays} {giftPlays === 1 ? "regalo" : "regalos"}{" "}
              (−${giftsValue}) · Cobrado ${totalPlayed - giftsValue}
            </span>
          )}
        </div>
        {!readOnly && (
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 pointer-coarse:h-10 pointer-coarse:px-4"
            onClick={() => setIsBalanceOpen(true)}
            title="Recargar, transferir o ver movimientos"
            aria-label="Saldo: recargar, transferir o ver movimientos"
          >
            <WalletIcon data-icon="inline-start" />
            Saldo
          </Button>
        )}
      </div>

      {player.pendingCarryOverDecision && !readOnly && (
        <div className="flex items-center gap-2 rounded-lg border border-dashed px-2.5 py-1.5">
          <span className="flex-1 text-[11px] text-muted-foreground">
            ¿Mantiene su jugada?
          </span>
          <Button
            variant="outline"
            size="xs"
            onClick={() => resolveCarryOver(player.id, [])}
          >
            Mantener
          </Button>
          <Button
            variant="outline"
            size="xs"
            onClick={() => setIsReleaseOpen(true)}
          >
            Liberar
          </Button>
        </div>
      )}

      {/* Away from "Saldo" (above, on the right): "Retirar jugador" sits on
          the left and "Editar jugada" under "Saldo", with a divider and room
          between them, so a finger on a tablet doesn't hit the wrong one. */}
      <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t pt-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsRoundsOpen(true)}
            className="flex shrink-0 items-center gap-0.5 text-xs font-semibold whitespace-nowrap text-primary underline-offset-2 hover:underline pointer-coarse:min-h-9"
          >
            <span>Ver rondas</span>
            <ChevronRightIcon className="size-3.5" />
          </button>
          {!readOnly && (
            <Button
              variant="destructive"
              size="xs"
              className="pointer-coarse:h-9 pointer-coarse:px-3"
              onClick={() => setIsRemoveConfirmOpen(true)}
            >
              Retirar jugador
            </Button>
          )}
        </div>
        {!readOnly && (
          <Button
            variant="outline"
            size="xs"
            className="pointer-coarse:h-9 pointer-coarse:px-3"
            disabled={player.pendingCarryOverDecision}
            title={
              player.pendingCarryOverDecision
                ? "Primero decide si mantiene o libera su jugada"
                : undefined
            }
            onClick={() => setIsEditOpen(true)}
          >
            Editar jugada
          </Button>
        )}
      </div>

      {checkInToggle.dialog}
      <PlayerEditNumbersDialog
        player={player}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
      />
      <PlayerBalanceDialog
        open={isBalanceOpen}
        onOpenChange={setIsBalanceOpen}
        name={player.name}
        balance={balance}
        subtitle={
          lastRecharge
            ? `Última recarga ${formatRelativeTime(lastRecharge.timestamp)}`
            : "Sin recargas previas"
        }
        tabs={[
          {
            value: "money",
            label: "Recarga",
            content: (
              <PlayerRechargeForm
                player={player}
                onDone={() => setIsBalanceOpen(false)}
              />
            ),
          },
          {
            value: "transfer",
            label: "Transferencia",
            disabled: balance <= 0,
            content: (
              <BalanceTransferForm
                from={{ id: player.id, name: player.name, balance }}
                candidates={state.players
                  .filter((p) => p.id !== player.id && !p.removed)
                  .map((p) => ({ id: p.id, name: p.name, balance: p.balance }))}
                onConfirm={handleTransfer}
                onDone={() => setIsBalanceOpen(false)}
              />
            ),
          },
          {
            value: "movements",
            label: "Movimientos",
            content: (
              <RecentMovementsPanel
                player={{
                  id: player.id,
                  name: player.name,
                  balance,
                  inGame: true,
                }}
                onConfirm={handleCorrection}
                onVoidTransfer={handleVoidTransfer}
                onDone={() => setIsBalanceOpen(false)}
              />
            ),
          },
        ]}
      />
      <PlayerRoundsDialog
        gameSessionId={state.gameSessionId}
        playerId={player.id}
        playerName={player.name}
        open={isRoundsOpen}
        onOpenChange={setIsRoundsOpen}
      />
      <PlayerGiftsDialog
        gameSessionId={state.gameSessionId}
        gameNumber={state.gameNumber}
        playerId={player.id}
        playerName={player.name}
        open={isGiftsOpen}
        onOpenChange={setIsGiftsOpen}
      />
      <PlayerReleaseNumbersDialog
        player={player}
        open={isReleaseOpen}
        onOpenChange={setIsReleaseOpen}
      />

      <RemovePlayerDialog
        player={player}
        open={isRemoveConfirmOpen}
        onOpenChange={setIsRemoveConfirmOpen}
      />
    </Card>
  )
}
