import { redirect } from "next/navigation"
import { MonitorSmartphoneIcon } from "lucide-react"

import { BrandLockup } from "@/components/brand-lockup"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { titleFont } from "@/fonts"
import { getAdminSessionStatus, resolveAdminSessionAfterLogin } from "@/lib/data/admin-session"
import { continueOnOtherDevice, keepSessionHere } from "@/lib/supabase/actions"
import { createClient } from "@/lib/supabase/server"

// Shown after an admin signs in while the account is active on another
// device (BACKEND_PLAN.md business rule 5). proxy.ts already sends signed-out
// visitors to /login.
export default async function SessionConflictPage() {
  const supabase = await createClient()
  const status = await getAdminSessionStatus(supabase)
  // The other device may have gone quiet since the redirect: nothing to ask.
  if (status !== "other_active") redirect(await resolveAdminSessionAfterLogin(supabase))

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <BrandLockup className="self-center" />
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <MonitorSmartphoneIcon className="size-6" />
            </div>
            <CardTitle className={"text-xl " + titleFont.className}>
              Sesión abierta en otro dispositivo
            </CardTitle>
            <CardDescription>
              Esta cuenta ya está abierta en otro dispositivo. ¿Quieres mantener la sesión aquí
              o cerrarla y seguir en el otro dispositivo?
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <form action={keepSessionHere}>
              <Button type="submit" className="w-full">
                Mantener sesión aquí
              </Button>
            </form>
            <form action={continueOnOtherDevice}>
              <Button type="submit" variant="outline" className="w-full">
                Seguir en el otro dispositivo
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
