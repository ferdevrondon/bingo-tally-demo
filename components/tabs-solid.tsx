"use client"

import { ConstructionIcon } from "lucide-react"

import SessionPage from "@/components/session-page"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RoundHistoryCard } from "./round-history-card"

const tabs = [
  { name: "Jornadas", value: "jornadas" },
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

function ReportsTabs() {
  return (
    <Tabs defaultValue="jornadas" className="w-full gap-4">
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

      <TabsContent value="jornadas">
        <SessionPage />
      </TabsContent>
        <TabsContent value="rondas" className="px-4 lg:px-6">
        <RoundHistoryCard />
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
