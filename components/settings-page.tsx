import { Separator } from "@/components/ui/separator"
import UserInfo from "./user-info"
import HouseInfo from "./house-info"



const SettingsPage = () => {
  return (
    <section className="py-3">
      <div className="mx-auto max-w-7xl">
        <UserInfo />
        <Separator className={"mt-4 mb-4 border border-gray-400/25"} />
        <HouseInfo />
      </div>
    </section>
  )
}

export default SettingsPage
