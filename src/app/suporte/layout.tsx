"use client"

import * as React from "react"
import { useRouter, usePathname } from "next/navigation"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/AppSidebar"
import { ShoppingCart, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth, useUser } from "@/firebase"
import { OrganizationProvider } from "@/contexts/OrganizationContext"
import { useCart } from "@/contexts/CartContext"
import Link from "next/link"
import Footer from "@/components/layout/Footer"
import { UserNav } from "@/components/layout/UserNav"

function SuporteLayoutContent({ children }: { children: React.ReactNode }) {
  const auth = useAuth()
  const { user, profile, loading: authLoading, isInitialized } = useUser(auth)
  const router = useRouter()
  const pathname = usePathname()
  const { totalCount } = useCart()

  React.useEffect(() => {
    if (!isInitialized || authLoading) return;

    if (!user) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname || '/suporte')}`);
      return;
    }

    const hasMandatoryData = !!(profile?.username && profile?.cpf);
    const needsOnboarding = profile === null || !hasMandatoryData;

    if (needsOnboarding && pathname !== '/onboarding') {
      router.replace('/onboarding');
    }
  }, [user, profile, isInitialized, authLoading, pathname, router]);

  if (!isInitialized || authLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
           <Loader2 className="w-10 h-10 animate-spin text-secondary" />
           <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground animate-pulse">Sincronizando Suporte...</p>
        </div>
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
            
            <div className="flex items-center gap-3 ml-auto">
              <Button variant="ghost" size="icon" className="relative h-9 w-9" asChild>
                <Link href="/dashboard/carrinho">
                  <ShoppingCart className="h-5 w-5" />
                  {totalCount > 0 && <span className="absolute -top-1 -right-1 bg-secondary text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-background">{totalCount}</span>}
                </Link>
              </Button>
              <UserNav />
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

export default function SuporteLayout({ children }: { children: React.ReactNode }) {
  return (
    <OrganizationProvider>
      <SuporteLayoutContent>{children}</SuporteLayoutContent>
    </OrganizationProvider>
  )
}
