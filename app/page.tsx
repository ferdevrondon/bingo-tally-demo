import MainPage from "@/components/main-page"
import { Button } from "@/components/ui/button"

export default function Page() {
  return (
   <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
      <MainPage />
      </div>
    </div>
  )
}
