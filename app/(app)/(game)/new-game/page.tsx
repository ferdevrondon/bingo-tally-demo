import { TicketsAssignmentPage } from "@/components/tickets-assignment-page"
import { pageTitle } from "@/lib/page-titles"

export const metadata = { title: pageTitle("/new-game") }

export default function Page() {
  return <TicketsAssignmentPage />
}
