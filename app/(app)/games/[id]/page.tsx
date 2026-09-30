import { redirect } from "next/navigation"

// The game session report lives in Reportes since Phase 6b; its settlement
// stays at /games/[id]/settlement.
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/reports/games/${encodeURIComponent(id)}`)
}
