import type { RoundDraftState } from "./types"

const STORAGE_KEY = "bingo:round-draft:v1"

export interface RoundDraftRepository {
  load(): RoundDraftState | null
  save(state: RoundDraftState): void
  clear(): void
}

// Works now via localStorage; swap this implementation for an API-backed one
// once a real backend exists — RoundDraftProvider takes the repository as a
// prop, so no consuming component needs to change.
export const localRoundDraftRepository: RoundDraftRepository = {
  load() {
    if (typeof window === "undefined") return null
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      return raw ? (JSON.parse(raw) as RoundDraftState) : null
    } catch {
      return null
    }
  },
  save(state) {
    if (typeof window === "undefined") return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // ignore write failures (e.g. private browsing quota)
    }
  },
  clear() {
    if (typeof window === "undefined") return
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
  },
}
