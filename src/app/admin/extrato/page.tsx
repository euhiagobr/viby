
"use client"

import * as React from "react"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, where } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Receipt, 
  Loader2, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight, 
  DollarSign,
  Calendar,
  Building2,
  Ticket,
  CreditCard,
  Percent,
  Download,
  Megaphone
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { formatCurrency } from "@/lib/financial-utils"
import { cn } from "@/lib/utils"

export default function AdminExtratoPage() {
  const db = useFirestore()
  const [dateFilter, setDateFilter] = React.useState<string>("all")

  // Consulta de Ingressos (Registrations)
  const regsQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(
      collection(db, "registrations"), 
      where("paymentStatus", "in", ["Pago", "Disponível"])
    )
  }, [db])

  const { data: registrations, loading: regsLoading } = useCollection<any>(regsQuery)

  // Consulta de Usuários para Planos
  const usersQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(
      collection(db, "users"), 
      where("plan", "in", ["PRO", "TOP"])
    )
  }, [db])

  const { data: users, loading: usersLoading } = useCollection<any>(usersQuery)

  // Consulta de Anúncios (Ads)
  const adsQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(
      collection(db, "ads"),
      where("status", "in", ["Ativo", "Pausado", "Finalizado"])
    )
  }, [db])

  const { data: ads, loading: adsLoading } = useCollection<any>(adsQuery)

  const financialData = React.useMemo(() => {
    const now = new Date()
    const filterDate = (date: any) => {
      if (dateFilter === "all") return true
      const d = date?.toDate ? date.toDate() : new Date(date)
      const diffTime = Math.abs(now.getTime() - d.getTime())
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      if (dateFilter === "today") return diffDays <= 1
      if (dateFilter === "week") return diffDays <= 7
      if (dateFilter === "month") return diffDays <= 30
      return true
    }

    const getMs = (date: any) => {
      if (date?.toMillis) return date.toMillis()
      if (date?.seconds) return date.seconds * 1000
      return new Date(date).getTime()
    }

    // Processar Vendas de Ingressos
    const ticketTransactions = (registrations || [])
      .filter(reg => filterDate(reg.timestamp))
      .map(reg => ({
        id: reg.id,
        type: 'ticket',
        title: reg.eventTitle || 'Venda de Ingresso',
        description: `Participante: ${reg.userName}`,
        date: reg.timestamp,
        gross: reg.price || 0,
        fee: (reg.administrativeFeeAmount || 0) + (reg.producerFeeAmount || 0),
        net: reg.producerNetAmount || 0, // Repasse ao produtor
        status: 'Concluído'
      }))

    // Processar Planos (Receita 100% Viby)
    const planTransactions = (users || [])
      .filter(u => u.lastPlanPaymentAt && filterDate(u.lastPlanPaymentAt))
      .map(u => ({
        id: u.id,
        type: 'plan',
        title: `Plano Viby ${u.plan}`,
        description: `Assinante: @${u.username}`,
        date: u.lastPlanPaymentAt,
        gross: u.lastPlanAmount || 0,
        fee: u.lastPlanAmount || 0, 
        net: 0,
        status: 'Pago'
      }))

    // Processar Anúncios (Receita 100% Viby)
    const adTransactions = (ads || [])
      .filter(ad => ad.paymentConfirmedAt && filterDate(ad.paymentConfirmedAt))
      .map(ad => ({
        id: ad.id,
        type: 'ad',
        title: `Ads: ${ad.eventTitle}`,
        description: `Impulsionamento (${ad.type})`,
        date: ad.paymentConfirmedAt || ad.createdAt,
        gross: ad.budget || 0,
        fee: ad.budget || 0,
        net: 0,
        status: 'Pago'
      }))

    const allTransactions = [...ticketTransactions, ...planTransactions, ...adTransactions].sort((a, b) => {
      return getMs(b.date) - getMs(a.date)
    })

    const stats = allTransactions.reduce((acc, t) => {
      if (t.type === 'ticket') {
        acc.gross += t.gross
        acc.payouts += t.net
        acc.fees += t.fee
      } else if (t.type === 'plan') {
        acc.plans += t.gross
      } else if (t.type === 'ad') {
        acc.ads += t.gross
      }
      return acc
    }, { gross: 0, payouts: 0, fees: 0, plans: 0, ads: 0 })

    // Lucro Real = Taxas de Ingressos + Valor Integral dos Planos + Valor Integral dos Ads
    const totalPlatformRevenue = stats.fees + stats.plans + stats.ads

    return { transactions: allTransactions, stats: { ...stats, totalPlatformRevenue } }
  }, [registrations, users, ads, dateFilter])

  const formatTimestamp = (ts: any) => {
    if (!ts) return "---";
    try {
      const d = ts.toDate ? ts.toDate() : new Date(ts);
      return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch (e) { return "---"; }
  }

  if (regsLoading || usersLoading || adsLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
            <Receipt className="w-8 h-8 text-secondary" />
            Extrato Financeiro Global
          </h1>
          <p className="text-muted-foreground font-medium">Gestão completa de entradas, repasses e lucro operacional.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-[180px] rounded-xl border-secondary/20 h-10 font-bold">
              <Calendar className="w-4 h-4 mr-2 text-secondary" />
              <SelectValue placeholder="Filtrar Período" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">Todo o período</SelectItem>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="week">Últimos 7 dias</SelectItem>
              <SelectItem value="month">Últimos 30 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="rounded-xl font-bold h-10 gap-2 border-secondary text-secondary">
            <Download className="w-4 h-4" />
            Exportar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-none shadow-sm bg-white border-l-4 border-primary">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex justify-between">
              Faturamento Bruto Total
              <ArrowUpRight className="w-3 h-3 text-green-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-primary">{formatCurrency(financialData.stats.gross + financialData.stats.plans + financialData.stats.ads)}</div>
            <p className="text-[9px] font-bold text-muted-foreground uppercase mt-1">Soma de ingressos, planos e ads</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-secondary text-white border-l-4 border-secondary">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase text-white/60 tracking-widest flex justify-between">
              Lucro Líquido Viby
              <Percent className="w-3 h-3" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black">{formatCurrency(financialData.stats.totalPlatformRevenue)}</div>
            <p className="text-[9px] font-bold opacity-60 uppercase mt-1">Taxas Ingressos + 100% Planos & Ads</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white border-l-4 border-orange-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex justify-between">
              Repasse aos Produtores
              <ArrowDownRight className="w-3 h-3 text-orange-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-orange-600">{formatCurrency(financialData.stats.payouts)}</div>
            <p className="text-[9px] font-bold text-muted-foreground uppercase mt-1">Líquido de ingressos apenas</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-black text-white border-l-4 border-black">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase text-white/60 tracking-widest flex justify-between">
              Receita Anúncios
              <Megaphone className="w-3 h-3 text-secondary" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-secondary">{formatCurrency(financialData.stats.ads)}</div>
            <p className="text-[9px] font-bold opacity-60 uppercase mt-1">Investimento dos produtores</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden">
        <CardHeader className="bg-white border-b pb-6">
          <div className="flex items-center justify-between">
             <div>
                <CardTitle className="text-xl flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-secondary" />
                  Livro de Transações
                </CardTitle>
                <CardDescription>Mostrando {financialData.transactions.length} movimentações no período selecionado.</CardDescription>
             </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="font-bold">Data / Hora</TableHead>
                <TableHead className="font-bold">Tipo</TableHead>
                <TableHead className="font-bold">Descrição / Origem</TableHead>
                <TableHead className="font-bold text-right">Bruto (Entrada)</TableHead>
                <TableHead className="font-bold text-right">Taxas (Plataforma)</TableHead>
                <TableHead className="font-bold text-right">Líquido (Repasse)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {financialData.transactions.length > 0 ? (
                financialData.transactions.map((t) => (
                  <TableRow key={t.id} className="hover:bg-muted/20">
                    <TableCell className="text-[11px] font-bold text-muted-foreground">
                      {formatTimestamp(t.date)}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn(
                        "text-[9px] font-black uppercase",
                        t.type === 'ticket' ? "bg-blue-50 text-blue-600 border-blue-200" : 
                        t.type === 'plan' ? "bg-purple-50 text-purple-600 border-purple-200" :
                        "bg-orange-50 text-orange-600 border-orange-200"
                      )} variant="outline">
                        {t.type === 'ticket' ? <Ticket className="w-2.5 h-2.5 mr-1" /> : 
                         t.type === 'plan' ? <CreditCard className="w-2.5 h-2.5 mr-1" /> :
                         <Megaphone className="w-2.5 h-2.5 mr-1" />}
                        {t.type === 'ticket' ? 'Ingresso' : t.type === 'plan' ? 'Assinatura' : 'Anúncio'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-sm truncate max-w-[200px]">{t.title}</span>
                        <span className="text-[10px] text-muted-foreground">{t.description}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-black text-sm">
                      {formatCurrency(t.gross)}
                    </TableCell>
                    <TableCell className="text-right font-bold text-xs text-secondary">
                      {t.fee > 0 ? `+${formatCurrency(t.fee)}` : '---'}
                    </TableCell>
                    <TableCell className="text-right">
                       <span className={cn(
                         "font-black text-sm",
                         (t.type === 'plan' || t.type === 'ad') ? "text-muted-foreground/30 italic" : "text-orange-500"
                       )}>
                         {t.net > 0 ? formatCurrency(t.net) : '---'}
                       </span>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic">
                    Nenhuma transação encontrada para este filtro.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         <Card className="border-none shadow-sm rounded-[2rem] bg-muted/20">
            <CardHeader>
               <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                 <Building2 className="w-4 h-4" /> Resumo de Retenção
               </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
               <div className="flex justify-between items-center text-sm">
                  <span className="font-medium text-muted-foreground">Volume de Vendas Ingressos (Base)</span>
                  <span className="font-black">{formatCurrency(financialData.stats.gross)}</span>
               </div>
               <div className="flex justify-between items-center text-sm">
                  <span className="font-medium text-muted-foreground">Lucro sobre Ingressos (Taxas)</span>
                  <span className="font-black text-secondary">{formatCurrency(financialData.stats.fees)}</span>
               </div>
               <div className="h-px bg-border/50" />
               <div className="flex justify-between items-center">
                  <span className="text-xs font-black uppercase tracking-tighter">Margem de Retenção Média</span>
                  <Badge className="bg-secondary font-black">
                    {financialData.stats.gross > 0 
                      ? ((financialData.stats.fees / financialData.stats.gross) * 100).toFixed(1) 
                      : '0.0'}%
                  </Badge>
               </div>
            </CardContent>
         </Card>

         <Card className="border-none shadow-sm rounded-[2rem] bg-secondary/5">
            <CardHeader>
               <CardTitle className="text-sm font-black uppercase tracking-widest text-secondary flex items-center gap-2">
                 <TrendingUp className="w-4 h-4" /> Saúde de Assinaturas & Ads
               </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
               <div className="flex justify-between items-center text-sm">
                  <span className="font-medium text-muted-foreground">Receita Direta (MRR + Ads)</span>
                  <span className="font-black">{formatCurrency(financialData.stats.plans + financialData.stats.ads)}</span>
               </div>
               <div className="flex justify-between items-center text-sm">
                  <span className="font-medium text-muted-foreground">Volume Anúncios Vendidos</span>
                  <span className="font-black">{ads?.length || 0} campanhas</span>
               </div>
               <div className="h-px bg-border/50" />
               <p className="text-[10px] text-muted-foreground italic leading-tight">
                 * Assinaturas e Campanhas de Ads são reconhecidas 100% como lucro líquido da Viby, sem repasses externos.
               </p>
            </CardContent>
         </Card>
      </div>
    </div>
  )
}
