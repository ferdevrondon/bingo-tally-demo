"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"

import {
  claimAdminSession,
  resolveAdminSessionAfterLogin,
} from "@/lib/data/admin-session"
import { createClient } from "@/lib/supabase/server"
import { loginSchema, type LoginFormState } from "@/lib/supabase/schemas"

async function getOrigin() {
  const headerList = await headers()
  const protocol = headerList.get("x-forwarded-proto") ?? "http"
  const host = headerList.get("host")
  return `${protocol}://${host}`
}

// Supabase's messages are in English; the login shows its own.
function loginErrorMessage(code: string | undefined): string {
  if (code === "invalid_credentials") return "Correo o contraseña incorrectos."
  if (code === "email_not_confirmed") return "Confirma tu correo antes de entrar."
  return "No se pudo iniciar sesión. Inténtalo de nuevo."
}

export async function signInWithPassword(
  _prevState: LoginFormState,
  formData: FormData
): Promise<LoginFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  })

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)

  if (error) {
    return { errors: { form: [loginErrorMessage(error.code)] } }
  }

  redirect(await resolveAdminSessionAfterLogin(supabase))
}

export async function signInWithGoogle() {
  const supabase = await createClient()
  const origin = await getOrigin()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  })

  if (error || !data.url) {
    redirect("/login?error=oauth_error")
  }

  redirect(data.url)
}

// /session-conflict: this device keeps the admin session; the other one is
// signed out (its tab notices via Realtime, see AdminSessionGuard).
export async function keepSessionHere() {
  const supabase = await createClient()
  await claimAdminSession(supabase)
  redirect("/")
}

// /session-conflict: leave the other device untouched and sign out here.
export async function continueOnOtherDevice() {
  const supabase = await createClient()
  await supabase.auth.signOut({ scope: "local" })
  redirect("/login")
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}
