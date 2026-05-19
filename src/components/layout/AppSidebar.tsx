"use client"

import * as React from "react"
import {
  LayoutGrid,
  Globe,
  LogOut,
  LogIn,
  UserPlus,
  ShieldCheck,
  User,
  Ticket,
  Settings
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

  const settingsRef = React.useMemo(() => db ? doc(db, "settings", "site") : null, [db])
  const { data: settings } = useDoc<any>(settingsRef)
  
  const isAdmin = profile?.role === 'admin'
  const siteName = settings?.siteName || "Viby"

  const items = [
    {
      title: "Explorar",
      url: "/dashboard",
      icon: Globe,
    },
    {
      title: "Meus Eventos",
      url: "/dashboard/projetos",
      icon: LayoutGrid,
      authRequired: true
    },
    {
      title: "Meus Ingressos",
      url: "/dashboard/ingressos",
      icon: Ticket,
      authRequired: true
    },
    {
      title: "Meu Perfil",
      url: "/dashboard/perfil",
      icon: User,
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
          {settings?.logoUrl ? (
            <div className="w-8 h-8 relative flex items-center justify-center">
              <img src={settings.logoUrl} alt={siteName} className="max-h-full max-w-full object-contain" />
            </div>
          ) : (
            <div className="w-8 h-8 bg-secondary rounded-lg flex items-center justify-center">
              <span className="text-secondary-foreground font-bold text-lg">{siteName.charAt(0)}</span>
            </div>
          )}
          <span className="text-xl font-bold tracking-tight">{siteName}</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="px-6 text-xs font-black uppercase text-muted-foreground tracking-widest mb-4">Navegação</SidebarGroupLabel>
          <SidebarGroupContent className="px-3">
            <SidebarMenu>
              {items.map((item) => {
                if (item.authRequired && !user) return null;
                
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={pathname === item.url}>
                      <Link href={item.url} className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all font-semibold text-sm",
                        pathname === item.url ? "bg-secondary text-white shadow-lg shadow-secondary/20" : "hover:bg-muted text-muted-foreground hover:text-foreground"
                      )}>
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
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
            <SidebarGroupLabel className="px-6 text-xs font-black uppercase text-destructive tracking-widest mb-4">Administração</SidebarGroupLabel>
            <SidebarGroupContent className="px-3">
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname?.startsWith("/admin")}>
                    <Link href="/admin" className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all font-bold text-sm",
                      pathname?.startsWith("/admin") ? "bg-primary text-white shadow-xl" : "bg-destructive/10 text-destructive hover:bg-destructive hover:text-white"
                    )}>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Painel Admin</span>
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
            <div className="flex items-center gap-3 px-3 py-2 opacity-50">
              <Settings className="w-4 h-4 cursor-pointer" />
              <span className="text-[10px] font-black uppercase tracking-widest">Versão 1.2.5</span>
            </div>
            <button 
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-3 text-destructive hover:bg-destructive/10 rounded-xl transition-all text-sm font-bold"
            >
              <LogOut className="w-4 h-4" />
              Sair da Conta
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
