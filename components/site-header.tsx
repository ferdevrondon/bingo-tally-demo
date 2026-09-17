"use client";

import { usePathname } from "next/navigation"

export function SiteHeader() {
  const pathname = usePathname();
  const cleanpath = pathname.slice(1).toUpperCase();
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <h1 className="text-base font-medium">{cleanpath}</h1>
      </div>
    </header>
  )
}
