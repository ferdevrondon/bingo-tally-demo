import { ReportsTabs } from "@/components/reports-tabs"

// Shared by every report route: the tabs as links (Phase 6b).
export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
        <ReportsTabs />
        {children}
      </div>
    </div>
  )
}
