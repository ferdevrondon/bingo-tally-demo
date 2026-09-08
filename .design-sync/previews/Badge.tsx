import { Badge } from "next-appyy"

export function Variants() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="default">Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="outline">Outline</Badge>
      <Badge variant="destructive">Destructive</Badge>
      <Badge variant="ghost">Ghost</Badge>
    </div>
  )
}

export function InContext() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="outline">14 número(s) sin jugador</Badge>
      <Badge>Ronda activa</Badge>
    </div>
  )
}
