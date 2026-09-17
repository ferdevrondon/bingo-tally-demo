"use client"

import * as React from "react"


import data from "./data.json"
import SettingsPage from "@/components/settings-page"

export default function Page() {
  const [casa, setCasa] = React.useState(data.casa)
  const account = data.account

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <SettingsPage casa={casa} account={account} onSaveCasa={setCasa} />
      </div>
    </div>
  )
}
