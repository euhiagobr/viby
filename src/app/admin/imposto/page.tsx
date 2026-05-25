
"use client"

import * as React from "react"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy, where, updateDoc, doc, serverTimestamp, getDocs, writeBatch, getDoc } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Receipt, 
  Loader2, 
  Search, 
  FileText, 
  Building2, 
  CheckCircle2, 
  ArrowUpRight,
  ArrowDownRight,
  FilterX,
  FileSpreadsheet,
  Ticket,
  Megaphone,
  TrendingUp,
  CreditCard,
  ChevronDown,
  ChevronUp,
  Percent,
  Coins,
  User,
  Clock,
  ArrowRight,
  Scale,
  Inbox,
  RefreshCw,
  AlertTriangle
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { formatCurrency, calculateDetailedVibyBreakdown } from "@/lib/financial-utils"
import * as XLSX from 'xlsx'
import { useSearchParams, useRouter } from "next/navigation"

export default function AdminImpostoPage() {
  const db = useFirestore()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [searchName, setSearchName] = React.useState(searchParams.get('q') || "")
  const [selectedMonth, setSelectedMonth] = React.useState(searchParams.get('month') || "all")
  const [activeTab, setActiveTab] = React.useState(searchParams.get('tab') || "ads")
  const [expandedEvents, setExpandedEvents] = React.useState<Set<string>>(new Set())
  const [isUpdating, setIsUpdating] = React.useState<string | null>(null)
  const [isSyncing, setIsSyncing] = React.useState(false)

  const adsQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "tax_ads"), orderBy("monthKey", "desc"))
  }, [db])

  const ticketsQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "tax_tickets"), orderBy("timestamp", "desc"))
  }, [db])

  const { data: ads, loading: adsLoading } = useCollection<any>(adsQuery)
  const { data: rawTickets, loading: ticketsLoading } = useCollection<any>(ticketsQuery)

  const updateFilters = React.useCallback(() => {
    const params = new URLSearchParams()
    if (searchName) params.set('q', searchName)
    if (selectedMonth !== 'all') params.set('month', selectedMonth)
    params.set('tab', activeTab)
    router.push(`?${params.toString()}`)
  }, [searchName, selectedMonth, activeTab, router])

  React.useEffect(() => {
    const timer = setTimeout(updateFilters, 500)
    return () => clearTimeout(timer)
  }, [searchName, selectedMonth, activeTab, updateFilters])

  // Lógica de Sincronização de Vendas Antigas
  const handleSyncLegacySales = async () => {
    if (!db) return
    setIsSyncing(true)
    try {
      const [regsSnap, feesSnap, stripeSnap] = await Promise.all([
        getDocs(query(collection(db, "registrations"), where("paymentStatus", "in", ["Pago", "Disponível"]))),
        getDoc(doc(db, "settings", "fees")),
        getDoc(doc(db, "settings", "stripe"))
      ])

      const fees = feesSnap.data()
      const stripe = stripeSnap.data()
      const batch = writeBatch(db)
      let count = 0

      for (const regDoc of regsSnap.docs) {
        const reg = regDoc.data()
        const taxQ = query(collection(db, "tax_tickets"), where("registrationId", "==", regDoc.id))
        const taxSnap = await getDocs(taxQ)

        if (taxSnap.empty) {
          const breakdown = calculateDetailedVibyBreakdown(reg.ticketBasePrice || 0, 1, fees, stripe)
          const monthKey = reg.timestamp ? 
            (reg.timestamp.toDate ? reg.timestamp.toDate() : new Date(reg.timestamp)).toISOString().slice(0, 7) : 
            new Date().toISOString().slice(0, 7)

          const taxRef = doc(collection(db, "tax_tickets"))
          batch.set(taxRef, {
            registrationId: regDoc.id,
            eventId: reg.eventId,
            eventTitle: reg.eventTitle || "Evento",
            organizationId: reg.organizationId,
            orgName: reg.organizer?.name || "Organização",
            orgCnpj: reg.organizer?.cnpj || "---",
            buyerName: reg.userName || "Comprador",
            buyerEmail: reg.userEmail || "",
            ticketTypeName: reg.ticketTypeName || "Geral",
            batchName: reg.batchName || "Único",
            quantity: 1,
            unitPrice: breakdown.unitPrice,
            totalFacePrice: breakdown.totalFace,
            buyerFeeAmount: breakdown.buyerFeeTotal,
            organizerFeeAmount: breakdown.organizerFeeTotal,
            stripeFeePercentAmount: breakdown.stripeFeePercentAmount,
            stripeFeeFixedAmount: breakdown.stripeFeeFixedAmount,
            stripeFeeAmount: breakdown.stripeFeeTotal,
            vibyGrossProfit: breakdown.vibyGross,
            taxPercentUsed: 11,
            taxAmount: breakdown.imposto,
            vibyNetProfit: breakdown.vibyNet,
            payoutToProducer: breakdown.payoutToProducer,
            monthKey,
            nfStatus: 'pendente',
            timestamp: reg.timestamp || serverTimestamp()
          })
          count++
        }
      }

      if (count > 0) {
        await batch.commit()
        toast({ title: "Sincronização Concluída!", description: `${count} vendas foram processadas fisicamente.` })
      } else {
        toast({ title: "Tudo em dia!", description: "Não há vendas pendentes de processamento fiscal." })
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Erro na sincronização" })
    } finally {
      setIsSyncing(false)
    }
  }

  const filteredAds = React.useMemo(() => {
    if (!ads) return []
    return ads.filter(ad => {
      const matchName = !searchName || (ad.advertiserName || "").toLowerCase().includes(searchName.toLowerCase()) || (ad.adTitle || "").toLowerCase().includes(searchName.toLowerCase())
      const matchMonth = selectedMonth === 'all' || ad.monthKey === selectedMonth
      return matchName && matchMonth
    })
  }, [ads, searchName, selectedMonth])

  const filteredTickets = React.useMemo(() => {
    if (!rawTickets) return []
    return rawTickets.filter(t => {
      const matchName = !searchName || (t.eventTitle || "").toLowerCase().includes(searchName.toLowerCase()) || (t.orgName || "").toLowerCase().includes(searchName.toLowerCase()) || (t.buyerName || "").toLowerCase().includes(searchName.toLowerCase())
      const matchMonth = selectedMonth === 'all' || t.monthKey === selectedMonth
      return matchName && matchMonth
    })
  }, [rawTickets, searchName, selectedMonth])

  const adStats = React.useMemo(() => {
    return filteredAds.reduce((acc, ad) => {
      acc.gross += (ad.grossValue || 0)
      acc.tax += (ad.taxValue || 0)
      acc.net += (ad.netValue || 0)
      return acc
    }, { gross: 0, tax: 0, net: 0 })
  }, [filteredAds])

  const ticketStats = React.useMemo(() => {
    return filteredTickets.reduce((acc, t) => {
      acc.totalSold += (t.totalFacePrice || 0)
      acc.payouts += (t.payoutToProducer || 0)
      acc.vibyGross += (t.vibyGrossProfit || 0)
      acc.imposto += (t.taxAmount || 0)
      acc.vibyNet += (t.vibyNetProfit || 0)
      acc.stripeTotal += (t.stripeFeeAmount || 0)
      acc.qty += (t.quantity || 1)
      return acc
    }, { totalSold: 0, payouts: 0, vibyGross: 0, imposto: 0, vibyNet: 0, stripeTotal: 0, qty: 0 })
  }, [filteredTickets])

  const groupedTickets = React.useMemo(() => {
    const groups: Record<string, any> = {}
    filteredTickets.forEach(t => {
      if (!groups[t.eventId]) {
        groups[t.eventId] = {
          id: t.eventId,
          eventTitle: t.eventTitle,
          orgName: t.orgName,
          salesQty: 0,
          grossViby: 0,
          totalTax: 0,
          netViby: 0,
          details: []
        }
      }
      groups[t.eventId].salesQty += (t.quantity || 1)
      groups[t.eventId].grossViby += (t.vibyGrossProfit || 0)
      groups[t.eventId].totalTax += (t.taxAmount || 0)
      groups[t.eventId].netViby += (t.vibyNetProfit || 0)
      groups[t.eventId].details.push(t)
    })
    return Object.values(groups)
  }, [filteredTickets])

  const handleExport = (format: 'csv' | 'xlsx') => {
    const type = activeTab
    const data = type === 'ads' ? filteredAds : filteredTickets
    const fileName = `viby_tax_${type}_${new Date().toISOString().split('T')[0]}`
    
    const exportData = data.map(item => {
      if (type === 'ads') {
        return {
          'Mês': item.monthKey,
          'Empresa': item.advertiserName,
          'CNPJ': item.advertiserCnpj,
          'Anúncio': item.adTitle,
          'Valor Bruto (Pago)': item.grossValue,
          'Imposto (11%)': item.taxValue,
          'Valor Líquido (Consumo)': item.netValue,
          'Status NF': item.nfStatus
        }
      }
      return {
        'Data': item.timestamp ? (item.timestamp.toDate ? item.timestamp.toDate().toLocaleString() : new Date(item.timestamp).toLocaleString()) : '---',
        'Evento': item.eventTitle,
        'Produtor': item.orgName,
        'Comprador': item.buyerName,
        'E-mail': item.buyerEmail,
        'Lote': item.batchName,
        'Tipo': item.ticketTypeName,
        'Qtd': item.quantity || 1,
        'Face Unit.': item.unitPrice,
        'Total Face': item.totalFacePrice,
        'Taxa Comprador': item.buyerFeeAmount,
        'Taxa Organizador': item.organizerFeeAmount,
        'Stripe Total': item.stripeFeeAmount,
        'Lucro Bruto Viby': item.vibyGrossProfit,
        'Imposto (11%)': item.taxAmount,
        'Lucro Líquido Viby': item.vibyNetProfit,
        'Repasse Produtor': item.payoutToProducer
      }
    })

    const worksheet = XLSX.utils.json_to_sheet(exportData)
    if (format === 'csv') {
      const csv = XLSX.utils.sheet_to_csv(worksheet)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement("a")
      link.href = URL.createObjectURL(blob)
      link.download = `${fileName}.csv`
      link.click()
    } else {
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, "Impostos")
      XLSX.writeFile(workbook, `${fileName}.xlsx`)
    }
  }

  const toggleEvent = (eventId: string) => {
    setExpandedEvents(prev => {
      const next = new Set(prev)
      if (next.has(eventId)) next.delete(eventId); else next.add(eventId);
      return next
    })
  }

  const handleUpdateNF = async (coll: string, id: string, status: string) => {
    if (!db) return
    setIsUpdating(id)
    try {
      await updateDoc(doc(db, coll, id), { nfStatus: status, nfUpdatedAt: serverTimestamp() })
      toast({ title: "Status da NF atualizado!" })
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao atualizar" })
    } finally {
      setIsUpdating(null)
    }
  }

  const months = React.useMemo(() => {
    const list = []
    const now = new Date()
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      list.push({ key, label: d.toLocaleString('pt-BR', { month: 'long', year: 'numeric' }) })
    }
    return list
  }, [])

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
            <Scale className="w-8 h-8 text-secondary" />
            Gestão Fiscal e Notas
          </h1>
          <p className="text-muted-foreground font-medium">Controle de faturamento, impostos e lucro real operacional.</p>
        </div>
        <div className="flex gap-2">
           <Button variant="ghost" asChild className="rounded-full h-11 px-6 font-black uppercase text-[10px] gap-2">
              <Link href="/admin/extrato"><ArrowLeft className="w-4 h-4" /> Voltar ao ERP</Link>
           </Button>
           <Button 
             variant="outline" 
             className="rounded-full h-11 px-6 font-black uppercase text-[10px] gap-2 border-secondary text-secondary hover:bg-secondary/5"
             onClick={handleSyncLegacySales}
             disabled={isSyncing}
           >
             {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
             Sincronizar Vendas Legadas
           </Button>
        </div>
      </div>

      {activeTab === 'tickets' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
           <StatCard title="Total Vendido (Face)" value={formatCurrency(ticketStats.totalSold)} icon={TrendingUp} color="blue" />
           <StatCard title="Repasse Produtores" value={formatCurrency(ticketStats.payouts)} icon={ArrowDownRight} color="orange" />
           <StatCard title="Custos Stripe" value={formatCurrency(ticketStats.stripeTotal)} icon={CreditCard} color="red" subtitle="% + Fixo" />
           <StatCard title="Lucro Bruto Viby" value={formatCurrency(ticketStats.vibyGross)} icon={ArrowUpRight} color="secondary" subtitle="Taxas - Stripe" />
           <StatCard title="Imposto (11%)" value={formatCurrency(ticketStats.imposto)} icon={Receipt} color="orange" subtitle="Sobre Lucro Bruto" />
           <StatCard title="Lucro Líquido Viby" value={formatCurrency(ticketStats.vibyNet)} icon={CheckCircle2} color="green" subtitle="Pós Imposto" />
           <StatCard title="Tickets Vendidos" value={ticketStats.qty} icon={Ticket} color="secondary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           <StatCard title="Total Bruto Ads" value={formatCurrency(adStats.gross)} icon={ArrowUpRight} color="blue" subtitle="Total Pago Clientes" />
           <StatCard title="Imposto Ads (11%)" value={formatCurrency(adStats.tax)} icon={Receipt} color="orange" subtitle="Recolhimento Fiscal" />
           <StatCard title="Total Líquido Ads" value={formatCurrency(adStats.net)} icon={CheckCircle2} color="green" subtitle="Orçamento para Consumo" />
        </div>
      )}

      <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
        <CardHeader className="p-8 border-b">
           <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
              <div className="md:col-span-3">
                <Label className="text-[10px] font-black uppercase opacity-40 mb-1 block">Filtrar Mês</Label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="rounded-xl h-11 border-dashed border-secondary/20">
                    <SelectValue placeholder="Selecione o mês" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all">Todos os meses</SelectItem>
                    {months.map(m => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-5">
                <Label className="text-[10px] font-black uppercase opacity-40 mb-1 block">Busca Global</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Evento, Empresa ou Comprador..." value={searchName} onChange={e => setSearchName(e.target.value)} className="pl-9 h-11 rounded-xl" />
                </div>
              </div>
              <div className="md:col-span-4 flex items-end gap-2">
                 <Button variant="outline" className="flex-1 h-11 rounded-xl border-dashed" onClick={() => { setSearchName(""); setSelectedMonth("all") }}>
                    <FilterX className="w-4 h-4 mr-2" /> Limpar
                 </Button>
                 <div className="flex gap-1">
                    <Button variant="secondary" size="icon" className="h-11 w-11 rounded-xl" onClick={() => handleExport('csv')} title="Exportar CSV"><FileText className="w-4 h-4" /></Button>
                    <Button variant="secondary" size="icon" className="h-11 w-11 rounded-xl" onClick={() => handleExport('xlsx')} title="Exportar Excel"><FileSpreadsheet className="w-4 h-4" /></Button>
                 </div>
              </div>
           </div>
        </CardHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
           <TabsList className="bg-muted/30 w-full h-14 rounded-none border-b p-0 gap-0">
              <TabsTrigger value="ads" className="flex-1 h-full rounded-none border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:bg-white font-black uppercase text-[10px] tracking-widest gap-2">
                <Megaphone className="w-4 h-4" /> Anúncios
              </TabsTrigger>
              <TabsTrigger value="tickets" className="flex-1 h-full rounded-none border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:bg-white font-black uppercase text-[10px] tracking-widest gap-2">
                <Ticket className="w-4 h-4" /> Ingressos
              </TabsTrigger>
           </TabsList>

           <TabsContent value="ads" className="m-0">
              {adsLoading ? <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-secondary" /></div> : (
                <Table>
                  <TableHeader className="bg-muted/20">
                    <TableRow>
                      <TableHead className="font-black uppercase text-[9px] tracking-widest py-6 px-8">Mês / Anunciante</TableHead>
                      <TableHead className="font-black uppercase text-[9px] tracking-widest">Anúncio</TableHead>
                      <TableHead className="font-black uppercase text-[9px] tracking-widest text-right">Bruto (Pago)</TableHead>
                      <TableHead className="font-black uppercase text-[9px] tracking-widest text-right">Imposto (11%)</TableHead>
                      <TableHead className="font-black uppercase text-[9px] tracking-widest text-right">Líquido (Consumo)</TableHead>
                      <TableHead className="font-black uppercase text-[9px] tracking-widest text-center">Status NF</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAds.length > 0 ? filteredAds.map((ad) => (
                      <TableRow key={ad.id} className="hover:bg-muted/5">
                        <TableCell className="py-6 px-8">
                           <div className="flex flex-col">
                              <span className="text-[10px] font-black text-secondary uppercase">{ad.monthKey}</span>
                              <span className="font-bold text-sm uppercase">{ad.advertiserName}</span>
                           </div>
                        </TableCell>
                        <TableCell><span className="font-bold text-xs uppercase">{ad.adTitle}</span></TableCell>
                        <TableCell className="text-right font-black text-sm">{formatCurrency(ad.grossValue)}</TableCell>
                        <TableCell className="text-right text-orange-600 font-bold">{formatCurrency(ad.taxValue)}</TableCell>
                        <TableCell className="text-right text-green-600 font-black">{formatCurrency(ad.netValue)}</TableCell>
                        <TableCell className="text-center">
                           <Select value={ad.nfStatus || 'pendente'} onValueChange={(v) => handleUpdateNF('tax_ads', ad.id, v)}>
                              <SelectTrigger className="h-8 rounded-lg text-[9px] font-black uppercase w-24 mx-auto">
                                 <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl">
                                 <SelectItem value="pendente">Pendente</SelectItem>
                                 <SelectItem value="emitida">Emitida</SelectItem>
                              </SelectContent>
                           </Select>
                        </TableCell>
                      </TableRow>
                    )) : <TableRow><TableCell colSpan={6} className="py-20 text-center italic opacity-30">Nenhum registro.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              )}
           </TabsContent>

           <TabsContent value="tickets" className="m-0">
              {ticketsLoading ? <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-secondary" /></div> : (
                <div className="divide-y">
                   {groupedTickets.length > 0 ? groupedTickets.map((group) => (
                     <div key={group.id} className="bg-white">
                        <div 
                          className="px-8 py-6 grid grid-cols-12 gap-4 items-center hover:bg-muted/10 cursor-pointer transition-colors"
                          onClick={() => toggleEvent(group.id)}
                        >
                           <div className="col-span-4 flex items-center gap-3">
                              <div className="p-2 bg-secondary/10 rounded-lg text-secondary">
                                 {expandedEvents.has(group.id) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </div>
                              <div className="flex flex-col">
                                 <span className="font-black text-sm uppercase italic text-primary">{group.eventTitle}</span>
                                 <span className="text-[10px] font-bold text-muted-foreground uppercase">{group.orgName}</span>
                              </div>
                           </div>
                           <div className="col-span-1 text-center">
                              <p className="text-[9px] font-black uppercase opacity-40">Vendas</p>
                              <p className="font-black text-sm">{group.salesQty}</p>
                           </div>
                           <div className="col-span-2 text-right">
                              <p className="text-[9px] font-black uppercase opacity-40">Lucro Bruto Viby</p>
                              <p className="font-black text-sm text-primary">{formatCurrency(group.grossViby)}</p>
                           </div>
                           <div className="col-span-2 text-right">
                              <p className="text-[9px] font-black uppercase opacity-40">Total Imposto</p>
                              <p className="font-black text-sm text-orange-600">{formatCurrency(group.totalTax)}</p>
                           </div>
                           <div className="col-span-2 text-right">
                              <p className="text-[9px] font-black uppercase opacity-40">Lucro Líquido Viby</p>
                              <p className="font-black text-sm text-green-600">{formatCurrency(group.netViby)}</p>
                           </div>
                           <div className="col-span-1 text-right">
                              <Button variant="ghost" size="icon" className="rounded-full"><ArrowRight className="w-4 h-4 opacity-20" /></Button>
                           </div>
                        </div>

                        {expandedEvents.has(group.id) && (
                          <div className="bg-muted/5 border-y border-dashed p-4 animate-in slide-in-from-top-2 duration-300 overflow-x-auto">
                             <Table className="min-w-[1200px]">
                                <TableHeader className="bg-muted/10">
                                   <TableRow className="hover:bg-transparent">
                                      <TableHead className="text-[8px] font-black uppercase py-3">Tipo / Lote</TableHead>
                                      <TableHead className="text-[8px] font-black uppercase">Comprador</TableHead>
                                      <TableHead className="text-[8px] font-black uppercase text-center">Qtd</TableHead>
                                      <TableHead className="text-[8px] font-black uppercase text-right">Face Total</TableHead>
                                      <TableHead className="text-[8px] font-black uppercase text-right">T. Comprador</TableHead>
                                      <TableHead className="text-[8px] font-black uppercase text-right">Com. Produtor</TableHead>
                                      <TableHead className="text-[8px] font-black uppercase text-right">Stripe Total</TableHead>
                                      <TableHead className="text-[8px] font-black uppercase text-right">Imposto (11%)</TableHead>
                                      <TableHead className="text-[8px] font-black uppercase text-right">Lucro Líquido</TableHead>
                                   </TableRow>
                                </TableHeader>
                                <TableBody>
                                   {group.details.map((t: any) => (
                                     <TableRow key={t.id} className="hover:bg-muted/20">
                                        <TableCell>
                                           <div className="flex flex-col">
                                              <span className="text-[10px] font-bold uppercase">{t.ticketTypeName}</span>
                                              <span className="text-[8px] font-medium text-muted-foreground uppercase">{t.batchName}</span>
                                           </div>
                                        </TableCell>
                                        <TableCell>
                                           <div className="flex flex-col">
                                              <span className="text-[10px] font-bold">{t.buyerName}</span>
                                              <span className="text-[8px] text-muted-foreground">{t.buyerEmail}</span>
                                           </div>
                                        </TableCell>
                                        <TableCell className="text-center font-bold text-[10px]">{t.quantity || 1}</TableCell>
                                        <TableCell className="text-right font-bold text-[10px]">{formatCurrency(t.totalFacePrice)}</TableCell>
                                        <TableCell className="text-right text-[10px] text-primary">{formatCurrency(t.buyerFeeAmount)}</TableCell>
                                        <TableCell className="text-right text-[10px] text-primary">{formatCurrency(t.organizerFeeAmount)}</TableCell>
                                        <TableCell className="text-right text-[10px] text-red-500 font-bold">-{formatCurrency(t.stripeFeeAmount)}</TableCell>
                                        <TableCell className="text-right text-[10px] text-orange-600 font-bold">-{formatCurrency(t.taxAmount)}</TableCell>
                                        <TableCell className="text-right font-black text-[10px] text-green-600">{formatCurrency(t.vibyNetProfit)}</TableCell>
                                     </TableRow>
                                   ))}
                                </TableBody>
                             </Table>
                          </div>
                        )}
                     </div>
                   )) : (
                    <div className="py-24 text-center">
                       <Inbox className="w-12 h-12 text-muted-foreground opacity-10 mx-auto mb-4" />
                       <p className="text-muted-foreground font-bold italic">Nenhuma venda encontrada para os filtros aplicados.</p>
                       <p className="text-[10px] text-muted-foreground uppercase font-black mt-2">Dica: Utilize o botão de sincronização acima para carregar vendas legadas.</p>
                    </div>
                   )}
                </div>
              )}
           </TabsContent>
        </Tabs>
      </Card>
    </div>
  )
}

function StatCard({ title, value, icon: Icon, color, subtitle }: { title: string, value: string | number, icon: any, color: string, subtitle?: string }) {
  const colorMap: Record<string, string> = {
    blue: "border-blue-500 text-blue-600 bg-blue-50",
    orange: "border-orange-500 text-orange-600 bg-orange-50",
    green: "border-green-500 text-green-600 bg-green-50",
    secondary: "border-secondary text-secondary bg-secondary/5",
    red: "border-destructive text-destructive bg-destructive/5"
  }
  return (
    <Card className={cn("border-none shadow-sm overflow-hidden border-l-4", colorMap[color])}>
       <CardHeader className="pb-2 p-5">
          <CardTitle className="text-[9px] font-black uppercase opacity-60 tracking-widest flex justify-between">
            {title}
            <Icon className="w-3 h-3" />
          </CardTitle>
       </CardHeader>
       <CardContent className="px-5 pb-5 pt-0">
          <div className="text-lg font-black">{value}</div>
          {subtitle && <p className="text-[8px] font-bold uppercase opacity-40 mt-0.5">{subtitle}</p>}
       </CardContent>
    </Card>
  )
}
