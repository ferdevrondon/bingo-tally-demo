import Link from "next/link"

import { LiveRefresh } from "@/components/live-refresh"
import { SettlementPage } from "@/components/settlement-page"
import { Button } from "@/components/ui/button"
import { loadSettlement } from "@/lib/data/settlement"

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const gameSessionId = Number(id)
  const settlement =
    Number.isInteger(gameSessionId) && gameSessionId > 0
      ? await loadSettlement(gameSessionId)
      : null

  if (!settlement) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-muted-foreground">No se encontró la liquidación.</p>
        <Button variant="outline" nativeButton={false} render={<Link href="/settlement" />}>
          Ver liquidaciones
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col px-4 lg:px-6">
      <SettlementPage settlement={settlement} />
      <LiveRefresh />
    </div>
  )
}
