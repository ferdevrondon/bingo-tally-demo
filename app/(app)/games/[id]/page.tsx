import { GameDetailPage } from "@/components/game-detail-page"

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <GameDetailPage id={Number(id)} />
      </div>
    </div>
  )
}
