"use client"

import * as React from "react"
import { useFirestore, useDoc, useAuth, useUser } from "@/firebase"
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
  Check
} from "lucide-react"
import Link from "next/link"
import { toast } from "@/hooks/use-toast"
import { AFFILIATE_LEVELS } from "@/lib/affiliate-utils"
import { formatCurrency } from "@/lib/financial-utils"
import Footer from "@/components/layout/Footer"
import { getAffiliatePublicRanking } from "@/app/actions/affiliates"
import { useTranslation } from "@/i18n/i18n-context"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"

export default function EarnMoneyClient() {
  const { t } = useTranslation()
  const db = useFirestore()
  const auth = useAuth()
  const { user, profile } = useUser(auth)
  const [ranking, setRanking] = React.useState<any[]>([])
  const [loadingRank, setLoadingRank] = React.useState(true)
  const [copiedLink, setCopiedLink] = React.useState(false)
  const [copiedCode, setCopiedCode] = React.useState(false)

  React.useEffect(() => {
    getAffiliatePublicRanking().then(res => {
      if (res.success) setRanking(res.ranking)
      setLoadingRank(false)
    })
  }, [])

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

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col selection:bg-secondary selection:text-white">
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
               <p className="text-lg md:text-2xl font-medium opacity-80 max-w-2xl mx-auto leading-relaxed">Indique organizadores, promotores e marcas. Receba comissões automáticas por cada ingresso vendido durante 1 ano.</p>
               
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
                       <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">Compartilhe e acompanhe seus ganhos em tempo real.</p>
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

      {/* Features */}
      <section className="py-20 container mx-auto px-4">
         <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <FeatureStep icon={Target} title="Indique com seu Link" desc="Cada usuário cadastrado pelo seu link de 10 dígitos fica permanentemente vinculado ao seu perfil." />
            <FeatureStep icon={Building2} title="Acompanhe o Crescimento" desc="Receba comissão sobre todas as organizações e eventos criados pelo seu indicado nos primeiros 365 dias." />
            <FeatureStep icon={Wallet} title="Saque Multimoeda" desc="Suas comissões são creditadas na moeda da venda (BRL, USD ou EUR) e sacadas para sua conta preferencial." />
         </div>
      </section>

      {/* Hall da Fama */}
      <section className="py-20 bg-muted/30">
         <div className="container mx-auto px-4">
            <div className="max-w-xl mx-auto space-y-10">
               <div className="text-center space-y-2">
                  <h2 className="text-4xl font-black uppercase italic tracking-tighter text-primary flex items-center justify-center gap-3">
                     <Trophy className="w-8 h-8 text-secondary" /> Hall da Fama
                  </h2>
                  <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest">Os maiores embaixadores da rede Viby.</p>
               </div>

               <Card className="border-none shadow-2xl rounded-[3rem] bg-white overflow-hidden">
                  <CardContent className="p-0">
                     {loadingRank ? (
                       <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-secondary" /></div>
                     ) : (
                       <div className="divide-y">
                          {ranking.map((rank, i) => (
                            <div key={i} className="p-6 flex items-center justify-between hover:bg-muted/10 transition-colors">
                               <div className="flex items-center gap-4">
                                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center font-black text-xs text-muted-foreground">#{i+1}</div>
                                  <div>
                                     <p className="font-bold text-sm text-primary uppercase italic">{rank.name}</p>
                                     <Badge variant="outline" className="text-[7px] font-black text-secondary uppercase border-secondary/20">Level {rank.level}</Badge>
                                  </div>
                               </div>
                               <div className="text-right">
                                  <p className="text-sm font-black text-primary">{rank.sales.toLocaleString()}</p>
                                  <p className="text-[8px] font-bold text-muted-foreground uppercase">Ingressos</p>
                               </div>
                            </div>
                          ))}
                       </div>
                     )}
                  </CardContent>
               </Card>
            </div>
         </div>
      </section>

      {/* Levels */}
      <section className="py-32 container mx-auto px-4">
         <div className="text-center mb-16 space-y-2">
            <h2 className="text-5xl font-black uppercase italic tracking-tighter text-primary">Níveis de Progressão</h2>
            <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest text-secondary">Quanto mais seus indicados vendem, maior sua comissão vitalícia.</p>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {AFFILIATE_LEVELS.map((level) => (
               <Card key={level.level} className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden group hover:shadow-xl transition-all border-b-8 border-transparent hover:border-secondary">
                  <CardHeader className="bg-muted/30 p-8 border-b border-dashed">
                     <div className="flex justify-between items-center">
                        <div className="p-3 bg-secondary/10 rounded-2xl text-secondary group-hover:bg-secondary group-hover:text-white transition-colors">
                           <Star className="w-6 h-6" />
                        </div>
                        <Badge variant="outline" className="font-black text-[9px] uppercase tracking-widest">LV. {level.level}</Badge>
                     </div>
                     <CardTitle className="text-2xl font-black italic uppercase tracking-tighter mt-6 text-primary">{level.label}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-8 space-y-6">
                     <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase text-muted-foreground opacity-60">Comissão p/ Ingresso</p>
                        <p className="text-3xl font-black text-primary">{formatCurrency(level.commission)}</p>
                     </div>
                     <div className="p-4 bg-muted/20 rounded-xl text-[9px] font-bold uppercase text-muted-foreground italic">Meta: {level.minSales}+ vendas</div>
                  </CardContent>
               </Card>
            ))}
         </div>
      </section>
      
      <Footer />
    </div>
  )
}

function FeatureStep({ icon: Icon, title, desc }: any) {
   return (
      <div className="flex flex-col items-center text-center gap-6 group">
         <div className="w-20 h-20 bg-white rounded-3xl shadow-xl flex items-center justify-center text-secondary border border-border/50 group-hover:scale-110 group-hover:bg-secondary group-hover:text-white transition-all">
            <Icon className="w-10 h-10" />
         </div>
         <div className="space-y-2">
            <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary">{title}</h3>
            <p className="text-sm text-muted-foreground font-medium leading-relaxed">{desc}</p>
         </div>
      </div>
   )
}
