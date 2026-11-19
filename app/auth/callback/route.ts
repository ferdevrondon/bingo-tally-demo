import { NextResponse } from "next/server"

import { resolveAdminSessionAfterLogin } from "@/lib/data/admin-session"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/"

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Same single-admin-session check as the password login.
      const destination = await resolveAdminSessionAfterLogin(supabase)
      return NextResponse.redirect(`${origin}${destination === "/" ? next : destination}`)
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=auth_callback_error`
  )
}
