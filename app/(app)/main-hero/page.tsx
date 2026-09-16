import MainPageHero from "@/components/main-page-hero"

export default function Page() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <MainPageHero />
      </div>
    </div>
  )
}
