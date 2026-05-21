"use client"

import * as React from "react"
import {
  LayoutGrid,
  Globe,
  LogOut,
  User,
  Ticket,
  Heart,
  LifeBuoy,
  Wallet,
  CreditCard,
  Megaphone,
  Settings,
  Users,
  Building2,
  UserCheck,
  CalendarDays,
  Trophy
} from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useAuth, useUser } from "@/firebase"
import { useCurrentOrganization } from "@/contexts/OrganizationContext"
import { signOut } from "firebase/auth"

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
  const { user } = useUser(auth)
  const { currentOrg, organizations, userRole, pendingInvitations } = useCurrentOrganization()

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

  const personalItems = [
    { title: "Explorar", url: "/dashboard", icon: Globe },
    { title: "Meus Ingressos", url: "/dashboard/ingressos", icon: Ticket },
    { title: "Minhas Organizações", url: "/dashboard/organizacoes", icon: Building2 },
    // Só mostra Planos se o usuário já tiver pelo menos uma marca criada
    ...(organizations.length > 0 ? [{ title: "Planos", url: "/dashboard/plano", icon: Trophy }] : []),
    { title: "Solicitações", url: "/dashboard/solicitacoes", icon: UserCheck, badge: pendingInvitations.length > 0 ? pendingInvitations.length : null },
    { title: "Seguindo", url: "/dashboard/seguindo", icon: Heart },
    { title: "Meu Perfil", url: "/dashboard/perfil", icon: User },
    { title: "Suporte", url: "/dashboard/suporte", icon: LifeBuoy },
  ];

  // RBAC Sidebar Rules - Updated to point to brand-specific ad management
  const orgItems = currentOrg ? [
    { 
      title: "Dashboard", 
      url: `/dashboard/organizacoes/${currentOrg.username}`, 
      icon: LayoutGrid,
      visible: true 
    },
    { 
      title: "Eventos", 
      url: `/dashboard/organizacoes/${currentOrg.username}/events`, 
      icon: CalendarDays, 
      visible: true 
    },
    { 
      title: "Anúncios", 
      url: `/dashboard/organizacoes/${currentOrg.username}/anuncios`, 
      icon: Megaphone, 
      visible: ['owner', 'admin', 'editor'].includes(userRole || '') 
    },
    { 
      title: "Equipe", 
      url: `/dashboard/organizacoes/${currentOrg.username}/equipe`, 
      icon: Users, 
      visible: ['owner', 'admin'].includes(userRole || '') 
    },
    { 
      title: "Financeiro", 
      url: `/dashboard/organizacoes/${currentOrg.username}/finance`, 
      icon: Wallet, 
      visible: ['owner', 'admin', 'finance'].includes(userRole || '') 
    },
    { 
      title: "Configurações", 
      url: `/dashboard/organizacoes/${currentOrg.username}/settings`, 
      icon: Settings, 
      visible: ['owner', 'admin', 'editor'].includes(userRole || '') 
    },
  ].filter(item => item.visible !== false) : [];

  return (
    <Sidebar className="border-r border-border">
      <SidebarHeader className="p-6">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="w-8 h-8 bg-secondary rounded-lg flex items-center justify-center">
            <span className="text-white font-black text-lg">V</span>
          </div>
          <span className="text-xl font-bold tracking-tight italic">Viby</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {currentOrg && (
          <SidebarGroup>
            <SidebarGroupLabel className="px-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
              Gestão de Marca: {currentOrg.name}
            </SidebarGroupLabel>
            <SidebarGroupContent className="px-3">
              <SidebarMenu>
                {orgItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={pathname === item.url || pathname?.startsWith(item.url)}>
                      <Link href={item.url} className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all font-semibold text-sm",
                        (pathname === item.url || pathname?.startsWith(item.url)) ? "bg-secondary text-white shadow-lg shadow-secondary/20" : "hover:bg-muted text-muted-foreground"
                      )}>
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupLabel className="px-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
            Minha Conta
          </SidebarGroupLabel>
          <SidebarGroupContent className="px-3">
            <SidebarMenu>
              {personalItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={pathname === item.url}>
                    <Link href={item.url} className={cn(
                      "flex items-center justify-between px-3 py-2.5 rounded-xl transition-all font-semibold text-sm",
                      pathname === item.url ? "bg-primary text-white" : "hover:bg-muted text-muted-foreground"
                    )}>
                      <div className="flex items-center gap-3">
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </div>
                      {item.badge && (
                        <span className="bg-secondary text-white text-[9px] font-black h-4 w-4 rounded-full flex items-center justify-center">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4">
        <button 
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-3 text-destructive hover:bg-destructive/10 rounded-xl transition-all text-sm font-bold"
        >
          <LogOut className="w-4 h-4" />
          Sair da Conta
        </button>
      </SidebarFooter>
    </Sidebar>
  )
}
