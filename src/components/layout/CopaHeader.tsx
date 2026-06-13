"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { useAuth, useUser } from "@/firebase"
import { signOut } from "firebase/auth"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { toast } from "@/hooks/use-toast"
import { LogOut, User, Trophy, ArrowLeft } from "lucide-react"

const COPA_LOGO = "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2Fvibybrasil.png?alt=media&token=";

export function CopaHeader() {
  const auth = useAuth()
  const { user } = useUser(auth)
  const router = useRouter()

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
          <Link href="/copa-do-mundo" className="flex items-center group shrink-0">
            <Image 
              src={COPA_LOGO} 
              alt="Viby Brasil" 
              width={180} 
              height={48} 
              className="h-10 w-auto object-contain transition-transform group-hover:scale-105" 
              priority 
              unoptimized 
            />
          </Link>
          
          <Link 
            href="/" 
            className="hidden lg:flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/60 hover:text-white transition-all group"
          >
            <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" /> Voltar ao site principal
          </Link>
        </div>

        <div className="flex items-center gap-6 md:gap-8">
          <Link 
            href="/copa-do-mundo/tabela" 
            className="text-[10px] font-black uppercase tracking-widest text-white hover:text-[#ffdf00] transition-colors flex items-center gap-2"
          >
            <Trophy className="w-4 h-4" /> 
            <span className="hidden sm:inline">Tabela de Jogos</span>
            <span className="sm:hidden">Tabela</span>
          </Link>

          {user ? (
            <div className="flex items-center gap-6 border-l border-white/10 pl-6 md:pl-8">
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
               <Link href="/login">Entrar</Link>
            </Button>
          )}
        </div>
      </div>
    </nav>
  )
}
