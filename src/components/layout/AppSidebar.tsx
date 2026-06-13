
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
  RefreshCw
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
  const { user, profile } = useUser(auth)
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
              height={40} 
              style={{ height: 'auto' }}
              className="h-8 w-auto object-contain" 
              priority 
              unoptimized 
            />
          ) : (
            <span className="text-xl font-bold tracking-tight italic">{siteName}</span>
          )}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {/* REST OF COMPONENT OMITTED FOR BREVITY */}
      </SidebarContent>
      {/* ... */}
    </Sidebar>
  )
}
