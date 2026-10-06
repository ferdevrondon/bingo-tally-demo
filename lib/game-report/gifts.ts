import type { RoundGift, RoundWinnerReport } from "./types"

/** The ledger columns the gifts of a round are read from. */
export interface GiftLedgerRow {
  type: string
  player_id: number | null
  ticket_id: number | null
  number: number | null
  amount: number | string | null
}

/** The numbers gifted in one round, with whom, what each cost the house and
 *  whether it won. Rows are in ledger order (oldest first). A gift stops
 *  being one when it is un-gifted, or when the gifted number is released or
 *  handed over (those rows carry no money: a gift was never paid for).
 *  Cost to the house, like the round's result (private.round_margin_parts):
 *  a gift that didn't win costs the line price; a winning one costs what it
 *  was paid (prize - line price). */
export function buildRoundGifts(
  rows: GiftLedgerRow[],
  round: { linePrice: number },
  winners: RoundWinnerReport[],
  names: Map<number, string>,
  ticketIndex: Map<number, number>
): RoundGift[] {
  const open: { playerId: number; ticketId: number | null; number: number }[] = []
  const drop = (playerId: number | null, number: number | null) => {
    const i = open.findIndex((g) => g.playerId === playerId && g.number === number)
    if (i >= 0) open.splice(i, 1)
  }

  for (const row of rows) {
    if (row.player_id === null || row.number === null) continue
    const amount = Number(row.amount ?? 0)
    if (row.type === "number_gifted") {
      open.push({ playerId: row.player_id, ticketId: row.ticket_id, number: row.number })
    } else if (
      row.type === "number_ungifted" ||
      (row.type === "number_released" && amount === 0) ||
      (row.type === "number_reassigned" && amount === 0)
    ) {
      drop(row.player_id, row.number)
    }
  }

  // A gift wins when its player has a winning ticket for the number: first
  // the winner on the same ticket, then (plays move between tickets when a
  // row is compacted) any other winner of that player and number.
  const pending = [...winners]
  const indexOf = (ticketId: number | null) =>
    ticketId !== null ? (ticketIndex.get(ticketId) ?? 0) : 0
  const matched: (RoundWinnerReport | null)[] = open.map(() => null)
  const take = (i: number, at: number) => {
    matched[i] = pending.splice(at, 1)[0]
  }
  open.forEach((g, i) => {
    const at = pending.findIndex(
      (w) =>
        w.playerId === g.playerId && w.number === g.number && w.ticketIndex === indexOf(g.ticketId)
    )
    if (at >= 0) take(i, at)
  })
  open.forEach((g, i) => {
    if (matched[i] !== null) return
    const at = pending.findIndex((w) => w.playerId === g.playerId && w.number === g.number)
    if (at >= 0) take(i, at)
  })

  return open
    .map((g, i): RoundGift => {
      const winner = matched[i]
      return {
        playerId: g.playerId,
        playerName: names.get(g.playerId) ?? "Jugador",
        ticketIndex: indexOf(g.ticketId),
        number: g.number,
        won: winner !== null,
        cost: winner !== null ? winner.prize : round.linePrice,
      }
    })
    .sort(
      (a, b) =>
        a.number - b.number ||
        a.playerName.localeCompare(b.playerName, "es") ||
        a.ticketIndex - b.ticketIndex
    )
}
