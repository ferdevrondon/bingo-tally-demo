"use client"

import * as React from "react"
import { MoonIcon, SunIcon } from "lucide-react"
import { useTheme } from "next-themes"

import { Switch } from "@/components/ui/switch"

const subscribe = () => () => {}

// Light/dark theme of this device (next-themes keeps it in localStorage). Until
// the page is on the client the theme is unknown, so the switch waits.
export default function AppearanceSettings() {
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = React.useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  )
  const isDark = mounted && resolvedTheme === "dark"

  return (
    <div className="grid grid-cols-1 gap-10 px-2 py-6 lg:grid-cols-3">
      <div className="flex flex-col space-y-1">
        <h3 className="font-semibold">Apariencia</h3>
        <p className="text-sm text-muted-foreground">
          Elige el tema de la aplicación en este dispositivo.
        </p>
      </div>

      <div className="lg:col-span-2">
        <label
          htmlFor="theme-switch"
          className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border p-4"
        >
          <span className="flex items-center gap-3">
            {isDark ? (
              <MoonIcon className="size-5" aria-hidden="true" />
            ) : (
              <SunIcon className="size-5" aria-hidden="true" />
            )}
            <span className="flex flex-col">
              <span className="text-sm font-medium">Modo oscuro</span>
              <span className="text-sm text-muted-foreground">
                También puedes cambiarlo con la tecla D.
              </span>
            </span>
          </span>
          <Switch
            id="theme-switch"
            checked={isDark}
            disabled={!mounted}
            onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
          />
        </label>
      </div>
    </div>
  )
}
