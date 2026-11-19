import { redirect } from "next/navigation"

import { AdminSessionGuard } from "@/components/admin-session-guard"
import { AppSidebar } from "@/components/app-sidebar"
import { HouseProvider } from "@/components/house-provider"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { SiteHeader } from "@/components/site-header"
import { SESSION_CONFLICT_PATH } from "@/lib/admin-session-paths"
import { ensureAdminSession } from "@/lib/data/admin-session"
import { getCurrentHouse, getCurrentUser } from "@/lib/data/house"
import { toAppUser } from "@/lib/supabase/types"

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const [user, house] = await Promise.all([getCurrentUser(), getCurrentHouse()])
  const isAdmin = house?.role === "admin"
  // Single admin session (BACKEND_PLAN.md §2): an admin whose login session
  // lost the claim to an active device chooses on /session-conflict.
  if (isAdmin && (await ensureAdminSession()) === "conflict") redirect(SESSION_CONFLICT_PATH)

  return (
    <HouseProvider house={house}>
      {isAdmin && <AdminSessionGuard />}
      <SidebarProvider
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 72)",
            "--header-height": "calc(var(--spacing) * 12)",
          } as React.CSSProperties
        }
      >
        <AppSidebar
          variant="inset"
          user={
            user
              ? toAppUser(user)
              : { name: "Usuario", email: "", avatar: "/avatars/shadcn.jpg" }
          }
        />
        <SidebarInset>
          <SiteHeader />
          {children}
        </SidebarInset>
      </SidebarProvider>
    </HouseProvider>
  )
}
