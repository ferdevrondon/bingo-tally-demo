import Rounds from "@/components/rounds-page"
import { listRoundTemplates } from "@/lib/data/rounds"

export default async function Page() {
  const rounds = await listRoundTemplates()

  return (
    <div className="flex flex-1 flex-col px-6">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <Rounds rounds={rounds} />
      </div>
    </div>
  )
}
