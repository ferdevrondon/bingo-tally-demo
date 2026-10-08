import { describe, expect, it } from "vitest"

import { houseInputSchema, passwordSchema, timezoneOptions } from "./house-settings"

describe("houseInputSchema", () => {
  it("trims the name and uppercases the identifier", () => {
    const parsed = houseInputSchema.parse({
      name: "  Casa Demo ",
      identifier: " casa-demo-1 ",
      timezone: "America/Chicago",
      phone: " 555 ",
    })
    expect(parsed).toEqual({
      name: "Casa Demo",
      identifier: "CASA-DEMO-1",
      timezone: "America/Chicago",
      phone: "555",
    })
  })

  it("rejects identifiers with spaces or too short", () => {
    const base = { name: "Casa", timezone: "America/Chicago", phone: "" }
    expect(houseInputSchema.safeParse({ ...base, identifier: "CASA DEMO" }).success).toBe(false)
    expect(houseInputSchema.safeParse({ ...base, identifier: "AB" }).success).toBe(false)
  })
})

describe("passwordSchema", () => {
  it("needs 8 characters and a matching confirmation", () => {
    expect(passwordSchema.safeParse({ password: "short", confirm: "short" }).success).toBe(false)
    expect(passwordSchema.safeParse({ password: "longenough", confirm: "different" }).success).toBe(false)
    expect(passwordSchema.safeParse({ password: "longenough", confirm: "longenough" }).success).toBe(true)
  })
})

describe("timezoneOptions", () => {
  it("keeps the house's zone when it isn't in the list", () => {
    expect(timezoneOptions("Europe/Madrid")[0]).toEqual({ value: "Europe/Madrid", label: "Europe/Madrid" })
    expect(timezoneOptions("America/Chicago")[0].value).toBe("America/Chicago")
  })
})
