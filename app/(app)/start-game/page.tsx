import { Suspense } from "react"
import { redirect } from "next/navigation"

import { StartGamePage } from "@/components/start-game-page"
import { getStartAlerts } from "@/lib/data/account-actions"
import { getCurrentHouse } from "@/lib/data/house"
import { hasActiveGameSession } from "@/lib/data/load-game-session"
import { listRoundTemplates } from "@/lib/data/rounds"
import { pageTitle } from "@/lib/page-titles"

export const metadata = { title: pageTitle("/start-game") }

// "Iniciar jornada" as steps (BACKEND_PLAN.md "Automatic game sessions"):
// Tipo de jornada → Patrón de rondas (automatic only) → Cartones y jugadores
// (/new-game). Nothing is created until the host starts it. Admin only; with
// a game session already active it goes straight to /new-game.
export default async function Page() {
  const house = await getCurrentHouse()
  if (house?.role !== "admin") redirect("/")
  if (await hasActiveGameSession()) redirect("/new-game")

  const [templates, alerts] = await Promise.all([listRoundTemplates(), getStartAlerts()])

  return (
    <Suspense>
      <StartGamePage templates={templates} alerts={alerts} />
    </Suspense>
  )
}
