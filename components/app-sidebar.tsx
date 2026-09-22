"use client"

import * as React from "react"

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
  CameraIcon,
  FileTextIcon,
  Settings2Icon,
  DatabaseIcon,
  FileChartColumnIcon,
  FileIcon,
  ChessQueen,
  Users,
  PlayingCardsFan,
  RotateCcwClock,
  Hash,
  Target,
  ActivityIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Dice5,
  FileChartColumn,
} from "lucide-react"
import { Climate_Crisis } from "next/font/google"

const data = {
  navMain: [
    {
      title: "Ronda activa",
      url: "/active-round",
      icon: <ActivityIcon />,
    },
    {
      title: "Rondas",
      url: "/rounds",
      icon: <Target />,
    },
    // {
    //   title: "Dashboard",
    //   url: "/dashboard",
    //   icon: <LayoutDashboardIcon />,
    // },

    // {
    //   title: "Jornadas",
    //   url: "/games",
    //   icon: <ListIcon />,
    // },
    {
      title: "Jugadores",
      url: "/players",
      icon: <Users />,
    },
    // {
    //   title: "Cartones",
    //   url: "#",
    //   icon: <PlayingCardsFan />,
    // },

    {
      title: "Reportes",
      url: "/reports",
      icon: <FileChartColumn />,
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

const titleFont = Climate_Crisis({
  subsets: ["latin"],
  variable: "--font-title",
})

function SidebarCollapseToggle() {
  const { state, toggleSidebar } = useSidebar()
  return (
    <button
      type="button"
      onClick={toggleSidebar}
      title={state === "collapsed" ? "Expandir sidebar" : "Colapsar sidebar"}
      className="absolute top-6 -right-3 z-30 flex size-6 items-center justify-center rounded-full border bg-background bg-primary/25 text-foreground shadow-sm transition-colors hover:bg-accent"
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
              <div className="flex size-5 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Dice5 className="size-5" />
              </div>
              <span
                className={"text text-xl font-semibold " + titleFont.className}
              >
                {" "}
                Bingo Tally.
              </span>
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
