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
  CheckCircle2, 
  ArrowUpRight,
  ArrowDownRight,
  FilterX,
  FileSpreadsheet,
  Ticket,
  TrendingUp,
  CreditCard,
  ChevronDown,
  ChevronUp,
  Scale,
  RefreshCw,
  Calendar
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
import Link from "next/link"

function AdminImpostoContent() {
  const db = useFirestore()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [searchName, setSearchName] = React.useState(searchParams.get('q') || "")
  const [selectedMonth, setSelectedMonth] = React.useState(searchParams.get('month') || "all")
  const [activeTab, setActiveTab] = React.useState(searchParams.get('tab') || "tickets")
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

  const handleSyncLegacySales = async () => {
    if (!db) return
    setIsSyncing(true)
    try {
      const [regsSnap, stripeSnap] = await Promise.all([
        getDocs(query(collection(db, "registrations"), where("paymentStatus", "in", ["Pago", "Disponível"]))),
        getDoc(doc(db, "settings", "stripe"))
      ])

      const stripe = stripeSnap.data()
      const batch = writeBatch(db)
      let count = 0

      for (const regDoc of regsSnap.docs) {
        const reg = regDoc.data()
        const taxQ = query(collection(db, "tax_tickets"), where("registrationId", "==", regDoc.id))
        const taxSnap = await getDocs(taxQ)

        if (taxSnap.empty) {
          const breakdown = calculateDetailedVibyBreakdown(reg.ticketBasePrice || 0, 1, null, stripe)
          const monthKey = reg.timestamp ? 
            (reg.timestamp.toDate ? reg.timestamp.toDate() : new Date(reg.timestamp)).toISOString().slice(0, 7) : 
            new Date().toISOString().slice(0, 7)

          const taxRef = doc(collection(db, "tax_tickets"))
          batch.set(taxRef, {
            registrationId: regDoc.id,
            eventId: reg.eventId,
            occurrenceId: reg.occurrenceId || null,
            eventTitle: reg.eventTitle,
            organizationId: reg.organizationId,
            orgName: reg.orgName || "Organização",
            buyerName: reg.userName || "Comprador",
            totalFacePrice: breakdown.totalFace,
            vibyGrossProfit: breakdown.vibyGross,
            stripeFeeAmount: breakdown.stripeFeeTotal,
            taxAmount: breakdown.imposto,
            vibyNetProfit: breakdown.vibyNet,
            payoutToProducer: breakdown.payoutToProducer,
            monthKey,
            nfStatus: 'pendente',
            status: 'ativo',
            timestamp: reg.timestamp || serverTimestamp()
          })
          count++
        }
      }

      if (count > 0) {
        await batch.commit()
        toast({ title: "Sincronização Concluída!", description: `${count} vendas processadas.` })
      } else {
        toast({ title: "Tudo em dia!" })
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Erro na sincronização" })
    } finally {
      setIsSyncing(false)
    }
  }

  const filteredTickets = React.useMemo(() => {
    if (!rawTickets) return []
    return rawTickets.filter(t => {
      const matchName = !searchName || (t.eventTitle || "").toLowerCase().includes(searchName.toLowerCase()) || (t.orgName || "").toLowerCase().includes(searchName.toLowerCase())
      const matchMonth = selectedMonth === 'all' || t.monthKey === selectedMonth
      return matchName && matchMonth
    })
  }, [rawTickets, searchName, selectedMonth])

  const ticketStats = React.useMemo(() => {
    return filteredTickets.reduce((acc, t) => {
      if (t.status === 'cancelado') return acc;
      
      const net = t.vibyNetProfit || 0;
      const tax = t.taxAmount || 0;
      const stripe = t.stripeFeeAmount || 0;
      const gross = t.vibyGrossProfit || (net + tax + stripe);

      acc.totalSold += (t.totalFacePrice || 0)
      acc.payouts += (t.payoutToProducer || 0)
      acc.vibyGross += gross
      acc.imposto += tax
      acc.vibyNet += net
      acc.stripeTotal += stripe
      return acc
    }, { totalSold: 0, payouts: 0, vibyGross: 0, imposto: 0, vibyNet: 0, stripeTotal: 0 })
  }, [filteredTickets])

  const groupedTickets = React.useMemo(() => {
    const groups: Record<string, any> = {}
    filteredTickets.forEach(t => {
      const groupKey = `${t.eventId}_${t.occurrenceId || 'main'}`;
      if (!groups[groupKey]) {
        groups[groupKey] = {
          id: groupKey,
          eventTitle: t.eventTitle,
          orgName: t.orgName,
          salesQty: 0,
          grossViby: 0,
          totalTax: 0,
          netViby: 0,
          details: []
        }
      }
      
      if (t.status !== 'cancelado') {
        const net = t.vibyNetProfit || 0;
        const tax = t.taxAmount || 0;
        const stripe = t.stripeFeeAmount || 0;
        const gross = t.vibyGrossProfit || (net + tax + stripe);

        groups[groupKey].salesQty += (t.quantity || 1)
        groups[groupKey].grossViby += gross
        groups[groupKey].totalTax += tax
        groups[groupKey].netViby += net
      }
      groups[groupKey].details.push(t)
    })
    return Object.values(groups)
  }, [filteredTickets])

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase italic text-primary flex items-center gap-3"><Scale className="w-8 h-8 text-secondary" /> Fiscal & ERP</h1>
          <p className="text-muted-foreground font-medium">Controle de faturamento único: 10% ou R$ 3,99.</p>
        </div>
        <Button variant="outline" onClick={handleSyncLegacySales} disabled={isSyncing} className="rounded-full h-11 px-6 font-black uppercase text-[10px] gap-2 border-secondary text-secondary">
          {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Sincronizar Vendas
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
         <StatCard title="Venda Bruta" value={formatCurrency(ticketStats.totalSold)} icon={TrendingUp} color="blue" />
         <StatCard title="Repasse Líquido" value={formatCurrency(ticketStats.payouts)} icon={ArrowDownRight} color="orange" />
         <StatCard title="Taxas Gateway" value={formatCurrency(ticketStats.stripeTotal)} icon={CreditCard} color="red" />
         <StatCard title="Lucro Bruto" value={formatCurrency(ticketStats.vibyGross)} icon={ArrowUpRight} color="secondary" />
         <StatCard title="Lucro Real (DRE)" value={formatCurrency(ticketStats.vibyNet)} icon={CheckCircle2} color="green" />
      </div>

      <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
        <CardHeader className="p-8 border-b">
           <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex-1 max-w-md relative">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                 <Input placeholder="Buscar evento ou marca..." value={searchName} onChange={e => setSearchName(e.target.value)} className="pl-10 h-11 rounded-xl" />
              </div>
              <div className="flex gap-2">
                 <Button variant="outline" className="rounded-xl h-11" onClick={() => { setSearchName(""); setSelectedMonth("all") }}><FilterX className="w-4 h-4" /></Button>
              </div>
           </div>
        </CardHeader>
        <div className="divide-y">
           {groupedTickets.map((group) => (
             <div key={group.id}>
                <div className="px-8 py-6 grid grid-cols-12 gap-4 items-center hover:bg-muted/10 cursor-pointer" onClick={() => setExpandedEvents(prev => {
                  const n = new Set(prev); if (n.has(group.id)) n.delete(group.id); else n.add(group.id); return n;
                })}>
                   <div className="col-span-5 flex items-center gap-4">
                      <div className="p-2 bg-secondary/10 rounded-lg text-secondary">{expandedEvents.has(group.id) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</div>
                      <div className="flex flex-col">
                        <span className="font-black text-sm uppercase italic text-primary">{group.eventTitle}</span>
                        <span className="text-[9px] font-bold text-muted-foreground uppercase">{group.orgName}</span>
                      </div>
                   </div>
                   <div className="col-span-2 text-right"><p className="text-[9px] font-black uppercase opacity-40">Bruto Viby</p><p className="font-black text-sm">{formatCurrency(group.grossViby)}</p></div>
                   <div className="col-span-2 text-right"><p className="text-[9px] font-black uppercase opacity-40">Líquido</p><p className="font-black text-sm text-green-600">{formatCurrency(group.netViby)}</p></div>
                   <div className="col-span-3 text-right"><Badge variant="outline" className="text-[9px] font-black uppercase px-3">{group.salesQty} vendas</Badge></div>
                </div>
                {expandedEvents.has(group.id) && (
                  <div className="bg-muted/20 px-8 py-6 animate-in slide-in-from-top-2">
                     <Table>
                        <TableHeader><TableRow className="hover:bg-transparent"><TableHead className="h-8 text-[8px] font-black uppercase">Comprador</TableHead><TableHead className="h-8 text-[8px] font-black uppercase text-right">Face</TableHead><TableHead className="h-8 text-[8px] font-black uppercase text-right">Repasse</TableHead><TableHead className="h-8 text-[8px] font-black uppercase text-right">Líq. Viby</TableHead><TableHead className="h-8 text-[8px] font-black uppercase text-center">Status</TableHead></TableRow></TableHeader>
                        <TableBody>
                           {group.details.map((t: any) => (
                             <TableRow key={t.id} className={cn(t.status === 'cancelado' && "opacity-40 line-through")}>
                               <TableCell className="py-2 text-[10px] font-bold uppercase">{t.buyerName}</TableCell>
                               <TableCell className="text-right py-2 text-[10px]">{formatCurrency(t.totalFacePrice)}</TableCell>
                               <TableCell className="text-right py-2 text-[10px] font-medium text-primary">{formatCurrency(t.payoutToProducer)}</TableCell>
                               <TableCell className="text-right py-2 text-[10px] font-black text-green-600">{formatCurrency(t.vibyNetProfit)}</TableCell>
                               <TableCell className="text-center py-2"><Badge className={cn("text-[7px] font-black uppercase h-4 px-2", t.status === 'cancelado' ? 'bg-red-500' : 'bg-green-500')}>{t.status || 'ativo'}</Badge></TableCell>
                             </TableRow>
                           ))}
                        </TableBody>
                     </Table>
                  </div>
                )}
             </div>
           ))}
        </div>
      </Card>
    </div>
  )
}

function StatCard({ title, value, icon: Icon, color }: any) {
  const colors: any = { blue: "border-blue-500 text-blue-600 bg-blue-50", orange: "border-orange-500 text-orange-600 bg-orange-50", green: "border-green-500 text-green-600 bg-green-50", secondary: "border-secondary text-secondary bg-secondary/5", red: "border-destructive text-destructive bg-destructive/5" };
  return (
    <Card className={cn("border-none shadow-sm border-l-4 p-5", colors[color])}>
       <p className="text-[9px] font-black uppercase opacity-60 flex justify-between">{title}<Icon className="w-3 h-3" /></p>
       <div className="text-lg font-black mt-1">{value}</div>
    </Card>
  )
}

export default function AdminImpostoPage() {
  return (
    <React.Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="animate-spin text-secondary" /></div>}><AdminImpostoContent /></React.Suspense>
  );
}
