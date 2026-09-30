import { DebtsReport } from "@/components/debts-report"
import { LiveRefresh } from "@/components/live-refresh"
import { listDebts } from "@/lib/data/debts"

export default async function Page() {
  const rows = await listDebts()
  return (
    <>
      <DebtsReport rows={rows} />
      <LiveRefresh />
    </>
  )
}
