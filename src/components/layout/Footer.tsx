"use client"

import * as React from "react"
import Link from "next/link"
import { Globe, Instagram } from "lucide-react"
import { useFirestore, useDoc } from "@/firebase"
import { doc } from "firebase/firestore"
import { useTranslation } from "@/i18n/i18n-context"
import { LanguageSelector } from "./LanguageSelector"
import { CurrencySelector } from "./CurrencySelector"

export default function Footer() {
  const { t } = useTranslation()
  const db = useFirestore()
  const settingsRef = React.useMemo(() => db ? doc(db, "settings", "site") : null, [db])
  const { data: settings } = useDoc<any>(settingsRef)
  
  const siteName = settings?.siteName || "Viby"

  return (
    <footer className="py-20 border-t border-border bg-white mt-auto">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-12 mb-16">
          <div className="md:col-span-2 space-y-6">
            <Link href="/" className="flex items-center gap-2">
              {settings?.logoUrl ? (
                <img src={settings.logoUrl} alt={siteName} className="h-10 object-contain" />
              ) : (
                <>
                  <div className="w-10 h-10 bg-secondary rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-xl">{siteName.charAt(0)}</span>
                  </div>
                  <span className="font-bold text-2xl tracking-tighter">{siteName}</span>
                </>
              )}
            </Link>
            <p className="text-muted-foreground text-sm max-w-sm font-medium leading-relaxed">
              {t('footer.description')}
            </p>
          </div>
          <div className="space-y-4">
            <h4 className="font-black uppercase tracking-widest text-xs">{t('footer.platform')}</h4>
            <nav className="flex flex-col gap-3">
              <Link href="/dashboard" className="text-sm font-bold text-muted-foreground hover:text-secondary transition-colors">{t('footer.explore')}</Link>
              <Link href="/cadastro" className="text-sm font-bold text-muted-foreground hover:text-secondary transition-colors">{t('footer.announce')}</Link>
              <Link href="/login" className="text-sm font-bold text-muted-foreground hover:text-secondary transition-colors">{t('footer.login')}</Link>
            </nav>
          </div>
          <div className="space-y-4">
            <h4 className="font-black uppercase tracking-widest text-xs">{t('footer.legal')}</h4>
            <nav className="flex flex-col gap-3">
              <Link href="/termos" className="text-sm font-bold text-muted-foreground hover:text-secondary transition-colors">{t('footer.terms')}</Link>
              <Link href="/privacidade" className="text-sm font-bold text-muted-foreground hover:text-secondary transition-colors">{t('footer.privacy')}</Link>
              <Link href="/dashboard/suporte" className="text-sm font-bold text-muted-foreground hover:text-secondary transition-colors">{t('footer.support')}</Link>
            </nav>
          </div>
          <div className="space-y-4">
            <h4 className="font-black uppercase tracking-widest text-xs">{t('footer.social')}</h4>
            <nav className="flex flex-col gap-3">
              <a 
                href="https://instagram.com/vibyclub" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-sm font-bold text-muted-foreground hover:text-secondary transition-colors flex items-center gap-2"
              >
                <Instagram className="w-4 h-4" />
                Instagram
              </a>
            </nav>
          </div>
        </div>
        <div className="pt-8 border-t border-muted text-center flex flex-col md:flex-row justify-between items-center gap-8">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            {siteName} © 2026 - {t('footer.rights')}
          </p>
          
          <div className="flex flex-wrap items-center justify-center gap-6">
             <div className="flex items-center gap-4">
                <LanguageSelector />
                <CurrencySelector />
             </div>
             <div className="flex items-center gap-2 opacity-30">
                <Globe className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-tighter">Brasil</span>
             </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
