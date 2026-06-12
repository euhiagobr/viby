"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { MapPinOff, ArrowLeft, Home } from "lucide-react"
import { useFirestore, useDoc } from "@/firebase"
import { doc } from "firebase/firestore"
import { useTranslation } from "@/i18n/i18n-context"

export default function NotFound() {
  const { t } = useTranslation()
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
            {settings?.logoUrl ? (
               <Image src={settings.logoUrl} alt={siteName} width={120} height={40} className="w-20 h-auto object-contain" unoptimized />
            ) : (
               <div className="w-16 h-16 bg-secondary rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-white font-black text-2xl">V</span>
               </div>
            )}
          </div>
          
          <h1 className="text-8xl md:text-9xl font-black text-primary uppercase italic tracking-tighter leading-none mb-4">
            404
          </h1>
          <h2 className="text-2xl md:text-3xl font-black uppercase italic tracking-tight text-primary">
            {t('error.404_subtitle').split(' ')[0]} <span className="text-secondary">{t('error.404_subtitle').split(' ').slice(1).join(' ')}</span>
          </h2>
          <p className="mt-6 text-muted-foreground font-medium max-sm mx-auto leading-relaxed">
            {t('error.404_desc')}
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 w-full max-md mx-auto">
        <Button 
          variant="outline" 
          onClick={() => window.history.back()} 
          className="flex-1 h-14 rounded-2xl font-black uppercase italic border-2 gap-2 border-primary/10"
        >
          <ArrowLeft className="w-5 h-5" /> {t('error.back')}
        </Button>
        <Button 
          asChild 
          className="flex-1 h-14 bg-primary text-white font-black rounded-2xl shadow-xl uppercase italic gap-2 hover:bg-secondary transition-colors"
        >
          <Link href="/">
            <Home className="w-5 h-5" /> {t('error.home')}
          </Link>
        </Button>
      </div>

      <div className="mt-20 opacity-20">
         <span className="text-xs font-black uppercase tracking-[0.5em]">{siteName}</span>
      </div>
    </div>
  )
}
