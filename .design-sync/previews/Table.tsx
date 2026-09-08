import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Badge,
} from "next-appyy"

const players = [
  { name: "Juan Pérez", cartones: 2, saldo: "$40", estado: "Al día" },
  { name: "María López", cartones: 1, saldo: "-$10", estado: "Debe" },
  { name: "Carlos Ruiz", cartones: 3, saldo: "$0", estado: "Al día" },
]

export function Default() {
  return (
    <Table className="w-[28rem]">
      <TableHeader>
        <TableRow>
          <TableHead>Jugador</TableHead>
          <TableHead>Cartones</TableHead>
          <TableHead>Saldo</TableHead>
          <TableHead>Estado</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {players.map((p) => (
          <TableRow key={p.name}>
            <TableCell>{p.name}</TableCell>
            <TableCell>{p.cartones}</TableCell>
            <TableCell>{p.saldo}</TableCell>
            <TableCell>
              <Badge variant={p.estado === "Al día" ? "secondary" : "destructive"}>
                {p.estado}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
