import SettingsPage from "@/components/settings-page"
import { getCurrentHouse, getCurrentUser } from "@/lib/data/house"
import { toAppUser } from "@/lib/supabase/types"

// Configuración: the signed-in account and the current house, read on the
// server; the admin edits the house, everyone edits their own account.
export default async function Page() {
  const [user, house] = await Promise.all([getCurrentUser(), getCurrentHouse()])
  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <SettingsPage
          account={{
            name: user ? toAppUser(user).name : "",
            email: user?.email ?? "",
            hasCustomName: Boolean(user?.user_metadata?.full_name),
          }}
          house={house}
        />
      </div>
    </div>
  )
}
