"use client"

import { LoginForm } from "@/components/login-form"
import { Crown, Dice5, GalleryVerticalEndIcon } from "lucide-react"
import { Climate_Crisis } from "next/font/google"


const titleFont = Climate_Crisis ({
   subsets: ["latin"],
  variable: "--font-title",
})

export default function LoginPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <a href="#" className="flex items-center gap-2 self-center font-medium">
          <div className="flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Dice5 className="size-90" />
          </div>
         <span className={"text-4xl " + titleFont.className}> Bingo Tally</span>
        </a>
        <LoginForm />
      </div>
    </div>
  )
}
