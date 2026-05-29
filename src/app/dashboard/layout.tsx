
"use client"

import * as React from "react"
import { useRouter, usePathname } from "next/navigation"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/AppSidebar"
import { Bell, Loader2, Plus, Building2, ShoppingCart, LogIn, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useAuth, useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, query, where, doc, getDoc, updateDoc, deleteField, serverTimestamp } from "firebase/firestore"
import { OrganizationProvider, useCurrentOrganization } from "@/contexts/OrganizationContext"
import { useCart } from "@/contexts/CartContext"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Link from "next/link"
import Footer from "@/components/layout/Footer"
import { toast } from "@/hooks/use-toast"
import { UserNav } from "@/components/layout/UserNav"

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { currentOrg, organizations, setCurrentOrg } = useCurrentOrganization()
  const auth = useAuth()
  const { user, loading: authLoading, isInitialized } = useUser(auth)
  const db = useFirestore()
  const router = useRouter()
  const pathname = usePathname()
  const { totalCount } = useCart()

  // Lista de rotas protegidas que EXIGEM login imediato
  const protectedRoutes = [
    '/dashboard/ingressos',
    '/dashboard/carteira',
    '/dashboard/organizacoes',
    '/dashboard/solicitacoes',
    '/dashboard/perfil/editar',
    '/dashboard/perfil/configuracoes',
    '/dashboard/admin',
    '/admin'
  ];

  const isProtectedRoute = protectedRoutes.some(route => pathname?.startsWith(route));

  // Escuta o perfil em tempo real para reagir a bloqueios/desbloqueios imediatamente
  const profileRef = React.useMemo(() => (db && user) ? doc(db, "users", user.uid) : null, [db, user])
  const { data: profile, loading: profileLoading } = useDoc<any>(profileRef)

  const unreadQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return query(collection(db, "notifications"), where("targetUid", "==", user.uid), where("read", "==", false))
  }, [db, user])
  const { data: unreadNotifications } = useCollection<any>(unreadQuery)

  React.useEffect(() => {
    if (!isInitialized || profileLoading) return

    if (!user && isProtectedRoute) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname || '/dashboard')}`)
      return
    }

    if (profile && user) {
      // 1. Reativação automática se desativado/em exclusão
      if (profile.status === 'Desativado' || profile.status === 'Exclusão Programada') {
        const userRef = doc(db!, "users", user.uid)
        updateDoc(userRef, {
          status: 'Ativo',
          deletionScheduledAt: deleteField(),
          reactivatedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }).then(() => {
          toast({
            title: "Bem-vindo de volta!",
            description: "Sua conta foi reativada automaticamente.",
            duration: 6000
          })
        })
      }

      // 2. Trava de Bloqueio: Se bloqueado, só acessa suporte
      if (profile.status === 'Bloqueado' && pathname !== '/dashboard/suporte') {
        router.replace('/dashboard/suporte')
      }
    }
  }, [db, user, isInitialized, isProtectedRoute, pathname, router, profile, profileLoading])

  if (!isInitialized || (user && profileLoading)) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-secondary" />
      </div>
    )
  }

  // Renderização Minimalista para Usuários Bloqueados
  if (profile?.status === 'Bloqueado' && pathname !== '/dashboard/suporte') {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#f8fafc] p-6 text-center">
         <div className="w-24 h-24 bg-red-100 rounded-[2rem] flex items-center justify-center text-red-600 mb-8 shadow-xl">
            <ShieldAlert className="w-12 h-12" />
         </div>
         <h1 className="text-4xl font-black uppercase italic tracking-tighter text-primary">Conta Bloqueada</h1>
         <p className="text-muted-foreground font-medium max-w-sm mt-4 leading-relaxed">
            Seu acesso foi suspenso por violação dos termos de uso. Você só pode acessar a central de suporte para contestar esta decisão.
         </p>
         <Button asChild className="mt-8 bg-primary text-white font-black rounded-xl h-14 px-10 uppercase italic shadow-lg">
            <Link href="/dashboard/suporte">Contatar Suporte</Link>
         </Button>
      </div>
    )
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-[#f8fafc]">
        <AppSidebar />
        <main className="flex-1 overflow-y-auto flex flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-background/80 px-6 backdrop-blur-md">
            <SidebarTrigger />
            
            <div className="flex items-center gap-4">
              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="gap-2 rounded-xl h-10 border-dashed border-secondary/40 hover:border-secondary transition-all">
                      <Building2 className="w-4 h-4 text-secondary" />
                      <span className="font-bold text-xs uppercase tracking-tight">
                        {currentOrg?.name || "Selecionar Organização"}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56 rounded-xl" align="start">
                    <DropdownMenuLabel className="text-[10px] uppercase font-black opacity-50">Minhas Organizações</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {organizations.map((org) => (
                      <DropdownMenuItem 
                        key={org.id} 
                        onClick={() => setCurrentOrg(org)}
                        className={currentOrg?.id === org.id ? "bg-secondary/10 font-bold" : ""}
                      >
                        {org.name}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard/organizacoes/new" className="flex items-center gap-2 text-secondary font-bold">
                        <Plus className="w-4 h-4" />
                        Nova Organização
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Badge variant="outline" className="rounded-full border-dashed px-3 py-1 font-bold text-[10px] uppercase text-muted-foreground">
                  Modo Visitante
                </Badge>
              )}
            </div>
            
            <div className="flex items-center gap-3 ml-auto">
              {user ? (
                <>
                  <Button variant="ghost" size="icon" className="relative h-9 w-9" asChild>
                    <Link href="/dashboard/carrinho">
                      <ShoppingCart className="h-5 w-5" />
                      {totalCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-secondary text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-background">
                          {totalCount}
                        </span>
                      )}
                    </Link>
                  </Button>
                  <Button variant="ghost" size="icon" className="relative h-9 w-9" asChild>
                    <Link href="/dashboard/notificacoes">
                      <Bell className="h-5 w-5" />
                      {unreadNotifications && unreadNotifications.length > 0 && (
                        <span className="absolute top-2 right-2 w-2 h-2 bg-secondary rounded-full border-2 border-background" />
                      )}
                    </Link>
                  </Button>
                  <UserNav />
                </>
              ) : (
                <div className="flex items-center gap-2">
                   <Button variant="ghost" asChild className="text-[10px] font-black uppercase tracking-widest h-9">
                      <Link href="/login">Entrar</Link>
                   </Button>
                   <Button asChild className="bg-secondary text-white font-black uppercase italic text-[10px] tracking-widest rounded-full px-5 h-9 shadow-lg shadow-secondary/20">
                      <Link href="/cadastro">Criar Conta</Link>
                   </Button>
                </div>
              )}
            </div>
          </header>
          <div className="p-6 lg:p-10 max-w-7xl mx-auto w-full flex-1">
            {children}
          </div>
          <Footer />
        </main>
      </div>
    </SidebarProvider>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <OrganizationProvider>
      <DashboardContent>{children}</DashboardContent>
    </OrganizationProvider>
  )
}
