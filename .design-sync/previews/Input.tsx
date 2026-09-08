import { Input } from "next-appyy"

export function Default() {
  return <Input placeholder="Nombre del jugador" />
}

export function WithValue() {
  return <Input defaultValue="Juan Pérez" />
}

export function Disabled() {
  return <Input placeholder="No disponible" disabled />
}

export function Invalid() {
  return <Input defaultValue="ab" aria-invalid />
}
