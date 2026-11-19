// How the numbers of the tickets are colored. "unicolor" (the default): a free
// number is a light tint of the primary color and a taken one the same color
// solid, whoever took it (the owner's name is on the cell). "multicolor": one
// color per player, free numbers amber. Later the house will choose; for now
// this constant is the only switch.
export type PlayerColorMode = "unicolor" | "multicolor"
export const PLAYER_COLOR_MODE: PlayerColorMode = "unicolor"

// One color per player, in the order they joined: the 5 chart tokens first,
// then Tailwind tones that read with white text. Amber (free numbers in
// multicolor) and plain red (gifts) are left out so a player never looks like
// either.
const PLAYER_COLOR_CLASSES = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
  "bg-violet-500",
  "bg-sky-600",
  "bg-emerald-600",
  "bg-rose-500",
  "bg-orange-500",
  "bg-cyan-600",
  "bg-fuchsia-500",
  "bg-lime-600",
  "bg-indigo-500",
  "bg-teal-600",
  "bg-pink-500",
]

/** Always one color per player: for reports and charts, where the color tells
 *  players apart whatever the color mode of the tickets is. */
export function getPlayerChartColorClass(playerIndex: number): string {
  if (playerIndex < 0) return "bg-muted"
  return PLAYER_COLOR_CLASSES[playerIndex % PLAYER_COLOR_CLASSES.length]
}

/** The solid color of a player on the tickets and their chips. */
export function getPlayerColorClass(playerIndex: number): string {
  if (PLAYER_COLOR_MODE === "unicolor") return "bg-primary"
  return getPlayerChartColorClass(playerIndex)
}

// Tickets (unicolor): one teal hue in three steps of lightness. The player
// being edited, or picked to take numbers, is the bright turquoise, the numbers other players hold are the dark
// teal and the free ones the lightest.
const GIFT_BORDER = "border-2 border-dashed border-foreground/40"

/** The numbers of the player being edited. */
export function getEditingNumberClasses(isGift: boolean): string {
  return [
    "bg-[#2dd4bf] border-transparent text-[#042f2e]",
    isGift && GIFT_BORDER,
  ]
    .filter(Boolean)
    .join(" ")
}

/** The numbers other players already hold. */
export function getOtherPlayerEditNumberClasses(isGift: boolean): string {
  return ["bg-[#0f766e] border-transparent text-white", isGift && GIFT_BORDER]
    .filter(Boolean)
    .join(" ")
}

/** The numbers still free to take. */
export const EDIT_FREE_NUMBER_CLASSES =
  "bg-[#f0fdfa] border-[#99f6e4] text-[#115e59] dark:bg-[#0b1f1e] dark:border-[#134e4a] dark:text-[#99f6e4]"

export const EDIT_FREE_NUMBER_HOVER_CLASSES =
  "hover:bg-[#ccfbf1] dark:hover:bg-[#134e4a]"

/** A free number: white with black text in unicolor (amber tint in
 *  multicolor), so it reads apart from the solid taken number. Add hover
 *  styles where the cell can be taken. */
export const FREE_NUMBER_CLASSES =
  PLAYER_COLOR_MODE === "unicolor"
    ? EDIT_FREE_NUMBER_CLASSES
    : "border-warning/40 bg-warning/10 text-warning"

/** The hover tint of a free number that can be taken. */
export const FREE_NUMBER_HOVER_CLASSES =
  PLAYER_COLOR_MODE === "unicolor"
    ? EDIT_FREE_NUMBER_HOVER_CLASSES
    : "hover:bg-warning/20"

/** A taken number: the player's solid color; gifts get the dashed border. In
 *  unicolor, `isActive` (the player being edited or picked) is the bright
 *  turquoise and everyone else's numbers the dark teal. */
export function getTakenNumberClasses(
  playerIndex: number,
  isGift: boolean,
  isActive = false
): string {
  if (PLAYER_COLOR_MODE === "unicolor") {
    return isActive
      ? getEditingNumberClasses(isGift)
      : getOtherPlayerEditNumberClasses(isGift)
  }
  return [
    getPlayerColorClass(playerIndex),
    "border-transparent text-white",
    isGift && "border-2 border-dashed border-foreground/40",
  ]
    .filter(Boolean)
    .join(" ")
}
