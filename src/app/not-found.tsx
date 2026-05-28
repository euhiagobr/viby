"use client"

import * as React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { MapPinOff, ArrowLeft, Home } from "lucide-react"
import { useFirestore, useDoc } from "@/firebase"
import { doc } from "firebase/firestore"

export default function NotFound() {
  const db = useFirestore()
  const settingsRef = React.useMemo(() => db ? doc(db, "settings", "site") : null, [db])
  const { data: settings } = useDoc<any>(settingsRef)
  
  const siteName = settings?.siteName || "Viby"

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-4 text-center">
      <div className="relative w-full max-w-lg mb-12">
        <div className="absolute inset-0 bg-secondary/10 blur-3xl rounded-full" />
        <div className="relative">
          <div className="w-24 h-24 bg-white rounded-[2rem] shadow-2xl flex items-center justify-center mx-auto mb-8 animate-bounce">
            <MapPinOff className="w-12 h-12 text-secondary" />
          </div>
          
          <h1 className="text-8xl md:text-9xl font-black text-primary uppercase italic tracking-tighter leading-none mb-4">
            404
          </h1>
          <h2 className="text-2xl md:text-3xl font-black uppercase italic tracking-tight text-primary">
            Experiência <span className="text-secondary">Não Encontrada</span>
          </h2>
          <p className="mt-6 text-muted-foreground font-medium max-w-sm mx-auto leading-relaxed">
            Parece que você tentou acessar um evento que não existe mais ou um endereço inválido na rede.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
        <Button 
          variant="outline" 
          onClick={() => window.history.back()} 
          className="flex-1 h-14 rounded-2xl font-black uppercase italic border-2 gap-2 border-primary/10"
        >
          <ArrowLeft className="w-5 h-5" /> Voltar
        </Button>
        <Button 
          asChild 
          className="flex-1 h-14 bg-primary text-white font-black rounded-2xl shadow-xl uppercase italic gap-2 hover:bg-secondary transition-colors"
        >
          <Link href="/">
            <Home className="w-5 h-5" /> Ir ao Início
          </Link>
        </Button>
      </div>

      <div className="mt-20 opacity-20">
         <span className="text-xs font-black uppercase tracking-[0.5em]">{siteName}</span>
      </div>
    </div>
  )
}
