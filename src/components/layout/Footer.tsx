"use client"

import * as React from "react"
import Link from "next/link"
import { Globe } from "lucide-react"
import { useFirestore, useDoc } from "@/firebase"
import { doc } from "firebase/firestore"

export function Footer() {
  const db = useFirestore()
  const settingsRef = React.useMemo(() => db ? doc(db, "settings", "site") : null, [db])
  const { data: settings } = useDoc<any>(settingsRef)
  
  const siteName = settings?.siteName || "Viby"

  return (
    <footer className="py-20 border-t border-border bg-white mt-auto">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          <div className="md:col-span-2 space-y-6">
            <Link href="/" className="flex items-center gap-2">
              {settings?.logoUrl ? (
                <img src={settings.logoUrl} alt={siteName} className="h-8 object-contain" />
              ) : (
                <>
                  <div className="w-8 h-8 bg-secondary rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-lg">{siteName.charAt(0)}</span>
                  </div>
                  <span className="font-bold text-2xl tracking-tighter">{siteName}</span>
                </>
              )}
            </Link>
            <p className="text-muted-foreground text-sm max-w-sm font-medium leading-relaxed">
              Transformando a descoberta de eventos no Brasil através de tecnologia e experiências inteligentes. Encontre o seu próximo destino aqui.
            </p>
          </div>
          <div className="space-y-4">
            <h4 className="font-black uppercase tracking-widest text-xs">Plataforma</h4>
            <nav className="flex flex-col gap-3">
              <Link href="/dashboard" className="text-sm font-bold text-muted-foreground hover:text-secondary transition-colors">Explorar</Link>
              <Link href="/cadastro" className="text-sm font-bold text-muted-foreground hover:text-secondary transition-colors">Anunciar Evento</Link>
              <Link href="/login" className="text-sm font-bold text-muted-foreground hover:text-secondary transition-colors">Entrar</Link>
            </nav>
          </div>
          <div className="space-y-4">
            <h4 className="font-black uppercase tracking-widest text-xs">Legal</h4>
            <nav className="flex flex-col gap-3">
              <Link href="/termos" className="text-sm font-bold text-muted-foreground hover:text-secondary transition-colors">Termos de Uso</Link>
              <Link href="/privacidade" className="text-sm font-bold text-muted-foreground hover:text-secondary transition-colors">Privacidade</Link>
              <Link href="/dashboard/suporte" className="text-sm font-bold text-muted-foreground hover:text-secondary transition-colors">Suporte</Link>
            </nav>
          </div>
        </div>
        <div className="pt-8 border-t border-muted text-center flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
            {siteName} © 2024 - Todos os direitos reservados.
          </p>
          <div className="flex items-center gap-4 opacity-30">
             <Globe className="w-4 h-4" />
             <span className="text-[10px] font-bold uppercase">Brasil</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
