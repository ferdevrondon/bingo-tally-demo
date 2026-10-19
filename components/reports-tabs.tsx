"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

// Reportes: each tab is its own route (Phase 6b), so reloading, sharing a
// link and "back" keep the tab.
const TABS = [
  { href: "/reports/games", label: "Jornadas" },
  { href: "/reports/rounds", label: "Rondas" },
  { href: "/reports/debts", label: "Deudas" },
  { href: "/reports/daily", label: "Diario" },
  { href: "/reports/monthly", label: "Mensual" },
]

export function ReportsTabs() {
  const pathname = usePathname()
  return (
    <nav
      aria-label="Reportes"
      className="mx-4 w-fit max-w-[calc(100%-2rem)] overflow-x-auto rounded-4xl bg-muted p-[3px] [scrollbar-width:none] lg:mx-6 lg:max-w-[calc(100%-3rem)] [&::-webkit-scrollbar]:hidden"
    >
      <ul className="flex w-max items-center gap-1">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`)
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-8 items-center rounded-xl px-3 text-sm font-medium whitespace-nowrap transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground/60 hover:text-foreground"
                )}
              >
                {tab.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
