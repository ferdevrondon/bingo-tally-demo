"use client"

import { ArrowUpIcon } from "lucide-react"
import * as React from "react"

import { cn } from "@/lib/utils"

// How close to the end of the page (px) the button shows up.
const NEAR_BOTTOM = 240

/** Whether the page is long (over two screens) and scrolled near its end. */
function nearBottom(): boolean {
  const { scrollY, innerHeight } = window
  const height = document.documentElement.scrollHeight
  return (
    height > innerHeight * 2 && scrollY + innerHeight >= height - NEAR_BOTTOM
  )
}

// "Volver arriba": a round button at the bottom-right corner that shows up
// when the user reaches the end of a long page (/active-round) and takes them
// back to the top. Toasts are top-center and "La casa" is pinned top-right,
// so the corner is free. The page itself scrolls (the window), not a panel.
export function BackToTopButton({ className }: { className?: string }) {
  const [visible, setVisible] = React.useState(false)

  React.useEffect(() => {
    let frame = 0
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => setVisible(nearBottom()))
    }
    update()
    window.addEventListener("scroll", update, { passive: true })
    window.addEventListener("resize", update)
    // The page grows and shrinks as the game re-syncs (cards, activity).
    const observer = new ResizeObserver(update)
    observer.observe(document.body)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("scroll", update)
      window.removeEventListener("resize", update)
      observer.disconnect()
    }
  }, [])

  function goTop() {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" })
    // Keyboard and screen reader users land at the top too.
    const heading = document.querySelector<HTMLElement>("main h1")
    if (heading) {
      if (!heading.hasAttribute("tabindex"))
        heading.setAttribute("tabindex", "-1")
      heading.focus({ preventScroll: true })
    }
  }

  return (
    <button
      type="button"
      onClick={goTop}
      aria-label="Volver arriba"
      title="Volver arriba"
      inert={!visible}
      className={cn(
        "fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-30 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-1 ring-primary/30 transition-[opacity,transform,background-color] duration-200 outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/60 motion-reduce:transition-none lg:right-6 lg:bottom-6",
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-3 opacity-0",
        className
      )}
    >
      <ArrowUpIcon className="size-5" strokeWidth={2.5} aria-hidden="true" />
    </button>
  )
}
