const PLAYER_COLOR_CLASSES = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
]

export function getPlayerColorClass(playerIndex: number): string {
  if (playerIndex < 0) return "bg-muted"
  return PLAYER_COLOR_CLASSES[playerIndex % PLAYER_COLOR_CLASSES.length]
}
