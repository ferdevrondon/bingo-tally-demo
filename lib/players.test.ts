import { describe, expect, it } from "vitest"

import { playerInputSchema, playerMatchesQuery } from "./players"

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

describe("playerMatchesQuery", () => {
  const ana = { name: "MARÍA JOSÉ", nickname: "PEPA", phone: "555-0101", email: "maria@example.com" }

  it("ignores case and accents", () => {
    expect(playerMatchesQuery(ana, "maria")).toBe(true)
    expect(playerMatchesQuery(ana, "JOSE")).toBe(true)
  })

  it("matches the nickname, phone and email too", () => {
    expect(playerMatchesQuery(ana, "pepa")).toBe(true)
    expect(playerMatchesQuery(ana, "0101")).toBe(true)
    expect(playerMatchesQuery(ana, "example.com")).toBe(true)
  })

  it("matches everyone on an empty search and nobody on a miss", () => {
    expect(playerMatchesQuery(ana, "   ")).toBe(true)
    expect(playerMatchesQuery(ana, "zoe")).toBe(false)
  })
})
