"use client"

import * as React from "react"
import {
  Star,
  LayoutGrid,
  BarChart3,
  Calendar,
  Settings,
  Globe,
  LogOut,
  LogIn,
  UserPlus,
  ShieldCheck
} from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useAuth, useUser, useFirestore, useDoc } from "@/firebase"
import { signOut } from "firebase/auth"
import { doc } from "firebase/firestore"

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
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const auth = useAuth()
  const db = useFirestore()
  const { user } = useUser(auth)
  
  const userDocRef = React.useMemo(() => (db && user) ? doc(db, "users", user.uid) : null, [db, user])
  const { data: profile } = useDoc<any>(userDocRef)
  
  const isAdmin = profile?.role === 'admin'

  const items = [
    {
      title: "Explorar",
      url: "/dashboard",
      icon: Globe,
    },
    {
      title: "Destaques",
      url: "/dashboard/hoje",
      icon: Star,
    },
    {
      title: "Meus Eventos",
      url: "/dashboard/projetos",
      icon: LayoutGrid,
      authRequired: true
    },
    {
      title: "Programação",
      url: "/dashboard/calendario",
      icon: Calendar,
    },
    {
      title: "Resultados",
      url: "/dashboard/estatisticas",
      icon: BarChart3,
      authRequired: true
    },
  ]

  const handleLogout = async () => {
    if (!auth) return
    try {
      await signOut(auth)
      toast({ title: "Até logo!", description: "Você saiu da sua conta." })
      router.push("/login")
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao sair", description: error.message })
    }
  }

  return (
    <Sidebar className="border-r border-border">
      <SidebarHeader className="p-6">
        <Link href="/dashboard" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 bg-secondary rounded-lg flex items-center justify-center">
            <span className="text-secondary-foreground font-bold text-lg">V</span>
          </div>
          <span className="text-xl font-bold tracking-tight">Viby</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="px-6 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Navegação</SidebarGroupLabel>
          <SidebarGroupContent className="px-3">
            <SidebarMenu>
              {items.map((item) => {
                if (item.authRequired && !user) return null;
                
                return (
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
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="px-6 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Administração</SidebarGroupLabel>
            <SidebarGroupContent className="px-3">
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === "/dashboard/admin"}>
                    <Link href="/dashboard/admin" className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-md transition-colors",
                      pathname === "/dashboard/admin" ? "bg-secondary/10 text-secondary" : "hover:bg-accent/50"
                    )}>
                      <ShieldCheck className="w-5 h-5" />
                      <span className="font-medium">Painel Admin</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="p-4 space-y-2">
        {user ? (
          <>
            <div className="flex items-center gap-3 px-3 py-2">
              <Settings className="w-5 h-5 cursor-pointer hover:text-foreground transition-colors" />
              <span className="text-xs text-muted-foreground flex-1">v1.0</span>
            </div>
            <button 
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2 text-destructive hover:bg-destructive/10 rounded-md transition-colors text-sm font-medium"
            >
              <LogOut className="w-5 h-5" />
              Sair
            </button>
          </>
        ) : (
          <div className="space-y-1">
            <SidebarMenuButton asChild>
              <Link href="/login" className="flex items-center gap-3 px-3 py-2 text-sm font-medium">
                <LogIn className="w-5 h-5" />
                Entrar
              </Link>
            </SidebarMenuButton>
            <SidebarMenuButton asChild variant="outline" className="border-secondary/20 text-secondary">
              <Link href="/cadastro" className="flex items-center gap-3 px-3 py-2 text-sm font-bold">
                <UserPlus className="w-5 h-5" />
                Cadastrar-se
              </Link>
            </SidebarMenuButton>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  )
}