"use client"

import * as React from "react"
import { MoonIcon, SunIcon } from "lucide-react"
import { useTheme } from "next-themes"

import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

const subscribe = () => () => {}

// Light/dark switch under "Configuración" in the sidebar. The whole row is one
// button (role="switch") and the track is only its picture. With the sidebar
// collapsed it shows just the icon. The theme is kept on the device by
// next-themes; until the page is on the client it is unknown, so the row waits.
export function ThemeMenuItem() {
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = React.useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  )
  const isDark = mounted && resolvedTheme === "dark"

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        role="switch"
        aria-checked={isDark}
        disabled={!mounted}
        tooltip="Modo oscuro"
        onClick={() => setTheme(isDark ? "light" : "dark")}
      >
        {isDark ? <MoonIcon /> : <SunIcon />}
        <span>Modo oscuro</span>
        <span
          aria-hidden="true"
          className={cn(
            "ml-auto flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors group-data-[collapsible=icon]:hidden",
            isDark ? "bg-primary" : "bg-input"
          )}
        >
          <span
            className={cn(
              "size-4 rounded-full bg-background shadow-sm transition-transform",
              isDark && "translate-x-4"
            )}
          />
        </span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
