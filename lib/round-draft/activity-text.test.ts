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
