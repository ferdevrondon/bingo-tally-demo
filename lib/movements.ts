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
  /** The round in play when the move was made; null outside a game session. */
  round_id?: number | null
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
  /** The game session it belongs to: the one it was made in, or the one
   *  whose settlement it was; null outside any game session. */
  sessionId: number | null
  /** Made in a game session's settlement. */
  fromSettlement: boolean
  /** The round in play when it was made; null outside a game session. */
  roundId: number | null
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
        sessionId: row.game_session_id ?? row.settlement_id,
        fromSettlement: row.game_session_id === null && row.settlement_id !== null,
        roundId: row.round_id ?? null,
      }
    })
}

/** What correcting `move` to `amount` adds to the player's balance. */
export function correctionDelta(move: Pick<CashMove, "type" | "amount">, amount: number): number {
  return move.type === "recharge" ? amount - move.amount : move.amount - amount
}

// Transfers of balance between players (migration *_balance_transfers.sql):
// one ledger row per player, linked by `transfer_id`. They are not cash, so
// they never mix with the cobros and pagos above; "Últimos movimientos" lists
// them next to those and offers to void them (void_balance_transfer is the
// real guard).

export interface LedgerTransferRow extends LedgerCashRow {
  transfer_id: string | null
  counterparty_player_id: number | null
}

export interface TransferMove {
  /** The player's own ledger row (orders the list). */
  id: number
  transferId: string
  createdAt: string
  /** "out": the player gave it; "in": they received it. */
  direction: "out" | "in"
  /** Positive. */
  amount: number
  counterpartyId: number
  note: string | null
  /** Set when the transfer was voided, with the reason. */
  voided: { reason: string } | null
  /** The money already left where the transfer put it (this player's side). */
  closed: boolean
  /** The game session it was made in; null on the account. */
  sessionId: number | null
  /** The round in play when it was made; null on the account. */
  roundId: number | null
}

/** The player's transfers, newest first, each with its voiding. */
export function toTransferMoves(rows: LedgerTransferRow[], context: CashMoveContext): TransferMove[] {
  const voidings = new Map(
    rows.filter((r) => r.corrects_id !== null).map((r) => [r.corrects_id as number, r])
  )
  return rows
    .filter(
      (r) =>
        r.type === "balance_transfer" &&
        r.corrects_id === null &&
        r.transfer_id !== null &&
        r.counterparty_player_id !== null
    )
    .sort((a, b) => b.id - a.id)
    .map((row) => {
      const recorded = Number(row.amount ?? 0)
      const voiding = voidings.get(row.id)
      return {
        id: row.id,
        transferId: row.transfer_id as string,
        createdAt: row.created_at,
        direction: recorded < 0 ? "out" : "in",
        amount: Math.abs(recorded),
        counterpartyId: row.counterparty_player_id as number,
        note: row.note,
        voided: voiding ? { reason: voiding.note ?? "" } : null,
        closed: isClosed(row, context),
        sessionId: row.game_session_id ?? row.settlement_id,
        roundId: row.round_id ?? null,
      }
    })
}

// "Movimientos" by game session: one section per game session (its moves and
// its settlement's), and "Fuera de jornada" for the runs of moves made on the
// account outside any game session, newest first.

export interface MoveSessionInfo {
  id: number
  number: number
  startedAt: string
  /** The game session in play. */
  active: boolean
}

export type MoveSection<T> =
  | { key: string; kind: "session"; session: MoveSessionInfo; items: T[] }
  | { key: string; kind: "outside"; items: T[] }

/** `items` newest first (by id); each section keeps that order. A game
 *  session's moves stay in one section even when an account move happened in
 *  between (a settlement paid days later). */
export function groupMovesBySession<T extends { move: { id: number; sessionId: number | null } }>(
  items: T[],
  sessions: ReadonlyMap<number, MoveSessionInfo>
): MoveSection<T>[] {
  const sections: MoveSection<T>[] = []
  const bySession = new Map<number, MoveSection<T>>()
  for (const item of [...items].sort((a, b) => b.move.id - a.move.id)) {
    const sessionId = item.move.sessionId
    const session = sessionId === null ? undefined : sessions.get(sessionId)
    if (sessionId !== null && session) {
      const existing = bySession.get(sessionId)
      if (existing) {
        existing.items.push(item)
        continue
      }
      const section: MoveSection<T> = { key: `s-${sessionId}`, kind: "session", session, items: [item] }
      bySession.set(sessionId, section)
      sections.push(section)
      continue
    }
    const last = sections.at(-1)
    if (last?.kind === "outside") last.items.push(item)
    else sections.push({ key: `o-${item.move.id}`, kind: "outside", items: [item] })
  }
  return sections
}
