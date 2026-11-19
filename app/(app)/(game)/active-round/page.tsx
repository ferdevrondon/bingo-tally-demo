import { ActiveRoundPage } from "@/components/active-round-page"
import { pageTitle } from "@/lib/page-titles"

export const metadata = { title: pageTitle("/active-round") }

export default function Page() {
  return <ActiveRoundPage />
}
