
"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { Globe, Instagram, Facebook, Linkedin, Youtube, Video, Twitter, Mail, Phone, Handshake, Trophy } from "lucide-react"
import { useFirestore, useDoc } from "@/firebase"
import { doc } from "firebase/firestore"
import { useTranslation } from "@/i18n/i18n-context"
import { LanguageSelector } from "./LanguageSelector"
import { CurrencySelector } from "./CurrencySelector"
import { Button } from "../ui/button"

export default function Footer() {
  const { t } = useTranslation()
  const db = useFirestore()
  
  const settingsRef = React.useMemo(() => db ? doc(db, "settings", "site") : null, [db])
  const { data: settings } = useDoc<any>(settingsRef)
  
  const contactRef = React.useMemo(() => db ? doc(db, "settings", "contact") : null, [db])
  const { data: contact } = useDoc<any>(contactRef)
  
  const siteName = settings?.siteName || "Viby"

  return (
    <footer className="py-20 border-t border-border bg-white mt-auto">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-12 mb-16">
          <div className="md:col-span-2 space-y-6">
            <Link href="/" className="flex items-center gap-2 group">
              {settings?.logoUrl ? (
                <Image src={settings.logoUrl} alt={siteName} width={120} height={40} className="h-10 w-auto object-contain transition-transform group-hover:scale-105" unoptimized />
              ) : (
                <span className="font-bold text-2xl tracking-tighter">{siteName}</span>
              )}
            </Link>
            <p className="text-muted-foreground text-sm max-w-sm font-medium leading-relaxed">
              {t('footer.description')}
            </p>
            <div className="pt-4 flex flex-col gap-2">
               <Button asChild variant="outline" className="rounded-xl h-11 px-6 font-black uppercase text-[10px] gap-2 border-[#ffdf00] text-[#002776] bg-[#ffdf00]/5 hover:bg-[#ffdf00]/10 transition-all">
                  <Link href="/copa-do-mundo">
                     <Trophy className="w-4 h-4" /> Especial Copa 2026
                  </Link>
               </Button>
               <Button asChild variant="outline" className="rounded-xl h-11 px-6 font-black uppercase text-[10px] gap-2 border-secondary text-secondary hover:bg-secondary hover:text-white transition-all shadow-sm">
                  <Link href="/ganhe-dinheiro">
                     <Handshake className="w-4 h-4" /> Ganhe Dinheiro com a Viby
                  </Link>
               </Button>
            </div>
          </div>
          <div className="space-y-4">
            <h4 className="font-black uppercase tracking-widest text-xs">{t('footer.platform')}</h4>
            <nav className="flex flex-col gap-3">
              <Link href="/dashboard" className="text-sm font-bold text-muted-foreground hover:text-secondary transition-colors">{t('footer.explore')}</Link>
              <Link href="/copa-do-mundo" className="text-sm font-bold text-secondary hover:underline transition-colors flex items-center gap-1.5"><Trophy className="w-3 h-3" /> Copa do Mundo</Link>
              <Link href="/para-organizadores" className="text-sm font-bold text-muted-foreground hover:text-secondary transition-colors">{t('footer.announce')}</Link>
            </nav>
          </div>
          <div className="space-y-4">
            <h4 className="font-black uppercase tracking-widest text-xs">{t('footer.legal')}</h4>
            <nav className="flex flex-col gap-3">
              <Link href="/termos" className="text-sm font-bold text-muted-foreground hover:text-secondary transition-colors">{t('footer.terms')}</Link>
              <Link href="/privacidade" className="text-sm font-bold text-muted-foreground hover:text-secondary transition-colors">{t('footer.privacy')}</Link>
              <Link href="/suporte" className="text-sm font-bold text-muted-foreground hover:text-secondary transition-colors">{t('footer.support')}</Link>
            </nav>
          </div>
          <div className="space-y-4">
            <h4 className="font-black uppercase tracking-widest text-xs">{t('footer.social')}</h4>
            <nav className="flex flex-col gap-3">
              {contact?.instagram && (
                <a href={contact.instagram} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-muted-foreground hover:text-secondary transition-colors flex items-center gap-2">
                  <Instagram className="w-4 h-4" /> Instagram
                </a>
              )}
              {contact?.whatsapp && (
                <a href={`https://wa.me/${contact.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-muted-foreground hover:text-secondary transition-colors flex items-center gap-2">
                  <Phone className="w-4 h-4" /> WhatsApp
                </a>
              )}
              {contact?.email && (
                <a href={`mailto:${contact.email}`} className="text-sm font-bold text-muted-foreground hover:text-secondary transition-colors flex items-center gap-2">
                  <Mail className="w-4 h-4" /> E-mail
                </a>
              )}
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
