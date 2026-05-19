
"use client"

import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/AppSidebar"
import { Search, Bell, User, LogIn } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useAuth, useUser } from "@/firebase"
import Link from "next/link"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const auth = useAuth()
  const { user } = useUser(auth)

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1 overflow-y-auto">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-background/80 px-6 backdrop-blur-md">
            <SidebarTrigger />
            <div className="flex-1 max-w-md relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar eventos, cidades..."
                className="pl-10 bg-muted/30 border-none focus-visible:ring-1 focus-visible:ring-secondary"
              />
            </div>
            
            <div className="flex items-center gap-3 ml-auto">
              {user ? (
                <>
                  <Button variant="ghost" size="icon" className="relative hidden sm:flex">
                    <Bell className="h-5 w-5" />
                    <span className="absolute top-2 right-2 w-2 h-2 bg-secondary rounded-full border-2 border-background" />
                  </Button>
                  <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold cursor-pointer overflow-hidden border border-border shadow-sm">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt={user.displayName || "Perfil"} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xs">{user.displayName?.charAt(0) || user.email?.charAt(0) || 'U'}</span>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" asChild className="font-semibold">
                    <Link href="/login">Entrar</Link>
                  </Button>
                  <Button size="sm" asChild className="bg-secondary text-white hover:bg-secondary/90 font-bold shadow-sm">
                    <Link href="/cadastro">Criar conta</Link>
                  </Button>
                </div>
              )}
            </div>
          </header>
          <div className="p-6 lg:p-10 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  )
}
