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

/** A free number: a light tint (amber in multicolor). Add hover styles where
 *  the cell can be taken. */
export const FREE_NUMBER_CLASSES =
  PLAYER_COLOR_MODE === "unicolor"
    ? "border-primary/30 bg-primary/10 text-primary"
    : "border-warning/40 bg-warning/10 text-warning"

/** The hover tint of a free number that can be taken. */
export const FREE_NUMBER_HOVER_CLASSES =
  PLAYER_COLOR_MODE === "unicolor" ? "hover:bg-primary/20" : "hover:bg-warning/20"

/** A taken number: the player's solid color; gifts get the dashed border. */
export function getTakenNumberClasses(playerIndex: number, isGift: boolean): string {
  return [
    getPlayerColorClass(playerIndex),
    "border-transparent text-white",
    isGift && "border-2 border-dashed border-foreground/40",
  ]
    .filter(Boolean)
    .join(" ")
}
