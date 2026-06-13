
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
  Settings,
  Users,
  Building2,
  UserCheck,
  CalendarDays,
  Bell,
  Handshake,
  Star,
  Trophy,
  Megaphone,
  Coins,
  RefreshCw,
  Plus,
  CheckCircle2,
  ChevronRight
} from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useAuth, useUser, useFirestore, useDoc } from "@/firebase"
import { useCurrentOrganization } from "@/contexts/OrganizationContext"
import { signOut } from "firebase/auth"
import { doc } from "firebase/firestore"
import Image from "next/image"

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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"
import { useTranslation } from "@/i18n/i18n-context"

export function AppSidebar() {
  const { t } = useTranslation()
  const pathname = usePathname()
  const router = useRouter()
  const auth = useAuth()
  const db = useFirestore()
  const { user } = useUser(auth)
  const { 
    currentOrg, 
    organizations,
    setCurrentOrg,
    userRole, 
    pendingInvitations, 
    pendingPartnerships, 
    unreadSupportCount,
    unreadNotificationsCount
  } = useCurrentOrganization()

  const settingsRef = React.useMemo(() => db ? doc(db, "settings", "site") : null, [db])
  const { data: settings } = useDoc<any>(settingsRef)
  const siteName = settings?.siteName || "Viby"

  const handleLogout = async () => {
    if (!auth) return
    try {
      await signOut(auth)
      toast({ title: t('common.success') })
      router.push("/login")
    } catch (error: any) {
      toast({ variant: "destructive", title: t('common.error_occurred') })
    }
  }

  const personalItems = [
    { title: t('nav.discovery'), url: "/dashboard", icon: Globe, exact: true },
    { title: "Copa 2026", url: "/copa-do-mundo", icon: Trophy, special: true },
    { title: t('nav.tickets'), url: "/dashboard/ingressos", icon: Ticket },
    { title: t('nav.wallet'), url: "/dashboard/carteira", icon: Wallet },
    { title: t('nav.organizations'), url: "/dashboard/organizacoes", icon: Building2 },
    { title: t('common.notifications'), url: "/dashboard/notificacoes", icon: Bell, badge: unreadNotificationsCount || null },
    { title: t('nav.requests'), url: "/dashboard/solicitacoes", icon: UserCheck, badge: (pendingInvitations.length + pendingPartnerships.length) || null },
    { title: t('nav.following'), url: "/dashboard/seguindo", icon: Heart },
    { title: t('nav.profile'), url: "/dashboard/perfil", icon: User },
    { title: t('nav.support'), url: "/suporte", icon: LifeBuoy, badge: unreadSupportCount || null },
  ];

  const orgItems = currentOrg ? [
    { title: "Dashboard da Marca", url: `/dashboard/organizacoes/${currentOrg.username}`, icon: LayoutGrid, exact: true },
    { title: "Eventos da Marca", url: `/dashboard/organizacoes/${currentOrg.username}/events`, icon: Megaphone },
    { title: "Financeiro", url: `/dashboard/organizacoes/${currentOrg.username}/finance`, icon: Wallet, roles: ['owner', 'admin', 'finance'] },
    { title: "Anúncios", url: `/dashboard/organizacoes/${currentOrg.username}/anuncios`, icon: Coins, roles: ['owner', 'admin', 'editor', 'marketing'] },
    { title: "Equipe", url: `/dashboard/organizacoes/${currentOrg.username}/equipe`, icon: Users, roles: ['owner', 'admin'] },
    { title: "Configurações", url: `/dashboard/organizacoes/${currentOrg.username}/settings`, icon: Settings, roles: ['owner', 'admin'] },
  ].filter(item => !item.roles || item.roles.includes(userRole || '')) : [];

  return (
    <Sidebar className="border-r border-border">
      <SidebarHeader className="p-6">
        <Link href="/dashboard" className="flex items-center gap-3">
          {settings?.logoUrl ? (
            <Image 
              src={settings.logoUrl} 
              alt={siteName} 
              width={140} 
              height={32} 
              style={{ height: '32px', width: 'auto' }}
              className="object-contain" 
              priority 
              unoptimized 
            />
          ) : (
            <span className="text-xl font-bold tracking-tight italic uppercase text-primary">{siteName}</span>
          )}
        </Link>
      </SidebarHeader>
      
      <SidebarContent className="px-4">
        <SidebarGroup>
          <SidebarGroupLabel className="px-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50 mb-2">
            Pessoal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {personalItems.map((item) => {
                const isActive = item.exact 
                  ? pathname === item.url 
                  : pathname?.startsWith(item.url);

                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton 
                      asChild 
                      isActive={isActive}
                      className={cn(
                        "h-11 px-3 rounded-xl transition-all font-bold",
                        isActive ? "bg-primary text-white shadow-lg" : "hover:bg-muted"
                      )}
                    >
                      <Link href={item.url} className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-3">
                          <item.icon className={cn("w-4 h-4", isActive ? "text-white" : "text-secondary")} />
                          <span className="text-sm uppercase tracking-tight italic">{item.title}</span>
                        </div>
                        {item.badge ? (
                          <Badge className="h-5 min-w-5 px-1 bg-secondary text-white border-none font-black text-[9px] flex items-center justify-center rounded-full">
                            {item.badge}
                          </Badge>
                        ) : null}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-6">
          <SidebarGroupLabel className="px-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50 mb-2">
            Minhas Marcas
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {organizations.map((org) => {
                const isActive = currentOrg?.id === org.id;
                return (
                  <SidebarMenuItem key={org.id}>
                    <SidebarMenuButton 
                      onClick={() => setCurrentOrg(org)}
                      className={cn(
                        "h-11 px-3 rounded-xl transition-all font-bold",
                        isActive ? "bg-secondary/10 text-primary border border-secondary/20" : "hover:bg-muted"
                      )}
                    >
                      <div className="flex items-center gap-3 w-full overflow-hidden">
                        <Avatar className="h-6 w-6 shrink-0 border border-muted shadow-sm">
                          <AvatarImage src={org.avatar} className="object-cover" />
                          <AvatarFallback className="text-[10px] font-bold bg-muted">{org.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm uppercase tracking-tight italic truncate">{org.name}</span>
                        {isActive && <CheckCircle2 className="w-3 h-3 text-secondary ml-auto" />}
                      </div>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
              <SidebarMenuItem>
                <SidebarMenuButton asChild className="h-10 px-3 rounded-xl text-secondary font-black gap-3 mt-2 border border-dashed border-secondary/30 hover:bg-secondary/5">
                  <Link href="/dashboard/organizacoes/new">
                    <Plus className="w-4 h-4" />
                    <span className="text-[10px] uppercase italic">Nova Marca</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {currentOrg && (
          <SidebarGroup className="mt-6">
            <SidebarGroupLabel className="px-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50 mb-2">
              Gestão: {currentOrg.name}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {orgItems.map((item) => {
                  const isActive = item.exact 
                    ? pathname === item.url 
                    : pathname?.startsWith(item.url);

                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton 
                        asChild 
                        isActive={isActive}
                        className={cn(
                          "h-11 px-3 rounded-xl transition-all font-bold",
                          isActive ? "bg-primary text-white shadow-lg" : "hover:bg-muted"
                        )}
                      >
                        <Link href={item.url} className="flex items-center gap-3">
                          <item.icon className={cn("w-4 h-4", isActive ? "text-white" : "text-secondary")} />
                          <span className="text-sm uppercase tracking-tight italic">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-6 mt-auto border-t border-border/40">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton 
              onClick={handleLogout}
              className="h-11 px-3 rounded-xl text-destructive hover:bg-destructive/10 font-bold gap-3"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm uppercase tracking-tight italic">{t('nav.logout')}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
