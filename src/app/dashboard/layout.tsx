
"use client"

import * as React from "react"
import { useRouter, usePathname } from "next/navigation"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/AppSidebar"
import { Bell, Loader2, Plus, Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth, useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, where } from "firebase/firestore"
import { OrganizationProvider, useCurrentOrganization } from "@/contexts/OrganizationContext"
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

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { currentOrg, organizations, setCurrentOrg, loading } = useCurrentOrganization()
  const auth = useAuth()
  const { user, loading: authLoading } = useUser(auth)
  const db = useFirestore()
  const router = useRouter()

  const unreadQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return query(collection(db, "notifications"), where("targetUid", "==", user.uid), where("read", "==", false))
  }, [db, user])
  const { data: unreadNotifications } = useCollection<any>(unreadQuery)

  if (authLoading || loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-secondary" />
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
            </div>
            
            <div className="flex items-center gap-3 ml-auto">
              <Button variant="ghost" size="icon" className="relative h-9 w-9" asChild>
                <Link href="/dashboard/notificacoes">
                  <Bell className="h-5 w-5" />
                  {unreadNotifications && unreadNotifications.length > 0 && (
                    <span className="absolute top-2 right-2 w-2 h-2 bg-secondary rounded-full border-2 border-background" />
                  )}
                </Link>
              </Button>
              <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold border border-border shadow-sm overflow-hidden">
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs uppercase">{user?.displayName?.charAt(0) || 'U'}</span>
                )}
              </div>
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
