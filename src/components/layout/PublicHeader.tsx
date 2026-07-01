
"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { useAuth, useUser, useFirestore, useDoc } from "@/firebase"
import { doc } from "firebase/firestore"
import { Trophy, ArrowLeft, ShoppingCart, Sparkles, Globe } from "lucide-react"
import { Button } from "@/components/ui/button"
import { UserNav } from "./UserNav"
import { useTranslation } from "@/i18n/i18n-context"
import { useRouter, usePathname } from "next/navigation"
import { useCart } from "@/contexts/CartContext"
import { cn } from "@/lib/utils"

interface PublicHeaderProps {
  showBack?: boolean
  hideCopa?: boolean
  children?: React.ReactNode
}

/**
 * @fileOverview Componente centralizado de cabeçalho para todas as páginas públicas da Viby.
 */
export function PublicHeader({ showBack, hideCopa = false, children }: PublicHeaderProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const pathname = usePathname()
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  const { totalCount } = useCart()

  const settingsRef = React.useMemo(() => db ? doc(db, "settings", "site") : null, [db])
  const { data: settings } = useDoc<any>(settingsRef)
  const siteName = settings?.siteName || "Viby"

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md h-16">
      <div className="container mx-auto px-4 h-full flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-4">
          {showBack && (
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}
          <Link href="/" className="flex items-center group">
            {settings?.logoUrl ? (
              <Image 
                src={settings.logoUrl} 
                alt={siteName} 
                width={140} 
                height={40} 
                className="w-auto h-10 object-contain" 
                priority 
                unoptimized 
              />
            ) : (
              <span className="text-lg sm:text-xl font-black italic uppercase text-primary truncate ml-1">{siteName}</span>
            )}
          </Link>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 shrink-0 h-full">
          {/* Navegação Principal Desktop */}
          <div className="hidden lg:flex items-center gap-8 mr-6 h-8 border-r border-border/40 pr-8">
            <Link 
              href="/dashboard" 
              className={cn(
                "text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2",
                (pathname === '/dashboard' || pathname === '/') ? "text-secondary" : "text-primary/60 hover:text-primary"
              )}
            >
              <Globe className="w-3.5 h-3.5" /> Explorar
            </Link>
            <Link 
              href="/experiencias" 
              className={cn(
                "text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2",
                pathname?.startsWith('/experiencias') ? "text-secondary" : "text-primary/60 hover:text-primary"
              )}
            >
              <Sparkles className="w-3.5 h-3.5 fill-current" /> Experiências
            </Link>
          </div>

          {!hideCopa && (
            <Button asChild variant="outline" className="hidden md:flex rounded-full h-9 border-[#ffdf00] bg-[#ffdf00]/10 text-[#002776] font-black uppercase text-[9px] gap-2">
               <Link href="/copa-do-mundo"><Trophy className="w-3.5 h-3.5" /> Copa 2026</Link>
            </Button>
          )}
          
          {children}

          {totalCount > 0 && (
            <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-full border-2 border-secondary/20 p-0 hover:bg-secondary/5 transition-all" asChild>
              <Link href="/dashboard/carrinho">
                <ShoppingCart className="h-5 w-5 text-secondary" />
                <span className="absolute -top-1 -right-1 bg-primary text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-background animate-in zoom-in-50 duration-300">
                  {totalCount}
                </span>
              </Link>
            </Button>
          )}

          {user ? <UserNav /> : (
            <div className="flex items-center gap-1 sm:gap-2">
              <Button variant="ghost" asChild className="font-bold uppercase text-[9px] sm:text-[10px] tracking-widest px-2 sm:px-4">
                <Link href="/login">Entrar</Link>
              </Button>
              <Button asChild className="bg-primary text-white font-black uppercase italic text-[9px] sm:text-[10px] tracking-widest rounded-full px-4 sm:px-6 shadow-lg">
                <Link href="/cadastro">Criar Conta</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
