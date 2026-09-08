import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
  Badge,
  Button,
} from "next-appyy"

export function Default() {
  return (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Números disponibles</CardTitle>
        <CardDescription>Números aún sin jugador asignado</CardDescription>
        <CardAction>
          <Badge variant="outline">14 sin jugador</Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Cada número muestra el monto pendiente por vender según los cartones donde
          sigue abierto.
        </p>
      </CardContent>
      <CardFooter>
        <Button size="sm" variant="outline">
          Ver detalle
        </Button>
      </CardFooter>
    </Card>
  )
}

export function Compact() {
  return (
    <Card size="sm" className="w-64">
      <CardHeader>
        <CardTitle>Cartones abiertos</CardTitle>
      </CardHeader>
      <CardContent>
        <span className="text-2xl font-bold">6</span>
      </CardContent>
    </Card>
  )
}
