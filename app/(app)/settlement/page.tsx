import { LiveRefresh } from "@/components/live-refresh"
import { SettlementList } from "@/components/settlement-list"
import { listSettlements } from "@/lib/data/settlement"
import { pageTitle } from "@/lib/page-titles"

export const metadata = { title: pageTitle("/settlement") }

export default async function Page() {
  const settlements = await listSettlements()

  return (
    <div className="flex flex-1 flex-col px-4 lg:px-6">
      <SettlementList settlements={settlements} />
      <LiveRefresh />
    </div>
  )
}
