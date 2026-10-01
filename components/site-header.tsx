"use client"

import { EyeIcon } from "lucide-react"
import { usePathname } from "next/navigation"

import { useRole } from "@/components/house-provider"
import { Badge } from "@/components/ui/badge"
import { pageTitle } from "@/lib/page-titles"

export function SiteHeader() {
  const pathname = usePathname()
  // Observers see everything but can change nothing (the database enforces it).
  const isObserver = useRole() === "observer"
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <h1 className="text-base font-medium">{pageTitle(pathname)}</h1>
        {isObserver && (
          <Badge variant="outline" className="ml-auto gap-1">
            <EyeIcon className="size-3" aria-hidden="true" />
            Solo lectura
          </Badge>
        )}
      </div>
    </header>
  )
}
