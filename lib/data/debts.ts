import { cache } from "react"

import type { BalanceStatus } from "@/lib/accounts"
import { isBank, type Bank } from "@/lib/banks"
import { accountFor, listPlayerAccounts } from "@/lib/data/accounts"
import { getCurrentHouse } from "@/lib/data/house"
import { isPaymentMethod, type PaymentMethod } from "@/lib/payment-methods"
import { createClient } from "@/lib/supabase/server"

// Reportes → Deudas: every active player whose balance isn't $0 today, with
// the game session the balance comes from (the last one they played).

export interface DebtRow {
  playerId: number
  name: string
  /** Live: the active game session's balance when the player is in it. */
  balance: number
  status: BalanceStatus | null
  note: string | null
  inGame: boolean
  paymentMethod: PaymentMethod | null
  bank: Bank | null
  lastGameSession: { id: number; number: number } | null
}

const PAGE_SIZE = 1000

export const listDebts = cache(async (): Promise<DebtRow[]> => {
  const house = await getCurrentHouse()
  if (!house) return []
  const supabase = await createClient()

  const [players, accounts] = await Promise.all([
    supabase
      .from("players")
      .select("id, name, payment_method, bank")
      .eq("house_id", house.houseId)
      .eq("active", true),
    listPlayerAccounts(),
  ])
  if (players.error) throw players.error

  // The last game session of each player (highest number), page by page.
  const last = new Map<number, { id: number; number: number }>()
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("game_session_players")
      .select("player_id, game_sessions(id, number)")
      .eq("house_id", house.houseId)
      .order("id")
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    for (const row of data) {
      const g = row.game_sessions
      if (!g) continue
      const current = last.get(row.player_id)
      if (!current || g.number > current.number) last.set(row.player_id, { id: g.id, number: g.number })
    }
    if (data.length < PAGE_SIZE) break
  }

  return players.data
    .map((p) => {
      const account = accountFor(accounts, p.id)
      return {
        playerId: p.id,
        name: p.name,
        balance: account.balance,
        status: account.status,
        note: account.note,
        inGame: account.inGame,
        paymentMethod: isPaymentMethod(p.payment_method) ? p.payment_method : null,
        bank: isBank(p.bank) ? p.bank : null,
        lastGameSession: last.get(p.id) ?? null,
      }
    })
    .filter((row) => row.balance !== 0)
    .sort((a, b) => a.balance - b.balance)
})
