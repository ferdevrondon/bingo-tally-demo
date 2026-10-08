import { Separator } from "@/components/ui/separator"
import type { CurrentHouse } from "@/lib/data/house"
import HouseInfo from "./house-info"
import UserInfo, { type AccountInfo } from "./user-info"

const SettingsPage = ({ account, house }: { account: AccountInfo; house: CurrentHouse | null }) => {
  return (
    <section className="px-4 py-3 lg:px-6">
      <div className="mx-auto max-w-7xl">
        <UserInfo account={account} role={house?.role ?? null} />
        <Separator className="mt-4 mb-4 border border-gray-400/25" />
        {house ? (
          <HouseInfo house={house} />
        ) : (
          <p className="py-6 text-sm text-muted-foreground">Tu cuenta todavía no pertenece a ninguna casa.</p>
        )}
      </div>
    </section>
  )
}

export default SettingsPage
