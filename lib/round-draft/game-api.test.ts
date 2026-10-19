import { beforeEach, describe, expect, it, vi } from "vitest"

import { SESSION_EXPIRED_PATH } from "@/lib/admin-session-paths"

const JWT_EXPIRED = { code: "PGRST303", message: "JWT expired", details: "", hint: "" }

const supabase = {
  rpc: vi.fn(),
  auth: { refreshSession: vi.fn(), signOut: vi.fn() },
}
vi.mock("@/lib/supabase/client", () => ({ createClient: () => supabase }))

const replace = vi.fn()
vi.stubGlobal("window", { location: { replace } })

const { createGameApi } = await import("@/lib/round-draft/game-api")

beforeEach(() => {
  vi.clearAllMocks()
  supabase.auth.signOut.mockResolvedValue({ error: null })
})

describe("game api with an expired access token", () => {
  it("refreshes the session and retries with the same request_id", async () => {
    supabase.rpc
      .mockResolvedValueOnce({ data: null, error: JWT_EXPIRED })
      .mockResolvedValueOnce({ data: null, error: null })
    supabase.auth.refreshSession.mockResolvedValue({ data: { session: {} }, error: null })

    const result = await createGameApi(true).closeRound(7, 3, "req-1")

    expect(result).toEqual({ ok: true, data: null })
    expect(supabase.auth.refreshSession).toHaveBeenCalledTimes(1)
    expect(supabase.rpc).toHaveBeenCalledTimes(2)
    expect(supabase.rpc.mock.calls[1]).toEqual(supabase.rpc.mock.calls[0])
    expect(supabase.rpc.mock.calls[1][1]).toMatchObject({ p_request_id: "req-1" })
    expect(replace).not.toHaveBeenCalled()
  })

  it("signs out and sends the admin to /login when the refresh fails", async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: JWT_EXPIRED })
    supabase.auth.refreshSession.mockResolvedValue({
      data: { session: null },
      error: { message: "Invalid Refresh Token: Refresh Token Not Found" },
    })

    const result = await createGameApi(true).awardPrize(7, 1, 12, "req-2")

    expect(result).toEqual({ ok: false, error: "session_expired" })
    expect(supabase.rpc).toHaveBeenCalledTimes(1)
    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: "local" })
    expect(replace).toHaveBeenCalledWith(SESSION_EXPIRED_PATH)
  })
})
