"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { useAuth, useUser } from "@/firebase"
import { Button } from "@/components/ui/button"
import { UserNav } from "./UserNav"
import { ArrowLeft, Heart, Sparkles } from "lucide-react"
import { useRouter } from "next/navigation"

const PRIDE_LOGO = "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2Fvibydiversidade.png?alt=media&token=fea0711d-c6d1-49ad-bed8-3b10c5a877c4";

/**
 * @fileOverview Cabeçalho temático para a seção LGBTQIAPN+.
 * Utiliza um gradiente estático vibrante e o logotipo da diversidade.
 */
export function PrideHeader() {
  const auth = useAuth()
  const { user } = useUser(auth)
  const router = useRouter()

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-white/20 bg-gradient-to-r from-[#FF0000] via-[#FF8B00] via-[#FFD300] via-[#008121] via-[#004CFF] to-[#760089] h-16 shadow-xl">
      <div className="container mx-auto px-4 h-full flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-6 overflow-hidden h-full">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => router.back()} 
            className="rounded-full shrink-0 text-white hover:bg-white/20"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <Link href="/" className="flex items-center h-full group overflow-hidden py-3">
            <Image 
              src={PRIDE_LOGO} 
              alt="Viby Diversidade" 
              width={180} 
              height={40} 
              className="h-9 w-auto object-contain" 
              priority 
              unoptimized 
            />
          </Link>
        </div>

        <div className="flex items-center gap-3 sm:gap-6 shrink-0 h-full">
          <Link 
            href="/dashboard" 
            className="hidden lg:flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white hover:scale-105 transition-all group"
          >
            <Sparkles className="w-4 h-4 fill-white" /> Explorar Eventos
          </Link>

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
