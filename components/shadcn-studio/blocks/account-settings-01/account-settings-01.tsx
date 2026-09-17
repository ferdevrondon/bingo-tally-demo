import { Separator } from "@/components/ui/separator"

import PersonalInfo from "@/components/shadcn-studio/blocks/account-settings-01/content/personal-info"
import EmailPass from "@/components/shadcn-studio/blocks/account-settings-01/content/email-password"

const UserGeneral = () => {
  return (
    <section className="py-3">
      <div className="mx-auto max-w-7xl">
        <PersonalInfo />
        <Separator className={"mt-2 mb-2 border border-gray-400/25"} />
        <EmailPass />
      </div>
    </section>
  )
}

export default UserGeneral
