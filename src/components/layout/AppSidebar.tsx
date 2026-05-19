"use client"

import * as React from "react"
import {
  Inbox,
  CalendarDays,
  LayoutDashboard,
  BarChart3,
  Calendar,
  Settings,
  PlusCircle,
  Menu,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

const items = [
  {
    title: "Inbox",
    url: "/dashboard",
    icon: Inbox,
  },
  {
    title: "Hoje",
    url: "/dashboard/hoje",
    icon: CalendarDays,
  },
  {
    title: "Projetos",
    url: "/dashboard/projetos",
    icon: LayoutDashboard,
  },
  {
    title: "Calendário",
    url: "/dashboard/calendario",
    icon: Calendar,
  },
  {
    title: "Estatísticas",
    url: "/dashboard/estatisticas",
    icon: BarChart3,
  },
]

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar className="border-r border-border">
      <SidebarHeader className="p-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-lg">V</span>
          </div>
          <span className="text-xl font-bold tracking-tight">Viby</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="px-6 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Principal</SidebarGroupLabel>
          <SidebarGroupContent className="px-3">
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={pathname === item.url}>
                    <Link href={item.url} className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-md transition-colors",
                      pathname === item.url ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                    )}>
                      <item.icon className="w-5 h-5" />
                      <span className="font-medium">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-6">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <Settings className="w-5 h-5 cursor-pointer hover:text-foreground transition-colors" />
          <span>Versão 1.0.0</span>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
