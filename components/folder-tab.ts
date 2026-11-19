import { cn } from "@/lib/utils"

// A folder tab on the card's top edge: the shape is a `before:` trapezoid
// (perspective tilt) with rounded top corners, so the label stays straight.
// Inactive tabs keep their color; the active one takes the card's color and
// covers the card's top line so both read as one piece.
export const FOLDER_TAB = cn(
  "relative z-0 h-9 flex-none rounded-none border-0 px-5 pt-1 text-white hover:text-white dark:text-white dark:hover:text-white",
  "before:absolute before:inset-0 before:-z-10 before:origin-bottom before:[transform:perspective(14px)_rotateX(2deg)] before:rounded-t-xl",
  "after:hidden",
  "data-active:z-10 data-active:-mb-px data-active:bg-transparent data-active:text-foreground dark:data-active:border-transparent dark:data-active:bg-transparent dark:data-active:text-foreground",
  "data-active:before:bg-card data-active:before:shadow-[0_0_0_1px_color-mix(in_oklab,var(--foreground)_10%,transparent)] data-active:before:[clip-path:inset(-2px_-2px_0_-2px)]"
)
