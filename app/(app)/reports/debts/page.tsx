import { DebtsReport } from "@/components/debts-report"
import { LiveRefresh } from "@/components/live-refresh"
import { listDebts } from "@/lib/data/debts"
import { pageTitle } from "@/lib/page-titles"

export const metadata = { title: pageTitle("/reports/debts") }

export default async function Page() {
  const rows = await listDebts()
  return (
    <>
      <DebtsReport rows={rows} />
      <LiveRefresh />
    </>
  )
}
