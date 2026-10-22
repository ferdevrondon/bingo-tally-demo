import { isBank, type Bank } from "@/lib/banks"
import { isRecordedPaymentMethod, type RecordedPaymentMethod } from "@/lib/payment-methods"

// "Últimos movimientos" (migration *_movement_corrections.sql): a cash move
// recorded with the wrong amount is never edited, it gets a linked correction
// row of the same type whose `amount` is the difference. This turns a
// player's ledger rows into the moves the dialog lists, and predicts which of
// them can still be corrected (correct_movement is the real guard).

/** From here the cash move confirmation marks the amount as large. */
export const LARGE_AMOUNT = 500

/** Whether `amount` deserves a second look: from LARGE_AMOUNT up, or five
 *  times the player's usual amount when there is one. */
export function isLargeAmount(amount: number, usual: number | null = null): boolean {
  return amount >= LARGE_AMOUNT || (usual !== null && usual > 0 && amount >= usual * 5)
}

export interface LedgerCashRow {
  id: number
  created_at: string
  type: string
  amount: number | null
  payment_method: string | null
  bank: string | null
  note: string | null
  game_session_id: number | null
  settlement_id: number | null
  corrects_id: number | null
}

export interface CashMove {
  id: number
  createdAt: string
  type: "recharge" | "payout"
  /** What was recorded, positive. */
  amount: number
  paymentMethod: RecordedPaymentMethod | null
  bank: Bank | null
  note: string | null
  /** The amount after its correction, and why; null when not corrected. */
  correction: { amount: number; reason: string } | null
  /** The money already left where the move put it: it can't be corrected. */
  closed: boolean
}

export interface CashMoveContext {
  /** The house's latest game session, or null when it never played. */
  latestGameSession: { id: number; status: string; startedAt: string } | null
  /** Settlements (by game session id) that are still open. */
  openSettlements: ReadonlySet<number>
  /** The player is in the active game session (their money is there). */
  inGame: boolean
}

/** Same rules as correct_movement's 'movement_closed'. */
function isClosed(row: LedgerCashRow, context: CashMoveContext): boolean {
  if (row.settlement_id !== null && !context.openSettlements.has(row.settlement_id)) return true
  const latest = context.latestGameSession
  if (row.game_session_id !== null) {
    return !(latest && latest.status === "active" && latest.id === row.game_session_id)
  }
  if (context.inGame) return true
  return latest !== null && Date.parse(latest.startedAt) > Date.parse(row.created_at)
}

/** The player's cash moves, newest first, each with its correction. */
export function toCashMoves(rows: LedgerCashRow[], context: CashMoveContext): CashMove[] {
  const corrections = new Map(
    rows.filter((r) => r.corrects_id !== null).map((r) => [r.corrects_id as number, r])
  )
  return rows
    .filter(
      (r): r is LedgerCashRow & { type: "recharge" | "payout" } =>
        r.corrects_id === null && (r.type === "recharge" || r.type === "payout")
    )
    .sort((a, b) => b.id - a.id)
    .map((row) => {
      const recorded = Number(row.amount ?? 0)
      const fix = corrections.get(row.id)
      return {
        id: row.id,
        createdAt: row.created_at,
        type: row.type,
        amount: Math.abs(recorded),
        paymentMethod: isRecordedPaymentMethod(row.payment_method) ? row.payment_method : null,
        bank: isBank(row.bank) ? row.bank : null,
        note: row.note,
        correction: fix
          ? { amount: Math.abs(recorded + Number(fix.amount ?? 0)), reason: fix.note ?? "" }
          : null,
        closed: isClosed(row, context),
      }
    })
}

/** What correcting `move` to `amount` adds to the player's balance. */
export function correctionDelta(move: Pick<CashMove, "type" | "amount">, amount: number): number {
  return move.type === "recharge" ? amount - move.amount : move.amount - amount
}
