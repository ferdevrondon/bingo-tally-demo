import { describe, expect, it } from "vitest"

import { describeActivity } from "./activity-text"
import type { ActivityEntry } from "./types"

const context = {
  players: [
    { id: 1, name: "DIANA" },
    { id: 2, name: "CARLOS" },
  ],
  tickets: [],
  rounds: [],
}

function transfer(partial: Partial<ActivityEntry>): ActivityEntry {
  return {
    id: 1,
    timestamp: 0,
    type: "balance_transfer",
    playerId: 1,
    roundId: null,
    ticketId: null,
    number: null,
    amount: -40,
    paymentMethod: null,
    bank: null,
    note: null,
    correctsId: null,
    counterpartyPlayerId: 2,
    transferId: "t-1",
    ...partial,
  }
}

describe("describeActivity: balance_transfer", () => {
  it("names who gave and who received", () => {
    expect(describeActivity(transfer({}), context)).toBe("DIANA transfirió $40 a CARLOS")
    expect(
      describeActivity(transfer({ playerId: 2, amount: 40, counterpartyPlayerId: 1 }), context)
    ).toBe("CARLOS recibió $40 de DIANA")
  })

  it("says it was voided, with the reason", () => {
    expect(
      describeActivity(
        transfer({ amount: 40, correctsId: 7, note: "se equivocó de jugador" }),
        context
      )
    ).toBe("Se anuló la transferencia a CARLOS: DIANA recuperó $40 · se equivocó de jugador")
  })
})

describe("describeActivity: player_removed", () => {
  const removed = (partial: Partial<ActivityEntry>) =>
    transfer({
      type: "player_removed",
      counterpartyPlayerId: null,
      transferId: null,
      ...partial,
    })

  it("says the balance they opened with and the one they leave with", () => {
    expect(
      describeActivity(removed({ amount: -30, note: "-20.00" }), context)
    ).toBe("DIANA se retiró de la jornada · entró con -$20 · sale con -$30")
    expect(
      describeActivity(removed({ amount: 15, note: "0.00" }), context)
    ).toBe("DIANA se retiró de la jornada · entró con $0 · sale con +$15")
  })

  it("explains the whole balance with the full summary", () => {
    expect(
      describeActivity(
        removed({
          amount: 40,
          note: '{"opening" : -5.00, "recharges" : 30.00, "played" : 30.00, "prizes" : 50.00, "payouts" : -5.00, "transfers" : 0}',
        }),
        context
      )
    ).toBe(
      "DIANA se retiró de la jornada · entró con -$5 · recargó $30 · jugó $30 · ganó $50 en premios · se le pagaron $5 · sale con +$40"
    )
    expect(
      describeActivity(
        removed({
          amount: 0,
          note: '{"opening" : 0, "recharges" : 0, "played" : 0.00, "prizes" : 0, "payouts" : 0, "transfers" : 0}',
        }),
        context
      )
    ).toBe("DIANA se retiró de la jornada · entró con $0 · sale con $0")
  })

  it("adds the prizes they won when the note has them", () => {
    expect(
      describeActivity(removed({ amount: 40, note: '{"opening" : 0.00, "prizes" : 50.00}' }), context)
    ).toBe("DIANA se retiró de la jornada · entró con $0 · ganó $50 en premios · sale con +$40")
    expect(
      describeActivity(removed({ amount: -10, note: '{"opening" : 0.00, "prizes" : 0}' }), context)
    ).toBe("DIANA se retiró de la jornada · entró con $0 · sale con -$10")
  })

  it("keeps the old sentence for rows written before the balances", () => {
    expect(describeActivity(removed({ amount: 0, note: null }), context)).toBe(
      "DIANA fue retirado de la jornada"
    )
  })
})

describe("describeActivity: check_in", () => {
  it("says when a recharge checked the player in", () => {
    expect(
      describeActivity(
        transfer({ type: "check_in", amount: null, note: "recharge", counterpartyPlayerId: null, transferId: null }),
        context
      )
    ).toBe("DIANA quedó en la ronda al recargar (check-in automático)")
  })
})
