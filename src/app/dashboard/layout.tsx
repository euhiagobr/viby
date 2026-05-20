"use client"

import * as React from "react"
import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/AppSidebar"
import { Search, Bell, Loader2, ShieldAlert } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useAuth, useUser, useFirestore } from "@/firebase"
import { doc, getDoc } from "firebase/firestore"
import { signOut } from "firebase/auth"
import Link from "next/link"
import { toast } from "@/hooks/use-toast"
import Footer from "@/components/layout/Footer"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const auth = useAuth()
  const db = useFirestore()
  const { user, loading: authLoading } = useUser(auth)
  const router = useRouter()
  const pathname = usePathname()
  const [verifying, setVerifying] = useState(true)
  const [isBlocked, setIsBlocked] = useState(false)

  useEffect(() => {
    async function checkUserStatus() {
      if (authLoading) return
      
      if (!user) {
        setVerifying(false)
        return
      }

      if (db && user) {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid))
          if (userDoc.exists()) {
            const data = userDoc.data();
            
            // Verificação de plataforma
            if (data?.platform !== "viby") {
              await signOut(auth!)
              toast({
                variant: "destructive",
                title: "Sessão Inválida",
                description: "Sua conta não pertence à plataforma Viby Club."
              })
              router.push("/login")
              return
            }

            // Verificação de bloqueio
            if (data?.status === 'Bloqueado') {
              setIsBlocked(true);
              // Só permite acesso ao suporte se estiver bloqueado
              if (!pathname.startsWith('/dashboard/suporte')) {
                router.push('/dashboard/suporte');
              }
            }
          }
        } catch (e) {
          console.error("User verification error", e)
        }
      }
      setVerifying(false)
    }

    checkUserStatus()
  }, [user, authLoading, db, auth, router, pathname])

  if (authLoading || verifying) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-secondary" />
      </div>
    )
  }

  if (isBlocked && !pathname.startsWith('/dashboard/suporte')) {
    return null; // Evita flash de conteúdo antes do redirect
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-[#f8fafc]">
        <AppSidebar />
        <main className="flex-1 overflow-y-auto flex flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-background/80 px-6 backdrop-blur-md">
            <SidebarTrigger />
            
            {!isBlocked ? (
              <div className="flex-1 max-w-md relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Pesquisar eventos, cidades..."
                  className="pl-10 bg-muted/30 border-none focus-visible:ring-1 focus-visible:ring-secondary h-9 text-sm"
                />
              </div>
            ) : (
              <div className="flex-1 flex items-center gap-2 px-3 py-1 bg-destructive/10 text-destructive rounded-full max-w-fit">
                <ShieldAlert className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-tighter italic">Conta Bloqueada - Acesso Restrito ao Suporte</span>
              </div>
            )}
            
            <div className="flex items-center gap-3 ml-auto">
              {user ? (
                <>
                  {!isBlocked && (
                    <Button variant="ghost" size="icon" className="relative hidden sm:flex h-9 w-9">
                      <Bell className="h-5 w-5" />
                      <span className="absolute top-2 right-2 w-2 h-2 bg-secondary rounded-full border-2 border-background" />
                    </Button>
                  )}
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
                  <Button variant="ghost" size="sm" asChild className="font-semibold h-8">
                    <Link href="/login">Entrar</Link>
                  </Button>
                  <Button size="sm" asChild className="bg-secondary text-white hover:bg-secondary/90 font-bold shadow-sm h-8 rounded-full px-4">
                    <Link href="/cadastro">Criar conta</Link>
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
