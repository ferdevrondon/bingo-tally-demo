import { describe, expect, it } from "vitest"

import { isJwtError } from "@/lib/supabase/expired-session"

describe("isJwtError", () => {
  it("matches PostgREST JWT error codes", () => {
    expect(isJwtError({ code: "PGRST303", message: "JWT expired" })).toBe(true)
    expect(
      isJwtError({
        code: "PGRST301",
        message: "No suitable key or wrong key type",
      })
    ).toBe(true)
  })

  it("matches a JWT message without a code", () => {
    expect(isJwtError({ message: "JWT expired" })).toBe(true)
  })

  it("ignores other errors", () => {
    expect(isJwtError(null)).toBe(false)
    expect(isJwtError({ code: "42501", message: "not_admin" })).toBe(false)
    expect(isJwtError({ code: "P0001", message: "number_taken" })).toBe(false)
  })
})
