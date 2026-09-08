import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectLabel,
  SelectItem,
} from "next-appyy"

const players = [
  { label: "Juan Pérez", value: "1" },
  { label: "María López", value: "2" },
  { label: "Carlos Ruiz", value: "3" },
]

export function Open() {
  return (
    <Select defaultOpen defaultValue="1" items={players}>
      <SelectTrigger className="w-56">
        <SelectValue placeholder="Selecciona un jugador activo" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Jugadores</SelectLabel>
          {players.map((p) => (
            <SelectItem key={p.value} value={p.value}>
              {p.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

export function Closed() {
  return (
    <Select defaultValue="1" items={players}>
      <SelectTrigger className="w-56">
        <SelectValue placeholder="Selecciona un jugador activo" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {players.map((p) => (
            <SelectItem key={p.value} value={p.value}>
              {p.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
