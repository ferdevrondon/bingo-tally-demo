import { Label, Input } from "next-appyy"

export function Default() {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="player-name">Nombre del jugador</Label>
      <Input id="player-name" placeholder="Juan Pérez" />
    </div>
  )
}

export function Disabled() {
  return (
    <div className="group flex flex-col gap-1.5" data-disabled="true">
      <Label>Saldo pendiente</Label>
      <Input disabled placeholder="No disponible" />
    </div>
  )
}
