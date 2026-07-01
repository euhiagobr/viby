
"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { 
  Instagram, 
  Facebook, 
  Linkedin, 
  Youtube, 
  Video, 
  Twitter, 
  Phone, 
  Handshake, 
  Trophy,
  Globe,
  Mail,
  Zap,
  ArrowRight,
  ImageIcon,
  Sparkles
} from "lucide-react"
import { useFirestore, useDoc } from "@/firebase"
import { doc } from "firebase/firestore"
import { useTranslation } from "@/i18n/i18n-context"
import { LanguageSelector } from "./LanguageSelector"
import { CurrencySelector } from "./CurrencySelector"
import { Button } from "../ui/button"
import { Separator } from "../ui/separator"
import { cn } from "@/lib/utils"

export default function Footer() {
  const { t } = useTranslation()
  const db = useFirestore()
  
  const settingsRef = React.useMemo(() => db ? doc(db, "settings", "site") : null, [db])
  const { data: settings } = useDoc<any>(settingsRef)
  
  const contactRef = React.useMemo(() => db ? doc(db, "settings", "contact") : null, [db])
  const { data: contact } = useDoc<any>(contactRef)
  
  const siteName = settings?.siteName || "Viby"

  const socialLinks = React.useMemo(() => [
    { id: 'instagram', icon: Instagram, url: contact?.instagram },
    { id: 'facebook', icon: Facebook, url: contact?.facebook },
    { id: 'twitter', icon: Twitter, url: contact?.twitter },
    { id: 'linkedin', icon: Linkedin, url: contact?.linkedin },
    { id: 'youtube', icon: Youtube, url: contact?.youtube },
    { id: 'tiktok', icon: Video, url: contact?.tiktok },
    { id: 'whatsapp', icon: Phone, url: contact?.whatsapp ? `https://wa.me/${contact.whatsapp.replace(/\D/g, '')}` : null },
  ].filter(s => s.url), [contact]);

  const navGroups = [
    {
      title: "Plataforma",
      links: [
        { label: "Explorar Eventos", href: "/dashboard" },
        { label: "Experiências", href: "/experiencias", icon: Sparkles },
        { label: "Copa do Mundo", href: "/copa-do-mundo" },
        { label: "Anunciar Evento", href: "/anunciar" }
      ]
    },
    {
      title: "Suporte",
      links: [
        { label: "Central de Ajuda", href: "/suporte/faq" },
        { label: "Meus Ingressos", href: "/dashboard/ingressos" },
        { label: "Abrir Chamado", href: "/suporte" }
      ]
    },
    {
      title: "Legal",
      links: [
        { label: "Termos de Uso", href: "/termos" },
        { label: "Privacidade", href: "/privacidade" },
        { label: "Material de Marca", href: "/viby/marca" }
      ]
    }
  ]

  return (
    <footer className="py-20 border-t border-border bg-white mt-auto">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 mb-16">
          {/* Coluna 1: Marca e Redes Sociais */}
          <div className="md:col-span-4 space-y-8">
            <Link href="/" className="flex items-center gap-2 group">
              {settings?.logoUrl ? (
                <Image 
                  src={settings.logoUrl} 
                  alt={siteName} 
                  width={120} 
                  height={32} 
                  style={{ width: 'auto', height: '32px' }}
                  className="object-contain" 
                  unoptimized 
                />
              ) : (
                <span className="font-black text-2xl tracking-tighter italic uppercase text-primary">{siteName}</span>
              )}
            </Link>
            <p className="text-muted-foreground text-sm max-w-sm font-medium leading-relaxed">
              {t('footer.description')}
            </p>
            
            <div className="flex flex-wrap gap-3">
               {socialLinks.map((social) => (
                 <a 
                   key={social.id} 
                   href={social.url} 
                   target="_blank" 
                   rel="noopener noreferrer"
                   className="p-2.5 bg-muted rounded-xl text-muted-foreground hover:bg-secondary hover:text-white transition-all shadow-sm"
                 >
                   <social.icon className="w-4 h-4" />
                 </a>
               ))}
            </div>

            <div className="flex flex-col gap-3">
               <Button asChild variant="outline" className="rounded-xl h-11 px-6 font-black uppercase text-[10px] gap-2 border-[#ffdf00] text-[#002776] bg-[#ffdf00]/10 hover:bg-[#ffdf00]/10 transition-all w-fit">
                  <Link href="/copa-do-mundo">
                     <Trophy className="w-4 h-4" /> Especial Copa 2026
                  </Link>
               </Button>
            </div>
          </div>

          {/* Colunas 2 a 5: Navegação */}
          <div className="md:col-span-8 grid grid-cols-2 lg:grid-cols-4 gap-8">
             {navGroups.map((group) => (
               <div key={group.title} className="space-y-6">
                 <h4 className="text-[10px] font-black uppercase tracking-widest text-primary italic">{group.title}</h4>
                 <ul className="space-y-4">
                   {group.links.map((link) => (
                     <li key={link.href}>
                       <Link href={link.href} className="text-sm font-bold text-muted-foreground hover:text-secondary transition-colors uppercase tracking-tight flex items-center gap-2">
                         {link.icon && <link.icon className="w-3.5 h-3.5 text-secondary fill-secondary" />}
                         {link.label}
                       </Link>
                     </li>
                   ))}
                 </ul>
               </div>
             ))}

             <div className="space-y-6">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-primary italic">Comunidade</h4>
                <ul className="space-y-4">
                   <li>
                      <Link href="/para-organizadores" className="text-sm font-black text-secondary hover:text-primary transition-colors uppercase tracking-tight italic">
                         Para Organizadores
                      </Link>
                   </li>
                   <li>
                      <Link href="/viby/marca" className="text-sm font-bold text-muted-foreground hover:text-secondary transition-colors uppercase tracking-tight flex items-center gap-2">
                         <ImageIcon className="w-3.5 h-3.5" /> Media Kit Oficial
                      </Link>
                   </li>
                </ul>
             </div>
          </div>
        </div>

        <Separator className="border-dashed mb-8" />

        {/* Barra Inferior: Copyright e Seletores */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
           <div className="flex items-center gap-6">
              <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest opacity-60">
                © {new Date().getFullYear()} {siteName} • Todos os direitos reservados
              </p>
           </div>
           
           <div className="flex items-center gap-4 bg-muted/30 p-1.5 rounded-2xl border border-dashed">
              <LanguageSelector />
              <div className="w-px h-4 bg-border" />
              <CurrencySelector />
           </div>
        </div>
      </div>
    </footer>
  )
}
