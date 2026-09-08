import { Tabs, TabsList, TabsTrigger, TabsContent } from "next-appyy"

export function Default() {
  return (
    <Tabs defaultValue="players" className="w-80">
      <TabsList>
        <TabsTrigger value="players">Jugadores</TabsTrigger>
        <TabsTrigger value="rounds">Rondas</TabsTrigger>
        <TabsTrigger value="history">Historial</TabsTrigger>
      </TabsList>
      <TabsContent value="players">
        <p className="text-sm text-muted-foreground">6 jugadores activos en esta ronda.</p>
      </TabsContent>
      <TabsContent value="rounds">
        <p className="text-sm text-muted-foreground">3 rondas jugadas hoy.</p>
      </TabsContent>
      <TabsContent value="history">
        <p className="text-sm text-muted-foreground">Sin historial todavía.</p>
      </TabsContent>
    </Tabs>
  )
}

export function LineVariant() {
  return (
    <Tabs defaultValue="players" className="w-80">
      <TabsList variant="line">
        <TabsTrigger value="players">Jugadores</TabsTrigger>
        <TabsTrigger value="rounds">Rondas</TabsTrigger>
      </TabsList>
      <TabsContent value="players">
        <p className="text-sm text-muted-foreground">6 jugadores activos en esta ronda.</p>
      </TabsContent>
      <TabsContent value="rounds">
        <p className="text-sm text-muted-foreground">3 rondas jugadas hoy.</p>
      </TabsContent>
    </Tabs>
  )
}
