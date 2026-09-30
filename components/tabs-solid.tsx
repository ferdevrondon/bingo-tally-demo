"use client"

import * as React from "react"
import { ConstructionIcon } from "lucide-react"

import GamePage from "@/components/game-page"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { GameSessionListItem } from "@/lib/game-report/types"

const tabs = [
  { name: "Jornadas", value: "games" },
  { name: "Rondas", value: "rondas" },
  { name: "Deudas", value: "deudas" },
  { name: "Mensual", value: "mensual" },
  { name: "Diario", value: "diario" },
]

function ComingSoonPanel({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-card py-16 text-center ring-1 ring-foreground/10">
      <ConstructionIcon className="size-8 text-muted-foreground" />
      <p className="text-sm font-medium text-foreground">
        Sección &quot;{label}&quot; en construcción
      </p>
      <p className="text-sm text-muted-foreground">
        Pronto podrás ver aquí el reporte de {label.toLowerCase()}.
      </p>
    </div>
  )
}

// Rounds by date, debts, daily and monthly reports come in Phase 6b.
function ReportsTabs({ games }: { games: GameSessionListItem[] }) {
  return (
    <Tabs defaultValue="games" className="w-full gap-4">
      <TabsList className="mx-4 bg-background lg:mx-6">
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            className="data-active:bg-primary! data-active:text-primary-foreground! dark:data-active:border-transparent!"
          >
            {tab.name}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="games">
        <GamePage games={games} />
      </TabsContent>
      <TabsContent value="rondas" className="px-4 lg:px-6">
        <ComingSoonPanel label="Rondas" />
      </TabsContent>
      <TabsContent value="deudas" className="px-4 lg:px-6">
        <ComingSoonPanel label="Deudas" />
      </TabsContent>
      <TabsContent value="mensual" className="px-4 lg:px-6">
        <ComingSoonPanel label="Mensual" />
      </TabsContent>
      <TabsContent value="diario" className="px-4 lg:px-6">
        <ComingSoonPanel label="Diario" />
      </TabsContent>
    </Tabs>
  )
}

export default ReportsTabs
