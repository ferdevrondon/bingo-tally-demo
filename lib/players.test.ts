import { describe, expect, it } from "vitest"

import { playerInputSchema } from "./players"

const base = { nickname: "", paymentMethod: null, bank: null, phone: "", email: "", isVip: false }

describe("playerInputSchema", () => {
  it("only needs the name", () => {
    expect(playerInputSchema.safeParse({ ...base, name: "ana" }).success).toBe(true)
    expect(playerInputSchema.safeParse({ ...base, name: "  " }).success).toBe(false)
  })

  it("keeps the contact tidy: trimmed phone, lowercase email", () => {
    const parsed = playerInputSchema.parse({
      ...base,
      name: "ana",
      phone: " +1 555 123 ",
      email: " Ana@Correo.COM ",
    })
    expect(parsed).toMatchObject({ name: "ANA", phone: "+1 555 123", email: "ana@correo.com" })
  })

  it("rejects a malformed email or a long phone", () => {
    expect(playerInputSchema.safeParse({ ...base, name: "ana", email: "ana@" }).success).toBe(false)
    expect(playerInputSchema.safeParse({ ...base, name: "ana", phone: "1".repeat(31) }).success).toBe(false)
  })
})
