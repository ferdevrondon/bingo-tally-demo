"use client"

import * as React from "react"
import { ArrowLeftRightIcon, HistoryIcon, PlusIcon } from "lucide-react"

import { BalanceRail } from "@/components/balance-dialog-parts"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

export type BalanceTab = "money" | "transfer" | "movements"

export interface BalanceTabConfig {
  value: BalanceTab
  label: string
  /** Shown instead of the panel's tab being usable (e.g. "Solo con saldo a favor"). */
  disabled?: boolean
  content: React.ReactNode
}

const TAB_ICONS = {
  money: PlusIcon,
  transfer: ArrowLeftRightIcon,
  movements: HistoryIcon,
} satisfies Record<BalanceTab, React.ComponentType<{ className?: string }>>

/** Title of a panel when it is not the menu label. */
const TAB_TITLES: Partial<Record<BalanceTab, string>> = {
  transfer: "Transferir saldo",
}

// From `sm` the menu is a vertical rail; below it, a segmented control.
const WIDE_QUERY = "(min-width: 640px)"

function subscribeWide(onChange: () => void) {
  const mql = window.matchMedia(WIDE_QUERY)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

function useIsWide() {
  return React.useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE_QUERY).matches,
    () => true
  )
}

// "Saldo" of a player: one dialog for everything that changes their balance
// by hand. A left rail (identical in every tab) shows who the player is, their
// balance and the menu: the cash move (Recarga in the live game, Cobro / Pago
// in /players), the transfer to another player and the latest movements (where
// they are corrected or voided). Each panel stays mounted while the dialog is
// open, so a half-typed amount survives a visit to another tab. The panels are
// the forms in player-recharge-form.tsx, account-movement-dialog.tsx,
// balance-transfer-form.tsx and recent-movements-panel.tsx.
export function PlayerBalanceDialog({
  open,
  onOpenChange,
  name,
  subtitle,
  balance,
  initialTab = "money",
  tabs,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  name: string
  /** Signed balance shown in the rail's card. */
  balance: number
  /** Bottom of the rail, e.g. "Última recarga hace 18 segundos". */
  subtitle?: string
  initialTab?: BalanceTab
  tabs: BalanceTabConfig[]
}) {
  const [tab, setTab] = React.useState<BalanceTab>(initialTab)
  const isWide = useIsWide()

  // Open on the requested tab each time (state adjusted during render).
  const [wasOpen, setWasOpen] = React.useState(false)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setTab(initialTab)
  }

  const current = tabs.find((t) => t.value === tab) ?? tabs[0]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:w-full sm:max-w-[760px]">
        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as BalanceTab)}
          orientation={isWide ? "vertical" : "horizontal"}
          className="min-h-0 flex-1 gap-0 sm:grid sm:grid-cols-[210px_minmax(0,1fr)]"
        >
          <BalanceRail name={name} balance={balance} note={subtitle}>
            <TabsList
              variant="line"
              className="grid h-auto w-full grid-cols-3 gap-0 rounded-full bg-muted p-1 sm:flex sm:flex-col sm:items-stretch sm:gap-1 sm:rounded-none sm:bg-transparent sm:p-0"
            >
              {tabs.map((t) => {
                const Icon = TAB_ICONS[t.value]
                return (
                  <TabsTrigger
                    key={t.value}
                    value={t.value}
                    disabled={t.disabled}
                    className={cn(
                      "h-8 rounded-full border-0 px-2 text-xs font-normal text-muted-foreground after:hidden",
                      // Active: gray fill and the primary color (text, icon).
                      "data-active:bg-background data-active:font-medium data-active:text-primary data-active:shadow-sm data-active:hover:text-primary dark:data-active:bg-background dark:data-active:text-primary dark:data-active:hover:text-primary",
                      "sm:h-9 sm:justify-start sm:gap-2.5 sm:rounded-lg sm:px-2.5 sm:text-[13px] sm:hover:bg-muted/50 sm:data-active:bg-muted sm:data-active:shadow-none sm:dark:data-active:bg-muted",
                      // Rail: a primary bar on the left edge of the active item.
                      "before:absolute before:inset-y-1.5 before:left-0 before:hidden before:w-0.5 before:rounded-full before:bg-primary sm:data-active:before:block"
                    )}
                  >
                    <Icon className="hidden sm:block" />
                    {t.label}
                  </TabsTrigger>
                )
              })}
            </TabsList>
          </BalanceRail>

          <div className="flex min-h-0 flex-col gap-4 overflow-y-auto p-5">
            <DialogTitle className="pr-9 text-[15px] font-medium">
              {TAB_TITLES[current.value] ?? current.label}
            </DialogTitle>
            {tabs.map((t) => (
              <TabsContent
                key={t.value}
                value={t.value}
                keepMounted
                className="flex min-h-0 flex-col [&[hidden]]:hidden"
              >
                {t.content}
              </TabsContent>
            ))}
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
