"use client"

import Rounds from "@/components/rounds-page"

export default function Page() {
  return (
    <div className=" px-6 flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <Rounds />
      </div>
    </div>
  )
}
