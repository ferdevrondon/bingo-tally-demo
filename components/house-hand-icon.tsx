import { cn } from "@/lib/utils"

/** "La casa" (the live game's house result), drawn like a lucide icon
 *  (currentColor stroke). Closed: a house with a hand holding a "$" inside.
 *  Open: the roof lifts and the walls turn into a banknote on the floor, the
 *  amount shows below it (components/page-heading.tsx). The change animates
 *  with CSS; reduced motion skips it. */
export function HouseCashIcon({ open, className }: { open: boolean; className?: string }) {
  const fade = "transition-opacity duration-300 motion-reduce:transition-none"
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* roof: lifts and tilts when open */}
      <g
        className="transition-transform duration-300 motion-reduce:transition-none"
        style={{
          transformBox: "view-box",
          transformOrigin: "24px 21px",
          transform: open ? "translateY(-4px) rotate(-4deg)" : "none",
        }}
      >
        <path d="M6 21 24 5l18 16Z" />
      </g>

      {/* closed: the walls, with a hand holding a "$" */}
      <g className={cn(fade, open ? "opacity-0" : "opacity-100")}>
        <path d="M9 21v20h30V21" />
        <path d="M9 41h30" />
        <g transform="translate(12.5 20.5)" strokeWidth="2.2">
          <path d="M11 15h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 17" />
          <path d="m7 21 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9" />
        </g>
        <path
          d="M27.1 24.2h-2.4a1.1 1.1 0 0 0 0 2.2h1.6a1.1 1.1 0 0 1 0 2.2h-2.4M25.5 23v6.8"
          strokeWidth="1.8"
        />
      </g>

      {/* open: a banknote on the floor */}
      <g className={cn(fade, open ? "opacity-100" : "opacity-0")}>
        <rect x="6" y="24" width="36" height="16" rx="2" />
        <rect x="10" y="28" width="28" height="8" rx="1" strokeWidth="1.6" />
        <path
          d="M26.2 29.4h-2.8a1.2 1.2 0 0 0 0 2.4h1.4a1.2 1.2 0 0 1 0 2.4h-2.8M24 28v7.6"
          strokeWidth="1.8"
        />
        <path d="M5 45h38" />
      </g>
    </svg>
  )
}
