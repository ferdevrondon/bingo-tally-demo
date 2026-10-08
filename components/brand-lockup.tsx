import Image from "next/image"

import { titleFont } from "@/fonts"
import { cn } from "@/lib/utils"

// The product lockup of the auth screens (login, session conflict): the logo,
// then "Bingo Tally" with the slogan under it, aligned with the wordmark.
// "aliada" carries a turquoise highlighter stripe (--brand-highlight).
export function BrandLockup({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Image src="/assets/img/logo.svg" alt="Bingo Tally" width={60} height={60} className="size-14 shrink-0" />
      <div className="flex min-w-0 flex-col items-start leading-tight">
        <span className={cn("text-2xl", titleFont.className)}>Bingo Tally</span>
        <span className="text-base font-medium text-muted-foreground">
          Tu guía{" "}
          <span className="bg-[linear-gradient(transparent_58%,var(--brand-highlight)_58%,var(--brand-highlight)_92%,transparent_92%)] px-1 font-bold text-foreground">
            aliada
          </span>
        </span>
      </div>
    </div>
  )
}
