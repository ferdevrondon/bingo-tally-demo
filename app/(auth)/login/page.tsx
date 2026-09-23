"use client"

import { LoginForm } from "@/components/login-form"
import { LoginHero } from "@/components/login-hero"
import { Crown, Dice5, GalleryVerticalEndIcon } from "lucide-react"
import {titleFont} from '@/fonts';
import Image from "next/image"



export default function LoginPage() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
        <div className="flex w-full max-w-sm flex-col gap-6">
          <div className="flex items-center gap-2 self-center font-medium">
            <div className="">
              <Image src={'/assets/img/logo.svg'}  alt={'logo'} width={60} height={40}/>
            </div>
           <span className={"text-2xl " + titleFont.className}> Bingo Tally</span>
          </div>
          <LoginForm />
        </div>
      </div>
      <div className="relative hidden items-center justify-center overflow-hidden bg-gradient-to-br from-primary/25 via-primary/5 to-background p-10 dark:from-primary/30 dark:via-background dark:to-background lg:flex xl:p-16">
        <LoginHero />
      </div>
    </div>
  )
}
