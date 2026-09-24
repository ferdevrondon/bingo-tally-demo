import { AppSidebar } from "@/components/app-sidebar"
import { HouseProvider } from "@/components/house-provider"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { SiteHeader } from "@/components/site-header"
import { getCurrentHouse, getCurrentUser } from "@/lib/data/house"
import { toAppUser } from "@/lib/supabase/types"

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const [user, house] = await Promise.all([getCurrentUser(), getCurrentHouse()])

  return (
    <HouseProvider house={house}>
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
