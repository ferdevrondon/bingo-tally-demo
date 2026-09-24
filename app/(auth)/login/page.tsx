import Image from "next/image"

import { LoginForm } from "@/components/login-form"
import { LoginHero } from "@/components/login-hero"
import { titleFont } from "@/fonts"

// Messages for the ?reason= / ?error= values other routes redirect here with.
const NOTICES: Record<string, string> = {
  replaced: "Tu sesión se cerró porque se inició sesión en otro dispositivo.",
  auth_callback_error: "No se pudo completar el inicio de sesión con Google. Inténtalo de nuevo.",
  oauth_error: "No se pudo iniciar sesión con Google. Inténtalo de nuevo.",
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  const reason = firstParam(params.reason)
  const error = firstParam(params.error)
  const notice =
    (reason && NOTICES[reason] && { tone: "info" as const, message: NOTICES[reason] }) ||
    (error && { tone: "error" as const, message: NOTICES[error] ?? NOTICES.auth_callback_error }) ||
    undefined

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
          <LoginForm notice={notice} />
        </div>
      </div>
      <div className="relative hidden items-center justify-center overflow-hidden bg-gradient-to-br from-primary/25 via-primary/5 to-background p-10 dark:from-primary/30 dark:via-background dark:to-background lg:flex xl:p-16">
        <LoginHero />
      </div>
    </div>
  )
}
