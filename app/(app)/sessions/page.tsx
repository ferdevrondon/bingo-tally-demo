import SessionPage from "@/components/session-page"

export default function Page() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <SessionPage />
      </div>
    </div>
  )
}
