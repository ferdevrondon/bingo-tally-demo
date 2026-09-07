"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { RoundDraftProvider } from "@/lib/round-draft/context"

const steps = [
  { title: "Cartones y jugadores", href: "/cartones" },
  { title: "Resumen de ronda", href: "/cartones/resumen" },
]

function StepBreadcrumb() {
  const pathname = usePathname()

  return (
    <div className="border-b px-4 py-3 lg:px-6">
      <Breadcrumb>
        <BreadcrumbList>
          {steps.map((step, i) => {
            const isCurrent = pathname === step.href
            return (
              <React.Fragment key={step.href}>
                {i > 0 && <BreadcrumbSeparator />}
                <BreadcrumbItem>
                  {isCurrent ? (
                    <BreadcrumbPage>{step.title}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink render={<Link href={step.href} />}>
                      {step.title}
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </React.Fragment>
            )
          })}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  )
}

export default function CartonesLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoundDraftProvider>
      <div className="flex flex-1 flex-col">
        <StepBreadcrumb />
        {children}
      </div>
    </RoundDraftProvider>
  )
}
