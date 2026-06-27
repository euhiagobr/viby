
"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { useAuth, useUser, useFirestore, useDoc } from "@/firebase"
import { doc } from "firebase/firestore"
import { ArrowLeft, ShoppingCart, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { UserNav } from "./UserNav"
import { useRouter } from "next/navigation"
import { useCart } from "@/contexts/CartContext"
import { cn } from "@/lib/utils"

interface ThematicHeaderProps {
  themeColor: string
  logoUrl?: string
  title: string
  showBack?: boolean
}

export function ThematicHeader({ themeColor, logoUrl, title, showBack }: ThematicHeaderProps) {
  const router = useRouter()
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  const { totalCount } = useCart()

  const settingsRef = React.useMemo(() => db ? doc(db, "settings", "site") : null, [db])
  const { data: settings } = useDoc<any>(settingsRef)
  const siteName = settings?.siteName || "Viby"

  return (
    <nav 
      className={cn(
        "sticky top-0 z-50 w-full border-b border-white/10 backdrop-blur-md h-16 shadow-xl",
        themeColor
      )}
    >
      <div className="container mx-auto px-4 h-full flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-6">
          {showBack && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => router.back()} 
              className="rounded-full shrink-0 text-white hover:bg-white/20"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}
          <Link href="/" className="flex items-center group">
            {logoUrl ? (
              <Image 
                src={logoUrl} 
                alt={title} 
                width={180} 
                height={40} 
                className="h-10 w-auto object-contain" 
                priority 
                unoptimized 
              />
            ) : (
              <span className="text-xl font-black italic uppercase text-white truncate">{title}</span>
            )}
          </Link>
        </div>

        <div className="flex items-center gap-3 sm:gap-6 shrink-0 h-full">
          <Link 
            href="/dashboard" 
            className="hidden lg:flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white hover:scale-105 transition-all group"
          >
            <Sparkles className="w-4 h-4 fill-white" /> Explorar Eventos
          </Link>

          {totalCount > 0 && (
            <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-full border-2 border-white/20 p-0 hover:bg-white/10 transition-all" asChild>
              <Link href="/dashboard/carrinho">
                <ShoppingCart className="h-5 w-5 text-white" />
                <span className="absolute -top-1 -right-1 bg-white text-primary text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-primary animate-in zoom-in-50 duration-300">
                  {totalCount}
                </span>
              </Link>
            </Button>
          )}

          {user ? <UserNav /> : (
            <div className="flex items-center gap-1 sm:gap-2">
              <Button variant="ghost" asChild className="text-white hover:bg-white/10 font-bold uppercase text-[9px] sm:text-[10px] tracking-widest px-2 sm:px-4">
                <Link href="/login">Entrar</Link>
              </Button>
              <Button asChild className="bg-white text-primary hover:bg-muted font-black uppercase italic text-[9px] sm:text-[10px] tracking-widest rounded-full px-4 sm:px-6 shadow-lg border-none">
                <Link href="/cadastro">Criar Conta</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
