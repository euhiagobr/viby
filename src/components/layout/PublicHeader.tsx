"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { useState } from "react"
import { Menu, X, LogOut, User, ShoppingCart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth, useUser } from "@/firebase"
import { signOut } from "firebase/auth"
import { useRouter } from "next/navigation"
import { toast } from "@/hooks/use-toast"
import { useCart } from "@/contexts/CartContext"
import { useFirestore, useDoc } from "@/firebase"
import { doc } from "firebase/firestore"

interface PublicHeaderProps {
  texts?: {
    announce?: string;
    dashboard?: string;
    login?: string;
  }
  showBack?: boolean;
}

export function PublicHeader({ texts = {}, showBack = false }: PublicHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const auth = useAuth()
  const { user } = useUser(auth)
  const router = useRouter()
  const { totalCount } = useCart()
  const db = useFirestore()
  const settingsRef = React.useMemo(() => (db ? doc(db, "settings", "site") : null), [db])
  const { data: settings } = useDoc<any>(settingsRef)

  const headerTexts = {
    announce: texts.announce && !texts.announce.includes('[') ? texts.announce : 'Anunciar',
    dashboard: texts.dashboard && !texts.dashboard.includes('[') ? texts.dashboard : 'Dashboard',
    login: texts.login && !texts.login.includes('[') ? texts.login : 'Entrar',
  }

  const handleLogout = async () => {
    if (!auth) return
    try {
      await signOut(auth)
      toast({ title: "Até logo!" })
      router.push("/")
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao sair" })
    }
  }

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-white/10 bg-[#002776]/95 backdrop-blur-md h-20 shadow-2xl">
      <div className="container mx-auto px-4 h-full flex items-center justify-between">
        <div className="flex items-center gap-10">
          <Link href="/" className="flex items-center group shrink-0">
            {settings?.whiteLogoUrl ? (
              <Image 
                src={settings.whiteLogoUrl} 
                alt={settings?.siteName || "Viby"} 
                width={180} 
                height={48} 
                className="h-10 w-auto object-contain transition-transform group-hover:scale-105" 
                priority 
                unoptimized 
              />
            ) : settings?.logoUrl ? (
              <Image 
                src={settings.logoUrl} 
                alt={settings?.siteName || "Viby"} 
                width={180} 
                height={48} 
                className="h-10 w-auto object-contain transition-transform group-hover:scale-105" 
                priority 
                unoptimized 
              />
            ) : (
              <span className="font-bold text-xl tracking-tighter text-white">
                {settings?.siteName || "Viby"}
              </span>
            )}
          </Link>
        </div>

        <div className="flex items-center gap-6 md:gap-8">
          {totalCount > 0 && (
            <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-full border-2 border-white/10 p-0 hover:bg-white/5 transition-all" asChild>
              <Link href="/dashboard/carrinho">
                <ShoppingCart className="h-5 w-5 text-white" />
                <span className="absolute -top-1 -right-1 bg-[#ffdf00] text-[#002776] text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-[#002776]">
                  {totalCount}
                </span>
              </Link>
            </Button>
          )}

          {user ? (
            <div className="flex items-center gap-6 border-l border-white/10 pl-6 md:pl-8">
              <Link 
                href="/dashboard" 
                className="text-[10px] font-black uppercase tracking-widest text-white hover:text-[#ffdf00] transition-colors flex items-center gap-2"
              >
                {headerTexts.dashboard}
              </Link>
              <Link 
                href="/dashboard/perfil" 
                className="text-[10px] font-black uppercase tracking-widest text-white hover:text-[#ffdf00] transition-colors flex items-center gap-2"
              >
                <User className="w-4 h-4" /> 
                <span className="hidden sm:inline">Meu Perfil</span>
              </Link>
              <button 
                onClick={handleLogout}
                className="text-[10px] font-black uppercase tracking-widest text-red-400 hover:text-red-300 transition-colors flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" /> 
                <span className="hidden sm:inline">Sair</span>
              </button>
            </div>
          ) : (
            <Button asChild variant="outline" className="rounded-full h-10 border-white/20 text-white hover:bg-white/10 font-black uppercase text-[10px] px-6">
              <Link href="/login">{headerTexts.login}</Link>
            </Button>
          )}

          {/* Mobile Menu Toggle */}
          <div className="md:hidden">
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-white/80 hover:bg-white/10"
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-[#002776]">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            <Link href="/anunciar" className="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-white hover:bg-white/5">
              {headerTexts.announce}
            </Link>
            <Link href="/dashboard" className="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-white hover:bg-white/5">
              {headerTexts.dashboard}
            </Link>
          </div>
        </div>
      )}
    </nav>
  )
}
