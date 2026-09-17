"use client"

import * as React from "react"

import { NavDocuments } from "@/components/nav-documents"
import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  LayoutDashboardIcon,
  ListIcon,
  ChartBarIcon,
  FolderIcon,
  UsersIcon,
  CameraIcon,
  FileTextIcon,
  Settings2Icon,
  CircleHelpIcon,
  SearchIcon,
  DatabaseIcon,
  FileChartColumnIcon,
  FileIcon,
  CommandIcon,
  ChessQueen,
  Users,
  PlayingCardsFan,
  RotateCcwClock,
  Hash,
  KeyRoundIcon,
  Target,
  ActivityIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react"

const data = {
  navMain: [
     {
      title: "Ronda activa",
      url: "/ronda-activa",
      icon: <ActivityIcon />,
    },
    {
      title: "Rondas",
      url: "/rounds",
      icon: <Target />,
    },
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: <LayoutDashboardIcon />,
    },

    {
      title: "Jornadas",
      url: "/sessions",
      icon: <ListIcon />,
    },
    {
      title: "Jugadores",
      url: "/players",
      icon: <Users />,
    },
    {
      title: "Cartones",
      url: "#",
      icon: <PlayingCardsFan />,
    },
    {
      title: "Numeros",
      url: "/numbers",
      icon: <Hash />,
    },
    {
      title: "Historial",
      url: "/reports",
      icon: <RotateCcwClock />,
    },
  ],
  navClouds: [
    {
      title: "Capture",
      icon: <CameraIcon />,
      isActive: true,
      url: "#",
      items: [
        {
          title: "Active Proposals",
          url: "#",
        },
        {
          title: "Archived",
          url: "#",
        },
      ],
    },
    {
      title: "Proposal",
      icon: <FileTextIcon />,
      url: "#",
      items: [
        {
          title: "Active Proposals",
          url: "#",
        },
        {
          title: "Archived",
          url: "#",
        },
      ],
    },
    {
      title: "Prompts",
      icon: <FileTextIcon />,
      url: "#",
      items: [
        {
          title: "Active Proposals",
          url: "#",
        },
        {
          title: "Archived",
          url: "#",
        },
      ],
    },
  ],
  navSecondary: [
    {
      title: "Settings",
      url: "/settings",
      icon: <Settings2Icon />,
    },
  ],
  documents: [
    {
      name: "Data Library",
      url: "#",
      icon: <DatabaseIcon />,
    },
    {
      name: "Reports",
      url: "#",
      icon: <FileChartColumnIcon />,
    },
    {
      name: "Word Assistant",
      url: "#",
      icon: <FileIcon />,
    },
  ],
}
function SidebarCollapseToggle() {
  const { state, toggleSidebar } = useSidebar()
  return (
    <button
      type="button"
      onClick={toggleSidebar}
      title={state === "collapsed" ? "Expandir sidebar" : "Colapsar sidebar"}
      className="absolute -right-3 top-6 z-30 flex size-6 items-center justify-center rounded-full border bg-background text-foreground shadow-sm transition-colors hover:bg-accent"
    >
      {state === "collapsed" ? (
        <ChevronRightIcon className="size-3.5" />
      ) : (
        <ChevronLeftIcon className="size-3.5" />
      )}
      <span className="sr-only">Alternar sidebar</span>
    </button>
  )
}

export function AppSidebar({
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: { name: string; email: string; avatar: string }
}) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarCollapseToggle />
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={<a href="#" />}
            >
              {/* <CommandIcon className="size-5!" /> */}
              <ChessQueen className="size-5!" />
              <span className="text-base font-semibold">Admin Bingo.</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        {/* <NavDocuments items={data.documents} /> */}
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
