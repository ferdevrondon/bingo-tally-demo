// The player's account (public.player_accounts, BACKEND_PLAN.md business
// rules v2 D and G): one signed balance that carries over between game
// sessions, plus the status the admin gives it at each settlement.

/** `play` and `pending_payout` hold on a positive balance, `owes` on a negative one. */
export type BalanceStatus = "play" | "pending_payout" | "owes"

export const BALANCE_STATUSES = ["play", "pending_payout", "owes"] as const

export function isBalanceStatus(value: unknown): value is BalanceStatus {
  return BALANCE_STATUSES.includes(value as BalanceStatus)
}

export interface PlayerAccount {
  playerId: number
  /** The live balance: the active game session's when the player is in it. */
  balance: number
  status: BalanceStatus | null
  note: string | null
  /** Playing the active game session right now. */
  inGame: boolean
}

export const BALANCE_STATUS_LABELS: Record<BalanceStatus, string> = {
  play: "Para jugar",
  pending_payout: "Pendiente de pago",
  owes: "Debe",
}

/** "Debe", "Al día", "Para jugar", "Pendiente de pago" or "Por definir". */
export function accountStatusLabel(balance: number, status: BalanceStatus | null): string {
  if (balance < 0) return "Debe"
  if (balance === 0) return "Al día"
  if (status === "play" || status === "pending_payout") return BALANCE_STATUS_LABELS[status]
  return "Por definir"
}

/** The status plus its note, e.g. "Debe · paga el viernes". */
export function accountStatusText(account: Pick<PlayerAccount, "balance" | "status" | "note">) {
  const label = accountStatusLabel(account.balance, account.status)
  return account.note && account.balance !== 0 ? `${label} · ${account.note}` : label
}

/** What "Iniciar jornada" warns about: debts, pending payouts and positive
 *  balances nobody decided on yet. */
export function needsAttention(account: Pick<PlayerAccount, "balance" | "status">): boolean {
  return account.balance < 0 || (account.balance > 0 && account.status !== "play")
}
