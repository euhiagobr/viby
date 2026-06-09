
"use client"

import * as React from "react"
import { useAuth, useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, where, orderBy, limit, doc } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { 
  Handshake, 
  Copy, 
  Users, 
  Building2, 
  Ticket, 
  Wallet, 
  Loader2, 
  CheckCircle2, 
  Clock, 
  History, 
  Inbox,
  Info,
  Globe,
  Star,
  Coins,
  Wand2
} from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { toast } from "@/hooks/use-toast"
import { getAffiliateLevel, getNextLevel } from "@/lib/affiliate-utils"
import { formatCurrency } from "@/lib/financial-utils"
import Link from "next/link"
import { requestAffiliatePayout, generateAffiliateCodeAction } from "@/app/actions/affiliates"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useCurrency, CurrencyCode } from "@/contexts/CurrencyContext"
import { cn } from "@/lib/utils"

export default function AffiliateDashboard() {
  const db = useFirestore()
  const auth = useAuth()
  const { user, profile, forceRefresh } = useUser(auth)
  const { formatPrice } = useCurrency()
  
  const statsRef = React.useMemo(() => (db && user) ? doc(db, "affiliate_stats", user.uid) : null, [db, user])
  const { data: stats, loading: statsLoading } = useDoc<any>(statsRef)

  const commissionsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return query(collection(db, "affiliate_commissions"), where("affiliateId", "==", user.uid), orderBy("createdAt", "desc"), limit(20))
  }, [db, user])
  const { data: commissions } = useCollection<any>(commissionsQuery)

  const payoutsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return query(collection(db, "affiliate_payouts"), where("userId", "==", user.uid), orderBy("createdAt", "desc"), limit(10))
  }, [db, user])
  const { data: payouts } = useCollection<any>(payoutsQuery)

  const [isPayoutDialogOpen, setIsPayoutDialogOpen] = React.useState(false)
  const [payoutAmount, setPayoutAmount] = React.useState("")
  const [pixKey, setPixKey] = React.useState("")
  const [pixType, setPixType] = React.useState("cpf")
  const [bankDetails, setBankDetails] = React.useState("")
  const [payoutCurrency, setPayoutCurrency] = React.useState<CurrencyCode>("BRL")
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [isGeneratingCode, setIsGeneratingCode] = React.useState(false);

  // O código agora vem diretamente do perfil do usuário, garantindo sincronia total
  const affiliateCode = profile?.affiliateCode
  const affiliateLink = typeof window !== 'undefined' ? `${window.location.origin}/cadastro?ref=${affiliateCode}` : ""

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text)
    toast({ title: `${type} copiado!`, description: "Agora é só compartilhar e começar a ganhar." })
  }

  const handleGenerateCode = async () => {
    if (!user) return;
    setIsGeneratingCode(true);
    try {
      const res = await generateAffiliateCodeAction({ userId: user.uid });
      if (res.success) {
        toast({ title: "Seu código foi gerado!", description: "Sua conta agora está ativa para indicações." });
        forceRefresh();
      } else {
        throw new Error(res.error);
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao gerar código", description: e.message });
    } finally {
      setIsGeneratingCode(false);
    }
  }

  const handlePayoutRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || isSubmitting) return
    setIsSubmitting(true)
    try {
      const res = await requestAffiliatePayout({
        userId: user.uid,
        amount: parseFloat(payoutAmount),
        currency: payoutCurrency,
        pixKey,
        pixType,
        bankDetails
      })
      if (res.success) {
        toast({ title: "Saque solicitado!", description: "Analisaremos seu pedido em breve." })
        setIsPayoutDialogOpen(false)
        setPayoutAmount("")
      } else throw new Error(res.error)
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro no saque", description: err.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (statsLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-secondary" /></div>

  const currentLevel = getAffiliateLevel(stats?.totalTicketsSold || 0)
  const nextLevel = getNextLevel(stats?.totalTicketsSold || 0)
  const progress = nextLevel ? ((stats?.totalTicketsSold || 0) / nextLevel.minSales) * 100 : 100

  const currencies: CurrencyCode[] = ['BRL', 'USD', 'EUR']

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
            <Handshake className="w-8 h-8 text-secondary" />
            Programa de Afiliados
          </h1>
          <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest">Sua rede de indicações multimoeda.</p>
        </div>
      </div>

      <Card className="border-dashed shadow-sm rounded-[2rem] bg-white overflow-hidden">
        <CardContent className="p-8">
            {affiliateCode ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Seu Código de Embaixador</Label>
                        <div className="flex items-center gap-2">
                            <Input readOnly value={affiliateCode} className="h-14 text-2xl font-black tracking-[0.2em] bg-muted/30 border-dashed border-secondary/20 text-primary text-center rounded-2xl" />
                            <Button variant="outline" size="icon" className="h-14 w-14 rounded-2xl border-2" onClick={() => handleCopy(affiliateCode, 'Código')}><Copy className="w-5 h-5" /></Button>
                        </div>
                    </div>
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Seu Link de Convite</Label>
                        <div className="flex items-center gap-2">
                            <Input readOnly value={affiliateLink} className="h-14 text-xs font-bold text-muted-foreground bg-muted/30 border-dashed border-secondary/20 rounded-2xl" />
                            <Button variant="outline" size="icon" className="h-14 w-14 rounded-2xl border-2" onClick={() => handleCopy(affiliateLink, 'Link')}><Copy className="w-5 h-5" /></Button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="text-center space-y-6 py-10">
                    <div className="w-20 h-20 bg-muted rounded-3xl flex items-center justify-center mx-auto opacity-20"><Handshake className="w-10 h-10" /></div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-black uppercase italic text-primary">Ative sua conta de Afiliado</h3>
                      <p className="text-muted-foreground text-sm max-w-sm mx-auto font-medium">Gere seu código único agora e comece a lucrar indicando novos organizadores para a Viby.</p>
                    </div>
                    <Button onClick={handleGenerateCode} disabled={isGeneratingCode} className="bg-secondary text-white font-black rounded-2xl h-14 px-10 shadow-xl hover:scale-105 transition-all gap-2 uppercase italic text-lg">
                        {isGeneratingCode ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />} Ativar Agora
                    </Button>
                </div>
            )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
           <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden p-1">
              <div className="grid grid-cols-1 md:grid-cols-12">
                 <div className="md:col-span-4 bg-primary p-10 text-white flex flex-col items-center justify-center text-center gap-6 rounded-[2.3rem] relative overflow-hidden">
                    <div className="relative z-10 space-y-2">
                       <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Nível Atual</p>
                       <div className="text-8xl font-black italic tracking-tighter">{currentLevel.level}</div>
                       <Badge className="bg-secondary text-white font-black uppercase italic px-4 py-1 text-[10px] tracking-widest border-none shadow-lg">{currentLevel.label}</Badge>
                    </div>
                 </div>
                 <div className="md:col-span-8 p-10 flex flex-col justify-center gap-8">
                    <div className="space-y-4">
                       <div className="flex justify-between items-end">
                          <div className="space-y-1">
                             <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Sua Comissão Atual</p>
                             <p className="text-2xl font-black text-primary italic uppercase tracking-tighter">
                                {formatCurrency(currentLevel.commission)} / ingresso
                             </p>
                          </div>
                          {nextLevel && (
                             <div className="text-right">
                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Próximo Objetivo</p>
                                <p className="text-xs font-bold text-secondary">Faltam {nextLevel.minSales - (stats?.totalTicketsSold || 0)} vendas</p>
                             </div>
                          )}
                       </div>
                       <Progress value={progress} className="h-4 rounded-full" />
                    </div>
                 </div>
              </div>
           </Card>

           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <MetricCard label="Membros Indicados" value={stats?.totalUsersReferred || 0} icon={Users} color="blue" />
              <MetricCard label="Marcas em 1 Ano" value={stats?.totalOrgsLinked || 0} icon={Building2} color="secondary" />
              <MetricCard label="Ingressos Vendidos" value={stats?.totalTicketsSold || 0} icon={Ticket} color="orange" />
           </div>

           <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
              <CardHeader className="p-8 border-b">
                 <CardTitle className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2">
                    <History className="w-5 h-5 text-secondary" /> Comissões Recentes
                 </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                 <ScrollArea className="h-[400px]">
                    {commissions && commissions.length > 0 ? (
                      <div className="divide-y divide-border/40">
                         {commissions.map((c: any) => (
                           <div key={c.id} className="p-6 flex items-center justify-between hover:bg-muted/5 transition-colors">
                              <div className="flex items-center gap-4">
                                 <div className={cn("p-3 rounded-2xl", c.status === 'available' ? "bg-green-50 text-green-600" : "bg-orange-50 text-orange-600")}>
                                    {c.status === 'available' ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                                 </div>
                                 <div className="space-y-0.5">
                                    <p className="text-xs font-bold text-primary uppercase">Comissão Gerada ({c.currency})</p>
                                    <p className="text-[9px] font-black text-muted-foreground uppercase opacity-60">
                                       Org: {c.organizationId?.slice(-6)} • {new Date(c.createdAt?.seconds * 1000).toLocaleDateString('pt-BR')}
                                    </p>
                                 </div>
                              </div>
                              <div className="text-right space-y-1">
                                 <p className="text-base font-black text-primary">{formatPrice(c.amount, c.currency)}</p>
                                 <Badge variant="outline" className="text-[7px] font-black uppercase h-4 px-1.5 border-dashed">{c.status}</Badge>
                              </div>
                           </div>
                         ))}
                      </div>
                    ) : (
                      <div className="p-20 text-center">
                         <Inbox className="w-12 h-12 mx-auto opacity-10 mb-4" />
                         <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Aguardando sua primeira indicação.</p>
                      </div>
                    )}
                 </ScrollArea>
              </CardContent>
           </Card>
        </div>

        <div className="lg:col-span-4 space-y-8">
           <Tabs defaultValue="BRL" className="w-full">
              <div className="flex justify-between items-center px-2 mb-4">
                 <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Wallet className="w-4 h-4" /> Minha Carteira
                 </h3>
                 <TabsList className="bg-muted/50 h-8 p-1 rounded-lg">
                    {currencies.map(curr => <TabsTrigger key={curr} value={curr} className="text-[9px] font-black h-6">{curr}</TabsTrigger>)}
                 </TabsList>
              </div>

              {currencies.map(curr => (
                <TabsContent key={curr} value={curr} className="animate-in zoom-in-95">
                   <Card className="border-none shadow-2xl rounded-[2.5rem] bg-primary text-white p-8 relative overflow-hidden">
                      <div className="relative z-10 space-y-10">
                         <div className="flex justify-between items-start">
                            <div className="p-3 bg-white/10 rounded-2xl"><Coins className="w-6 h-6 text-secondary" /></div>
                            <Badge className="bg-secondary text-white font-black uppercase text-[8px] border-none px-2 h-5">Viby Pay {curr}</Badge>
                         </div>
                         
                         <div className="space-y-6">
                            <div className="space-y-1">
                               <p className="text-[10px] font-black uppercase opacity-40 tracking-widest">Saldo Disponível</p>
                               <p className="text-4xl font-black italic tracking-tighter">{formatPrice(stats?.balances?.[curr]?.available || 0, curr)}</p>
                            </div>
                            <div className="space-y-1">
                               <p className="text-[10px] font-black uppercase opacity-40 tracking-widest">Saldo Pendente</p>
                               <p className="text-xl font-bold opacity-80">{formatPrice(stats?.balances?.[curr]?.pending || 0, curr)}</p>
                            </div>
                         </div>

                         <Dialog open={isPayoutDialogOpen} onOpenChange={setIsPayoutDialogOpen}>
                            <DialogTrigger asChild>
                               <Button 
                                onClick={() => setPayoutCurrency(curr)}
                                className="w-full bg-white text-primary font-black h-14 rounded-2xl shadow-xl uppercase italic text-sm hover:bg-secondary hover:text-white transition-all"
                               >
                                  Resgatar {curr}
                               </Button>
                            </DialogTrigger>
                            <DialogContent className="rounded-[2.5rem] max-w-sm">
                               <form onSubmit={handlePayoutRequest} className="space-y-6">
                                  <DialogHeader>
                                     <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-primary">Solicitar Saque ({payoutCurrency})</DialogTitle>
                                  </DialogHeader>
                                  <div className="space-y-4">
                                     <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase opacity-60">Valor</Label>
                                        <Input type="number" step="0.01" value={payoutAmount} onChange={e => setPayoutAmount(e.target.value)} required className="h-12 rounded-xl text-lg font-black" placeholder="0,00" />
                                     </div>
                                     
                                     {payoutCurrency === 'BRL' ? (
                                       <>
                                         <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase opacity-60">Chave PIX</Label>
                                            <Input value={pixKey} onChange={e => setPixKey(e.target.value)} required className="h-12 rounded-xl" />
                                         </div>
                                         <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase opacity-60">Tipo de Chave</Label>
                                            <Select value={pixType} onValueChange={setPixType}>
                                               <SelectTrigger className="h-12 rounded-xl"><SelectValue /></SelectTrigger>
                                               <SelectContent className="rounded-xl">
                                                  <SelectItem value="cpf">CPF</SelectItem>
                                                  <SelectItem value="email">E-mail</SelectItem>
                                                  <SelectItem value="phone">Celular</SelectItem>
                                                  <SelectItem value="random">Aleatória</SelectItem>
                                               </SelectContent>
                                            </Select>
                                         </div>
                                       </>
                                     ) : (
                                       <div className="space-y-2">
                                          <Label className="text-[10px] font-black uppercase opacity-60">Dados Bancários Internacionais</Label>
                                          <Textarea value={bankDetails} onChange={e => setBankDetails(e.target.value)} required className="rounded-xl min-h-[100px]" placeholder="SWIFT / IBAN / Nome do Banco..." />
                                       </div>
                                     )}
                                  </div>
                                  <DialogFooter>
                                     <Button type="submit" disabled={isSubmitting || !payoutAmount} className="w-full bg-secondary text-white font-black h-14 rounded-2xl shadow-xl uppercase italic">
                                        {isSubmitting ? <Loader2 className="animate-spin" /> : "Confirmar Solicitação"}
                                     </Button>
                                  </DialogFooter>
                               </form>
                            </DialogContent>
                         </Dialog>
                      </div>
                      <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-secondary/10 rounded-full blur-3xl" />
                   </Card>
                </TabsContent>
              ))}
           </Tabs>

           <div className="p-6 bg-secondary/5 rounded-3xl border-2 border-dashed border-secondary/10 space-y-4">
              <div className="flex items-center gap-2 text-secondary font-black text-[10px] uppercase"><Info className="w-4 h-4" /> Regras de Afiliado</div>
              <p className="text-[10px] text-muted-foreground leading-relaxed font-medium uppercase">
                 As comissões são processadas em D+7 após a confirmação do ingresso. Pagamentos são efetuados em até 48h úteis após a solicitação. Saque mínimo: R$ 50,00 ou correspondente.
              </p>
           </div>
        </div>
      </div>
    </div>
  )
}

function MetricCard({ label, value, icon: Icon, color }: any) {
   const colors: any = { blue: "bg-blue-50 text-blue-600", secondary: "bg-secondary/5 text-secondary", orange: "bg-orange-50 text-orange-600" };
   return (
      <Card className="border-none shadow-sm bg-white hover:shadow-md transition-all">
         <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
               <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">{label}</p>
               <div className={cn("p-2 rounded-xl", colors[color])}><Icon className="w-3.5 h-3.5" /></div>
            </div>
            <div className="text-2xl font-black text-primary">{value.toLocaleString()}</div>
         </CardContent>
      </Card>
   )
}
