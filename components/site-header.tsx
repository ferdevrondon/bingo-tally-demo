"use client"

import { EyeIcon, MenuIcon } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { useRole } from "@/components/house-provider"
import { Badge } from "@/components/ui/badge"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { titleFont } from "@/lib/fonts"
import { cn } from "@/lib/utils"
import { pageTitle } from "@/lib/page-titles"

export function SiteHeader() {
  const pathname = usePathname()
  // Observers see everything but can change nothing (the database enforces it).
  const isObserver = useRole() === "observer"
  const readOnlyBadge = (className: string) =>
    isObserver && (
      <Badge variant="outline" className={cn("gap-1", className)}>
        <EyeIcon className="size-3" aria-hidden="true" />
        Solo lectura
      </Badge>
    )
  return (
    <header className="flex shrink-0 flex-col border-b transition-[width,height] ease-linear max-lg:sticky max-lg:top-0 max-lg:z-30 max-lg:bg-background lg:h-(--header-height) lg:flex-row lg:items-center lg:group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      {/* Below lg the sidebar is a drawer: menu, brand and status on one row, the page title below. */}
      <div className="grid h-14 grid-cols-[1fr_auto_1fr] items-center px-2 lg:hidden">
        <SidebarTrigger className="size-11 justify-self-start">
          <MenuIcon className="size-5" />
        </SidebarTrigger>
        <Link
          href="/"
          aria-label="Inicio"
          className="flex h-11 items-center justify-center gap-2 px-2"
        >
          <Image
            src="/assets/img/logo.svg"
            alt=""
            width={24}
            height={24}
            className="size-6"
          />
          <span
            className={cn(
              "hidden text-xl font-semibold min-[360px]:inline",
              titleFont.className
            )}
          >
            Bingo Tally.
          </span>
        </Link>
        <div className="justify-self-end pr-2">{readOnlyBadge("")}</div>
      </div>
      <div className="flex w-full min-w-0 items-center gap-2 px-4 pb-3 lg:px-6 lg:pb-0">
        <h1 className="truncate text-base font-medium">
          {pageTitle(pathname)}
        </h1>
        {readOnlyBadge("ml-auto hidden lg:inline-flex")}
      </div>
    </header>
  )
}
