import * as React from "react"

const TICK_MS = 30_000

let now = Date.now()
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setInterval> | null = null

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  if (timer === null) {
    now = Date.now()
    timer = setInterval(() => {
      now = Date.now()
      listeners.forEach((listener) => listener())
    }, TICK_MS)
  }
  return () => {
    listeners.delete(onChange)
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer)
      timer = null
    }
  }
}

function getSnapshot() {
  return now
}

function getServerSnapshot() {
  return null
}

/** The current time, refreshed every 30 s. Null on the server and during
 *  hydration, so text derived from it ("hace 2 minutos") never mismatches. */
export function useNow(): number | null {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
