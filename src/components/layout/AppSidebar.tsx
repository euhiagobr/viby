
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
  Map as MapIcon,
  Bell,
  Handshake
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
    { title: t('nav.tickets'), url: "/dashboard/ingressos", icon: Ticket },
    { title: t('nav.wallet'), url: "/dashboard/carteira", icon: Wallet },
    { title: t('nav.organizations'), url: "/dashboard/organizacoes", icon: Building2 },
    { title: "Afiliados", url: "/dashboard/afiliados", icon: Handshake },
    { 
      title: t('common.notifications'), 
      url: "/dashboard/notificacoes", 
      icon: Bell, 
      badge: unreadNotificationsCount || null 
    },
    { 
      title: t('nav.requests'), 
      url: "/dashboard/solicitacoes", 
      icon: UserCheck, 
      badge: (pendingInvitations.length + pendingPartnerships.length) || null 
    },
    { title: t('nav.following'), url: "/dashboard/seguindo", icon: Heart },
    { title: t('nav.profile'), url: "/dashboard/perfil", icon: User },
    { 
      title: t('nav.support'), 
      url: "/suporte", 
      icon: LifeBuoy, 
      badge: unreadSupportCount || null 
    },
  ];

  const orgItems = currentOrg ? [
    { 
      title: t('nav.dashboard'), 
      url: `/dashboard/organizacoes/${currentOrg.username}`, 
      icon: LayoutGrid,
      visible: true,
      exact: true 
    },
    { 
      title: t('nav.events'), 
      url: `/dashboard/organizacoes/${currentOrg.username}/events`, 
      icon: CalendarDays, 
      visible: true 
    },
    { 
      title: t('nav.ads'), 
      url: `/dashboard/organizacoes/${currentOrg.username}/anuncios`, 
      icon: Megaphone, 
      visible: ['owner', 'admin', 'editor'].includes(userRole || '') 
    },
    { 
      title: t('nav.team'), 
      url: `/dashboard/organizacoes/${currentOrg.username}/equipe`, 
      icon: Users, 
      visible: ['owner', 'admin'].includes(userRole || '') 
    },
    { 
      title: t('nav.finance'), 
      url: `/dashboard/organizacoes/${currentOrg.username}/finance`, 
      icon: Wallet, 
      visible: ['owner', 'admin', 'finance'].includes(userRole || '') 
    },
    { 
      title: t('nav.settings'), 
      url: `/dashboard/organizacoes/${currentOrg.username}/settings`, 
      icon: Settings, 
      visible: ['owner', 'admin', 'editor'].includes(userRole || '') 
    },
  ].filter(item => item.visible !== false) : [];

  return (
    <Sidebar className="border-r border-border">
      <SidebarHeader className="p-6">
        <Link href="/dashboard" className="flex items-center gap-3">
          {settings?.logoUrl ? (
            <Image 
              src={settings.logoUrl} 
              alt={siteName} 
              width={140} 
              height={40} 
              className="h-8 w-auto object-contain" 
              priority 
              unoptimized
            />
          ) : (
            <>
              <div className="w-8 h-8 bg-secondary rounded-lg flex items-center justify-center">
                <span className="text-white font-black text-lg">{siteName.charAt(0)}</span>
              </div>
              <span className="text-xl font-bold tracking-tight italic">{siteName}</span>
            </>
          )}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {currentOrg && (
          <SidebarGroup>
            <SidebarGroupLabel className="px-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
              {t('nav.organizations')}: {currentOrg.name}
            </SidebarGroupLabel>
            <SidebarGroupContent className="px-3">
              <SidebarMenu>
                {orgItems.map((item) => {
                  const isActive = item.exact ? pathname === item.url : pathname?.startsWith(item.url);
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={isActive}>
                        <Link href={item.url} className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all font-semibold text-sm",
                          isActive ? "bg-secondary text-white shadow-lg shadow-secondary/20" : "hover:bg-muted text-muted-foreground"
                        )}>
                          <item.icon className="w-4 h-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupLabel className="px-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
            {t('nav.profile')}
          </SidebarGroupLabel>
          <SidebarGroupContent className="px-3">
            <SidebarMenu>
              {personalItems.map((item) => {
                const isActive = item.exact ? pathname === item.url : pathname?.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link href={item.url} className={cn(
                        "flex items-center justify-between px-3 py-2.5 rounded-xl transition-all font-semibold text-sm",
                        isActive ? "bg-primary text-white" : "hover:bg-muted text-muted-foreground"
                      )}>
                        <div className="flex items-center gap-3">
                          <item.icon className="w-4 h-4" />
                          <span>{item.title}</span>
                        </div>
                        {item.badge && (
                          <span className="bg-secondary text-white text-[9px] font-black h-4 w-4 rounded-full flex items-center justify-center animate-in zoom-in duration-300">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        
        {/* Banner Ganhe Dinheiro */}
        <div className="px-6 py-4">
           <Link href="/ganhe-dinheiro">
              <div className="bg-secondary/10 rounded-2xl p-4 border border-secondary/20 hover:bg-secondary/20 transition-all group">
                 <div className="flex items-center gap-2 mb-2">
                    <Handshake className="w-4 h-4 text-secondary" />
                    <span className="text-[10px] font-black uppercase text-secondary">Programa Afiliados</span>
                 </div>
                 <p className="text-[10px] font-bold text-primary uppercase leading-tight group-hover:text-secondary">Ganhe dinheiro indicando marcas</p>
              </div>
           </Link>
        </div>
      </SidebarContent>
      <SidebarFooter className="p-4">
        <button 
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-3 text-destructive hover:bg-destructive/10 rounded-xl transition-all text-sm font-bold"
        >
          <LogOut className="w-4 h-4" />
          {t('nav.logout')}
        </button>
      </SidebarFooter>
    </Sidebar>
  )
}
