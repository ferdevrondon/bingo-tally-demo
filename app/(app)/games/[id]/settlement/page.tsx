import { notFound } from "next/navigation"

import { LiveRefresh } from "@/components/live-refresh"
import { SettlementPage } from "@/components/settlement-page"
import { loadSettlement } from "@/lib/data/settlement"

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const gameSessionId = Number(id)
  if (!Number.isInteger(gameSessionId) || gameSessionId <= 0) notFound()

  const settlement = await loadSettlement(gameSessionId)
  if (!settlement) notFound()

  return (
    <div className="flex flex-1 flex-col px-4 lg:px-6">
      <SettlementPage settlement={settlement} />
      <LiveRefresh />
    </div>
  )
}
