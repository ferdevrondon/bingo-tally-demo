import SettingsPage from "@/components/settings-page"

// House name/identifier come from the database once the backend lands
// (see BACKEND_PLAN.md); until then SettingsPage renders its own form state.
export default function Page() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <SettingsPage />
      </div>
    </div>
  )
}
