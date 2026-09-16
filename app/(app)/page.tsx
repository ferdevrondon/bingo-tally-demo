import MainPageHero from "@/components/main-page-hero"
import MainPageSplit from "@/components/main-page-split"
import { Button } from "@/components/ui/button"

export default function Page() {
  return (
   <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
      <MainPageSplit />
      </div>
    </div>
  )
}
