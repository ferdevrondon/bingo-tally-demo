"use client"

import * as React from "react";
import PlayerPage from "@/components/player-page"

export default function Page() {


  return (
    <div className="px-6  flex flex-1 flex-col">
      <div className=" @container/main  flex flex-1 flex-col gap-2">
        <PlayerPage />
      </div>
    </div>
  )
}
