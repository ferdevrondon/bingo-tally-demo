import { redirect } from "next/navigation"

// The game sessions list lives in Reportes since Phase 6b.
export default function Page() {
  redirect("/reports/games")
}
