// One color per player, in the order they joined: the 5 chart tokens first,
// then Tailwind tones that read with white text. Amber (free numbers) and
// plain red (gifts) are left out so a player never looks like either.
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

export function getPlayerColorClass(playerIndex: number): string {
  if (playerIndex < 0) return "bg-muted"
  return PLAYER_COLOR_CLASSES[playerIndex % PLAYER_COLOR_CLASSES.length]
}
