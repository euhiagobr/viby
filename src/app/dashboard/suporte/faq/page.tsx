
"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { 
  ArrowLeft, 
  HelpCircle, 
  User, 
  Ticket, 
  Calendar, 
  CreditCard, 
  ShieldCheck, 
  Globe, 
  MessageCircle,
  Search,
  ChevronRight
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { useTranslation } from "@/i18n/i18n-context"

const FAQ_DATA_PT = [
  {
    category: "Conta e Perfil",
    categoryKey: "account",
    icon: User,
    items: [
      { q: "Como alterar meu nome de usuário?", a: "Atualmente não é possível alterar o nome de usuário após a criação da conta." },
      { q: "Como editar meu perfil?", a: "Acesse seu perfil e clique em “Editar perfil” para alterar foto, bio e outras informações públicas." },
      { q: "Meu perfil é público?", a: "Sim. Algumas informações do perfil são públicas para facilitar conexões e descoberta de eventos." }
    ]
  },
  {
    category: "Ingressos",
    categoryKey: "tickets",
    icon: Ticket,
    items: [
      { q: "Como cancelar um ingresso?", a: "Entre na sua página de ingressos e solicite o cancelamento conforme as regras definidas pelo organizador." },
      { q: "Onde encontro meus ingressos?", a: "Todos os ingressos ficam disponíveis na área “Meus ingressos”." }
    ]
  }
]

const FAQ_DATA_EN = [
  {
    category: "Account and Profile",
    categoryKey: "account",
    icon: User,
    items: [
      { q: "How to change my username?", a: "Currently, it is not possible to change the username after account creation." },
      { q: "How to edit my profile?", a: "Go to your profile and click on “Edit profile” to change your photo, bio, and other public information." },
      { q: "Is my profile public?", a: "Yes. Some profile information is public to facilitate connections and event discovery." }
    ]
  },
  {
    category: "Tickets",
    categoryKey: "tickets",
    icon: Ticket,
    items: [
      { q: "How to cancel a ticket?", a: "Go to your tickets page and request cancellation according to the rules defined by the organizer." },
      { q: "Where do I find my tickets?", a: "All tickets are available in the “My Tickets” area." }
    ]
  }
]

export default function FAQPage() {
  const { t, language } = useTranslation()
  const router = useRouter()
  const [search, setSearch] = React.useState("")

  const faqData = language === 'en-US' ? FAQ_DATA_EN : FAQ_DATA_PT

  const filteredFaq = React.useMemo(() => {
    if (!search) return faqData
    return faqData.map(category => ({
      ...category,
      items: category.items.filter(item => 
        item.q.toLowerCase().includes(search.toLowerCase()) || 
        item.a.toLowerCase().includes(search.toLowerCase())
      )
    })).filter(category => category.items.length > 0)
  }, [search, faqData])

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col gap-6 text-center md:text-left md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
              <HelpCircle className="w-8 h-8 text-secondary" />
              {t('support.title')}
            </h1>
            <p className="text-muted-foreground font-medium">{t('support.subtitle')}</p>
          </div>
        </div>
        
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder={t('support.search_placeholder')} 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-11 rounded-xl border-dashed border-secondary/30 focus-visible:ring-secondary/30"
          />
        </div>
      </div>

      <div className="space-y-10">
        {filteredFaq.length > 0 ? filteredFaq.map((category, idx) => (
          <section key={idx} className="space-y-6">
            <div className="flex items-center gap-3 px-2">
              <div className="p-2 bg-secondary/10 rounded-lg text-secondary">
                <category.icon className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-black uppercase italic tracking-tighter text-primary">{category.category}</h2>
            </div>

            <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
              <CardContent className="p-0">
                <Accordion type="single" collapsible className="w-full">
                  {category.items.map((item, iIdx) => (
                    <AccordionItem key={iIdx} value={`${idx}-${iIdx}`} className="border-b last:border-b-0 px-6 border-muted/50">
                      <AccordionTrigger className="hover:no-underline text-left py-6 font-bold text-sm text-primary hover:text-secondary transition-colors">
                        {item.q}
                      </AccordionTrigger>
                      <AccordionContent className="pb-6 text-sm text-muted-foreground leading-relaxed font-medium">
                        {item.a}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          </section>
        )) : (
          <div className="py-20 text-center bg-white rounded-[3rem] border-2 border-dashed border-border shadow-inner">
             <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-muted-foreground opacity-20" />
             </div>
             <p className="text-muted-foreground font-black uppercase tracking-widest text-xs">{t('support.no_results').replace('{search}', search)}</p>
             <Button variant="link" className="mt-2 text-secondary font-bold" onClick={() => setSearch("")}>{t('support.clear_search')}</Button>
          </div>
        )}
      </div>

      <Card className="border-none shadow-xl rounded-[2.5rem] bg-primary text-white overflow-hidden relative">
        <CardContent className="p-10 flex flex-col md:flex-row items-center gap-8 justify-between relative z-10">
          <div className="space-y-2 text-center md:text-left">
            <h3 className="text-2xl font-black italic uppercase tracking-tighter">{t('support.not_found_title')}</h3>
            <p className="text-sm opacity-70 font-medium">{t('support.not_found_desc')}</p>
          </div>
          <Button asChild className="bg-secondary text-white font-black h-14 px-10 rounded-2xl shadow-xl shadow-secondary/20 uppercase italic transition-all hover:scale-105 gap-2">
            <Link href="/dashboard/suporte">
              <MessageCircle className="w-5 h-5" />
              {t('support.contact_btn')}
            </Link>
          </Button>
        </CardContent>
        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-secondary/10 rounded-full blur-3xl" />
      </Card>
    </div>
  )
}
