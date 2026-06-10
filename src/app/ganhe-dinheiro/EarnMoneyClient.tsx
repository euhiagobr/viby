"use client"

import * as React from "react"
import { useFirestore, useAuth, useUser } from "@/firebase"
import { doc } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  Zap, 
  TrendingUp, 
  ShieldCheck, 
  ArrowRight, 
  CheckCircle2, 
  Target, 
  Users, 
  Trophy,
  Copy,
  Star,
  Building2,
  Wallet,
  Loader2,
  Check,
  Music,
  Beer,
  Map as MapIcon,
  Video,
  Megaphone,
  HelpCircle,
  ChevronRight,
  Sparkles
} from "lucide-react"
import Link from "next/link"
import { toast } from "@/hooks/use-toast"
import { AFFILIATE_LEVELS, getAffiliateLevel, getNextLevel } from "@/lib/affiliate-utils"
import { formatCurrency } from "@/lib/financial-utils"
import Footer from "@/components/layout/Footer"
import { useTranslation } from "@/i18n/i18n-context"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

export default function EarnMoneyClient() {
  const { t } = useTranslation()
  const db = useFirestore()
  const auth = useAuth()
  const { user, profile } = useUser(auth)
  const [copiedLink, setCopiedLink] = React.useState(false)
  const [copiedCode, setCopiedCode] = React.useState(false)

  const statsRef = React.useMemo(() => (db && user) ? doc(db, "affiliate_stats", user.uid) : null, [db, user])
  const { data: stats } = useDoc<any>(statsRef)

  const affiliateLink = React.useMemo(() => {
    if (typeof window === 'undefined' || !profile?.affiliateCode) return ""
    return `${window.location.origin}/cadastro?ref=${profile.affiliateCode}`
  }, [profile?.affiliateCode])

  const handleCopyLink = () => {
    if (!user) {
      toast({ title: "Ação necessária", description: "Faça login para pegar seu link." })
      return
    }
    navigator.clipboard.writeText(affiliateLink)
    setCopiedLink(true)
    toast({ title: "Link copiado!", description: "Comece a indicar agora!" })
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const handleCopyCode = () => {
    if (!profile?.affiliateCode) return
    navigator.clipboard.writeText(profile.affiliateCode)
    setCopiedCode(true)
    toast({ title: "Código copiado!" })
    setTimeout(() => setCopiedCode(false), 2000)
  }

  const initialCommission = AFFILIATE_LEVELS[0].commission;
  const earningExamples = [
    { tickets: 100, gain: 100 * initialCommission },
    { tickets: 500, gain: 500 * initialCommission },
    { tickets: 1000, gain: 1000 * initialCommission },
    { tickets: 5000, gain: 5000 * initialCommission }
  ];

  const personas = [
    { title: "Produtores de Eventos", icon: Building2 },
    { title: "Influenciadores", icon: Star },
    { title: "Criadores de Conteúdo", icon: Video },
    { title: "Agências de Marketing", icon: Megaphone },
    { title: "Casas de Shows", icon: Music },
    { title: "Bares e Restaurantes", icon: Beer },
    { title: "Guias de Turismo", icon: MapIcon },
    { title: "Coletivos e Organizações", icon: Users }
  ];

  const steps = [
    { step: "PASSO 1", desc: "Compartilhe seu link exclusivo." },
    { step: "PASSO 2", desc: "O produtor cria uma conta utilizando seu link." },
    { step: "PASSO 3", desc: "Ele cria eventos e vende ingressos." },
    { step: "PASSO 4", desc: "Você recebe comissão automaticamente pelas vendas elegíveis." }
  ];

  const faqs = [
    { q: "Como recebo minhas comissões?", a: "As comissões são creditadas na moeda da transação (BRL, USD, EUR) e podem ser sacadas para sua conta bancária ou PIX configurada no painel de afiliado." },
    { q: "Quanto tempo dura uma indicação?", a: "Você recebe comissão pelas vendas elegíveis realizadas pelos usuários indicados durante os primeiros 365 dias após o cadastro do indicado na plataforma." },
    { q: "Posso indicar quantas pessoas quiser?", a: "Sim! Não há limite de indicações. Quanto mais produtores você trouxer para a rede, maior será seu potencial de ganhos passivos." },
    { q: "Existe valor mínimo para saque?", a: "Sim, o valor mínimo para solicitação de saque é de R$ 50,00 ou o equivalente em outras moedas suportadas." },
    { q: "Posso acompanhar meus ganhos em tempo real?", a: "Com certeza. No seu Painel de Afiliado, você visualiza cada venda processada, o saldo pendente e o saldo disponível para resgate." },
    { q: "Quando o pagamento é liberado?", a: "As comissões geralmente ficam disponíveis para saque 7 dias após a confirmação da venda do ingresso pelo sistema." }
  ];

  const currentAffLevel = getAffiliateLevel(stats?.totalTicketsSold || 0)
  const nextAffLevel = getNextLevel(stats?.totalTicketsSold || 0)
  const affProgress = nextAffLevel ? ((stats?.totalTicketsSold || 0) / nextAffLevel.minSales) * 100 : 100

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Programa de Afiliados Viby",
    "description": "Ganhe dinheiro indicando produtores de eventos para a plataforma Viby.",
    "publisher": {
      "@type": "Organization",
      "name": "Viby"
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col selection:bg-secondary selection:text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-secondary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">V</span>
            </div>
            <span className="text-xl font-bold tracking-tight italic uppercase">Viby</span>
          </Link>
          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild className="font-bold uppercase text-[10px] tracking-widest">
              <Link href="/">Início</Link>
            </Button>
            {user ? (
               <Button asChild className="bg-primary text-white font-black uppercase italic text-[10px] tracking-widest rounded-full px-6 shadow-lg">
                  <Link href="/dashboard/afiliados">Meu Painel Afiliado</Link>
               </Button>
            ) : (
               <Button asChild className="bg-secondary text-white font-black uppercase italic text-[10px] tracking-widest rounded-full px-6 shadow-lg shadow-secondary/20">
                  <Link href="/cadastro">Criar Conta Grátis</Link>
               </Button>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative py-20 md:py-32 overflow-hidden bg-primary text-white text-center">
         <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-secondary/20 via-transparent to-transparent opacity-50" />
         <div className="container mx-auto px-4 relative z-10">
            <div className="max-w-4xl mx-auto space-y-8">
               <Badge className="bg-secondary text-white border-none px-4 py-1.5 rounded-full font-black uppercase text-[10px] tracking-widest w-fit mx-auto flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 fill-current" /> Monetize sua influência
               </Badge>
               <h1 className="text-5xl md:text-8xl font-black uppercase italic tracking-tighter leading-[0.8]">GANHE DINHEIRO COM A <span className="text-secondary">VIBY</span></h1>
               <p className="text-lg md:text-2xl font-medium opacity-80 max-w-2xl mx-auto leading-relaxed">Indique organizadores, promotores e marcas. Receba comissões automáticas por cada ingresso vendido.</p>
               
               <div className="flex flex-col items-center justify-center gap-4 pt-6">
                  {user ? (
                    <div className="w-full max-w-lg space-y-4">
                       <Card className="bg-white/10 backdrop-blur-md border-white/20 p-6 rounded-[2rem] text-left">
                          <CardContent className="p-0 space-y-6">
                             <div className="flex justify-between items-end">
                                <div className="space-y-1">
                                   <p className="text-[9px] font-black uppercase tracking-widest opacity-60">Seu Código Único</p>
                                   <p className="text-3xl font-black italic tracking-tighter text-secondary">{profile?.affiliateCode || "..........."}</p>
                                </div>
                                <Button onClick={handleCopyCode} variant="secondary" size="sm" className="rounded-xl h-10 px-4 font-bold gap-2">
                                   {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copiedCode ? "Copiado" : "Código"}
                                </Button>
                             </div>
                             <Separator className="bg-white/10" />
                             <div className="space-y-3">
                                <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Seu Link de Indicação</p>
                                <div className="flex gap-2">
                                   <Input value={affiliateLink} readOnly className="bg-white/5 border-white/10 h-12 text-xs font-medium rounded-xl focus-visible:ring-0" />
                                   <Button onClick={handleCopyLink} className="bg-secondary text-white h-12 px-6 rounded-xl font-bold uppercase italic shadow-lg">
                                      {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                   </Button>
                                </div>
                             </div>
                          </CardContent>
                       </Card>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row gap-4">
                       <Button asChild className="h-20 px-12 bg-secondary text-white font-black rounded-[2rem] shadow-2xl shadow-secondary/30 uppercase italic text-xl hover:scale-105 transition-all">
                          <Link href="/cadastro">Começar Agora <ArrowRight className="w-6 h-6 ml-2" /></Link>
                       </Button>
                       <Button asChild variant="outline" className="h-20 px-12 border-white/20 text-white font-black rounded-[2rem] uppercase italic text-xl hover:bg-white/10">
                          <Link href="/login">Já tenho conta</Link>
                       </Button>
                    </div>
                  )}
               </div>
            </div>
         </div>
      </section>

      {/* Seção Ganhos */}
      <section className="py-24 bg-white">
         <div className="container mx-auto px-4">
            <div className="text-center mb-16 space-y-2">
               <h2 className="text-4xl font-black uppercase italic tracking-tighter text-primary">Quanto você pode ganhar?</h2>
               <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest">Simulação baseada em vendas de indicados.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
               {earningExamples.map((ex, i) => (
                 <Card key={i} className="border-none shadow-sm bg-muted/30 rounded-[2rem] p-8 text-center group hover:bg-secondary/5 transition-all">
                    <div className="space-y-4">
                       <p className="text-xs font-black uppercase text-muted-foreground opacity-60">{ex.tickets.toLocaleString()} ingressos vendidos</p>
                       <p className="text-4xl font-black text-primary italic tracking-tighter">{formatCurrency(ex.gain)}</p>
                       <div className="w-10 h-1 bg-secondary mx-auto rounded-full group-hover:w-20 transition-all" />
                    </div>
                 </Card>
               ))}
            </div>
            <p className="text-center text-[10px] font-bold text-muted-foreground uppercase mt-10 opacity-40">Ganhos reais variam conforme seu nível e volume de vendas.</p>
         </div>
      </section>

      {/* Fluxo Funcionamento */}
      <section className="py-24 bg-muted/30">
         <div className="container mx-auto px-4">
            <div className="text-center mb-16 space-y-2">
               <h2 className="text-4xl font-black uppercase italic tracking-tighter text-primary">Como Funciona</h2>
               <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest text-secondary">4 etapas para começar a lucrar.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 max-w-6xl mx-auto">
               {steps.map((s, i) => (
                 <div key={i} className="relative flex flex-col items-center text-center gap-6 group">
                    <div className="w-16 h-16 bg-white rounded-2xl shadow-xl flex items-center justify-center text-secondary font-black italic text-xl border border-border/50 group-hover:bg-secondary group-hover:text-white transition-all">
                       {i + 1}
                    </div>
                    <div className="space-y-2">
                       <h3 className="text-xs font-black uppercase italic text-primary">{s.step}</h3>
                       <p className="text-sm text-muted-foreground font-medium leading-relaxed max-w-[200px]">{s.desc}</p>
                    </div>
                    {i < 3 && <ArrowRight className="absolute top-8 -right-4 w-6 h-6 text-border hidden md:block" />}
                 </div>
               ))}
            </div>
            <div className="mt-16 p-6 bg-white rounded-[2rem] border-2 border-dashed border-secondary/20 max-w-3xl mx-auto flex items-start gap-4">
               <Info className="w-6 h-6 text-secondary shrink-0 mt-0.5" />
               <p className="text-sm font-medium text-primary/80 leading-relaxed">Você recebe comissão pelas vendas elegíveis realizadas pelos usuários indicados durante os primeiros 365 dias após o cadastro.</p>
            </div>
         </div>
      </section>

      {/* Quem Ganha */}
      <section className="py-24 bg-white">
         <div className="container mx-auto px-4">
            <div className="text-center mb-16 space-y-2">
               <h2 className="text-4xl font-black uppercase italic tracking-tighter text-primary">Quem mais ganha com a Viby</h2>
               <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest">Diversos perfis monetizando sua rede.</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-6xl mx-auto">
               {personas.map((p, i) => (
                 <div key={i} className="p-8 bg-muted/20 rounded-[2rem] flex flex-col items-center text-center gap-4 hover:bg-white hover:shadow-xl transition-all border border-transparent hover:border-border">
                    <div className="p-4 bg-white rounded-2xl shadow-md text-secondary group-hover:scale-110 transition-transform">
                       <p.icon className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-black uppercase italic text-primary leading-tight">{p.title}</span>
                 </div>
               ))}
            </div>
         </div>
      </section>

      {/* Seção de Níveis */}
      <section className="py-24 bg-primary text-white overflow-hidden relative">
         <div className="container mx-auto px-4 relative z-10">
            <div className="text-center mb-16 space-y-2">
               <h2 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter">Níveis de Progressão</h2>
               <p className="text-secondary font-black uppercase text-[10px] tracking-widest">Quanto mais seus indicados vendem, maior sua comissão.</p>
            </div>

            {user && stats && (
              <div className="max-w-4xl mx-auto mb-16 p-8 bg-white/5 backdrop-blur-md rounded-[2.5rem] border border-white/10 space-y-6">
                 <div className="flex justify-between items-end">
                    <div className="space-y-1">
                       <p className="text-[10px] font-black uppercase opacity-40">Seu Progresso Atual</p>
                       <p className="text-3xl font-black italic tracking-tighter">{currentAffLevel.label} <span className="text-secondary">Lv. {currentAffLevel.level}</span></p>
                    </div>
                    {nextAffLevel && (
                       <p className="text-[10px] font-black uppercase opacity-40">Faltam {nextAffLevel.minSales - (stats.totalTicketsSold || 0)} vendas para o próximo nível</p>
                    )}
                 </div>
                 <Progress value={affProgress} className="h-3 rounded-full bg-white/10" />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
               {AFFILIATE_LEVELS.map((level) => {
                 const isCurrent = currentAffLevel?.level === level.level;
                 return (
                  <Card key={level.level} className={cn(
                    "border-none shadow-sm rounded-[2rem] overflow-hidden group transition-all",
                    isCurrent ? "bg-secondary text-white scale-105 shadow-2xl ring-4 ring-secondary/20" : "bg-white/5 text-white border border-white/10 hover:bg-white/10"
                  )}>
                     <CardHeader className="p-8 border-b border-white/10">
                        <div className="flex justify-between items-center">
                           <div className={cn("p-2.5 rounded-xl", isCurrent ? "bg-white/20" : "bg-white/5")}>
                              <Star className={cn("w-5 h-5", isCurrent ? "fill-white" : "text-secondary")} />
                           </div>
                           <Badge variant="outline" className="text-[8px] font-black text-white border-white/20">LV. {level.level}</Badge>
                        </div>
                        <CardTitle className="text-xl font-black italic uppercase tracking-tighter mt-6">{level.label}</CardTitle>
                     </CardHeader>
                     <CardContent className="p-8 space-y-6">
                        <div className="space-y-1">
                           <p className="text-[9px] font-black uppercase opacity-60">Comissão</p>
                           <p className="text-3xl font-black italic">{formatCurrency(level.commission)}</p>
                           <p className="text-[8px] font-bold uppercase opacity-40">por ingresso vendido</p>
                        </div>
                        <div className="space-y-4">
                           <Separator className="bg-white/10" />
                           <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-tight">
                              <Target className="w-3.5 h-3.5 opacity-40" /> Meta: {level.minSales}+ vendas
                           </div>
                           <div className="space-y-2">
                              <p className="text-[8px] font-black uppercase opacity-40">Benefícios:</p>
                              <div className="flex flex-col gap-1.5">
                                 <div className="flex items-center gap-2 text-[8px] font-bold uppercase"><CheckCircle2 className="w-2.5 h-2.5" /> Ganhos Vitalícios</div>
                                 <div className="flex items-center gap-2 text-[8px] font-bold uppercase"><CheckCircle2 className="w-2.5 h-2.5" /> Dashboard em Real-Time</div>
                              </div>
                           </div>
                        </div>
                     </CardContent>
                  </Card>
                 )
               })}
            </div>
         </div>
      </section>

      {/* FAQ */}
      <section className="py-24 bg-white">
         <div className="container mx-auto px-4 max-w-3xl">
            <div className="text-center mb-16 space-y-2">
               <h2 className="text-4xl font-black uppercase italic tracking-tighter text-primary">Dúvidas Frequentes</h2>
               <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest text-secondary">Tudo o que você precisa saber.</p>
            </div>
            
            <Accordion type="single" collapsible className="w-full space-y-4">
               {faqs.map((faq, i) => (
                 <AccordionItem key={i} value={`faq-${i}`} className="border-none">
                    <Card className="border-none shadow-sm bg-muted/20 rounded-2xl overflow-hidden">
                       <AccordionTrigger className="px-6 py-5 hover:no-underline font-bold text-sm text-left uppercase italic tracking-tight">
                          {faq.q}
                       </AccordionTrigger>
                       <AccordionContent className="px-6 pb-5 text-sm text-muted-foreground leading-relaxed font-medium">
                          {faq.a}
                       </AccordionContent>
                    </Card>
                 </AccordionItem>
               ))}
            </Accordion>
         </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 bg-muted/30 border-y">
         <div className="container mx-auto px-4 text-center space-y-10">
            <div className="max-w-2xl mx-auto space-y-4">
               <h2 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter text-primary leading-none">Comece a Ganhar com a Viby Hoje</h2>
               <p className="text-lg text-muted-foreground font-medium">Crie sua conta gratuitamente e receba seu link exclusivo de indicação em poucos segundos.</p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
               <Button asChild className="h-16 px-12 bg-secondary text-white font-black rounded-2xl shadow-xl shadow-secondary/20 uppercase italic text-lg hover:scale-105 transition-all">
                  <Link href="/cadastro">Criar Conta Grátis</Link>
               </Button>
               <Button asChild variant="ghost" className="h-16 px-12 font-black uppercase italic text-lg hover:bg-white transition-all">
                  <Link href="/login">Já Tenho Conta</Link>
               </Button>
            </div>
         </div>
      </section>

      <Footer />
    </div>
  )
}
