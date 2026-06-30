"use client"

import * as React from "react"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy, where, doc, serverTimestamp, getDocs, writeBatch, getDoc, Timestamp } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Receipt, 
  Loader2, 
  Search, 
  RefreshCw,
  TrendingUp,
  CreditCard,
  ChevronDown,
  ChevronUp,
  Scale,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  FilterX,
  Globe,
  Clock
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
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { calculateDetailedVibyBreakdown, ProductType } from "@/lib/financial-utils"
import { useRouter } from "next/navigation"
import { useCurrency, CurrencyCode } from "@/contexts/CurrencyContext"

/**
 * @fileOverview Fiscal & ERP - Refatorado para Auditoria com Hierarquia de Taxas.
 */
export default function AdminImpostoPage() {
  const db = useFirestore()
  const { formatPrice, convertValue, rates } = useCurrency()

  const [searchName, setSearchName] = React.useState("")
  const [selectedMonth, setSelectedMonth] = React.useState("all")
  const [expandedEvents, setExpandedEvents] = React.useState<Set<string>>(new Set())
  const [isSyncing, setIsSyncing] = React.useState(false)

  const ticketsQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "tax_tickets"), orderBy("timestamp", "desc"))
  }, [db])

  const { data: rawTickets, loading: ticketsLoading } = useCollection<any>(ticketsQuery)

  const handleSyncSales = async () => {
    if (!db) return
    setIsSyncing(true)
    try {
      const [regsSnap, stripeSnap, globalFeesSnap, promosSnap] = await Promise.all([
        getDocs(query(collection(db, "registrations"), where("paymentStatus", "in", ["Pago", "Disponível"]))),
        getDoc(doc(db, "settings", "stripe")),
        getDoc(doc(db, "settings", "fees")),
        getDoc(doc(db, "settings", "promotions"))
      ])

      const stripe = stripeSnap.data()
      const globalFees = globalFeesSnap.data()
      const promotions = promosSnap.data()
      const batch = writeBatch(db)
      let count = 0

      const orgCache: Record<string, any> = {}

      for (const regDoc of regsSnap.docs) {
        const reg = regDoc.data()
        const taxQ = query(collection(db, "tax_tickets"), where("registrationId", "==", regDoc.id))
        const taxSnap = await getDocs(taxQ)

        if (taxSnap.empty) {
          const orgId = reg.organizationId;
          if (!orgCache[orgId]) {
            const oSnap = await getDoc(doc(db, "organizations", orgId));
            orgCache[orgId] = oSnap.exists() ? oSnap.data() : {};
          }

          const eventCurrency = (reg.currency || 'BRL') as CurrencyCode;
          const currentRates = reg.exchangeRate ? { [eventCurrency]: 1/reg.exchangeRate } : rates;
          const resolvedProductType = (reg.productType as ProductType) || 'event';

          const breakdown = calculateDetailedVibyBreakdown(
            reg.ticketBasePrice || 0, 
            1, 
            currentRates, 
            stripe, 
            eventCurrency,
            orgCache[orgId],
            globalFees,
            promotions,
            resolvedProductType
          )
          
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
            buyerFeeAmount: breakdown.totalBuyerFee,
            stripeFeeAmount: breakdown.stripeFeeTotal,
            taxAmount: breakdown.imposto,
            vibyNetProfit: breakdown.vibyNet,
            payoutToProducer: breakdown.payoutToProducer,
            currency: eventCurrency,
            exchangeRate: breakdown.exchangeRate,
            vibyNetProfitBRL: breakdown.vibyNetBRL,
            totalChargedBRL: breakdown.totalChargedBRL,
            taxAmountBRL: breakdown.taxAmountBRL,
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
        toast({ title: "Sincronização Fiscal concluída!" })
      } else {
        toast({ title: "Tudo em dia!", description: "Não há novos registros para processar." })
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

  const totals = React.useMemo(() => {
    return filteredTickets.reduce((acc, t) => {
      if (t.status === 'cancelado') return acc;
      
      const cur = (t.currency || 'BRL') as CurrencyCode;
      const chargedBRL = t.totalChargedBRL || convertValue((t.totalFacePrice || 0) + (t.buyerFeeAmount || 0), cur, 'BRL');
      const netBRL = t.vibyNetProfitBRL || convertValue(t.vibyNetProfit || 0, cur, 'BRL');
      const taxBRL = t.taxAmountBRL || convertValue(t.taxAmount || 0, cur, 'BRL');
      const stripeBRL = convertValue(t.stripeFeeAmount || 0, cur, 'BRL');
      const grossVibyBRL = convertValue(t.vibyGrossProfit || 0, cur, 'BRL');

      acc.totalSold += chargedBRL;
      acc.vibyGross += grossVibyBRL;
      acc.tax += taxBRL;
      acc.vibyNet += netBRL;
      acc.stripeFees += stripeBRL;
      return acc;
    }, { totalSold: 0, vibyGross: 0, tax: 0, vibyNet: 0, stripeFees: 0 });
  }, [filteredTickets, convertValue]);

  const groupedTickets = React.useMemo(() => {
    const groups: Record<string, any> = {}
    filteredTickets.forEach(t => {
      const groupKey = `${t.eventId}_${t.occurrenceId || 'main'}`;
      if (!groups[groupKey]) {
        groups[groupKey] = {
          id: groupKey,
          eventTitle: t.eventTitle,
          orgName: t.orgName,
          currency: t.currency || 'BRL',
          salesQty: 0,
          grossViby: 0,
          totalTax: 0,
          netViby: 0,
          details: []
        }
      }
      
      if (t.status !== 'cancelado') {
        groups[groupKey].salesQty += 1;
        groups[groupKey].grossViby += (t.vibyGrossProfit || 0);
        groups[groupKey].totalTax += (t.taxAmount || 0);
        groups[groupKey].netViby += (t.vibyNetProfit || 0);
      }
      groups[groupKey].details.push(t)
    })
    return Object.values(groups)
  }, [filteredTickets])

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase italic text-primary flex items-center gap-3">
             <Scale className="w-8 h-8 text-secondary" /> Fiscal & ERP
          </h1>
          <p className="text-muted-foreground font-medium">Controle de faturamento e impostos com auditoria de taxas dinâmica.</p>
        </div>
        <Button variant="outline" onClick={handleSyncSales} disabled={isSyncing} className="rounded-full h-11 px-6 font-black uppercase text-[10px] gap-2 border-secondary text-secondary">
          {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Sincronizar Ledger
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
         <StatCard title="GMV Consolidado BRL" value={totals.totalSold} icon={TrendingUp} color="blue" formatPrice={formatPrice} />
         <StatCard title="Stripe Fees (Est)" value={totals.stripeFees} icon={CreditCard} color="red" formatPrice={formatPrice} />
         <StatCard title="Lucro Bruto Viby" value={totals.vibyGross} icon={ArrowUpRight} color="secondary" formatPrice={formatPrice} />
         <StatCard title="Provisão Imposto" value={totals.tax} icon={Receipt} color="orange" formatPrice={formatPrice} />
         <StatCard title="Lucro Líquido Real" value={totals.vibyNet} icon={CheckCircle2} color="green" formatPrice={formatPrice} />
      </div>

      <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
        <CardHeader className="p-8 border-b">
           <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex-1 max-w-md relative">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                 <Input placeholder="Buscar evento ou marca..." value={searchName} onChange={e => setSearchName(e.target.value)} className="pl-10 h-11 rounded-xl" />
              </div>
              <div className="p-4 bg-muted/20 rounded-2xl border border-dashed flex items-center gap-3">
                 <Clock className="w-4 h-4 text-secondary" />
                 <p className="text-[10px] font-bold text-muted-foreground uppercase leading-tight">Auditoria: Lógica de hierarquia validada conforme snapshots das vendas.</p>
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
                        <div className="flex items-center gap-2">
                           <span className="text-[9px] font-bold text-muted-foreground uppercase">{group.orgName}</span>
                           <Badge className="bg-primary text-white text-[7px] font-black h-4 px-1">{group.currency}</Badge>
                        </div>
                      </div>
                   </div>
                   <div className="col-span-2 text-right">
                      <p className="text-[9px] font-black uppercase opacity-40">Bruto Viby</p>
                      <p className="font-black text-sm">{formatPrice(group.grossViby, group.currency)}</p>
                   </div>
                   <div className="col-span-2 text-right">
                      <p className="text-[9px] font-black uppercase opacity-40">Lucro Real</p>
                      <p className="font-black text-sm text-green-600">{formatPrice(group.netViby, group.currency)}</p>
                   </div>
                   <div className="col-span-3 text-right"><Badge variant="outline" className="text-[9px] font-black uppercase px-3">{group.salesQty} vendas</Badge></div>
                </div>
                {expandedEvents.has(group.id) && (
                  <div className="bg-muted/20 px-8 py-6 animate-in slide-in-from-top-2">
                     <Table>
                        <TableHeader><TableRow className="hover:bg-transparent">
                          <TableHead className="h-8 text-[8px] font-black uppercase">Comprador</TableHead>
                          <TableHead className="h-8 text-[8px] font-black uppercase text-center">Câmbio Registrado</TableHead>
                          <TableHead className="h-8 text-[8px] font-black uppercase text-right">Bruto Viby</TableHead>
                          <TableHead className="h-8 text-[8px] font-black uppercase text-right">Imposto (BRL)</TableHead>
                          <TableHead className="h-8 text-[8px] font-black uppercase text-right">Líq. Real BRL</TableHead>
                        </TableRow></TableHeader>
                        <TableBody>
                           {group.details.map((t: any) => (
                             <TableRow key={t.id} className={cn(t.status === 'cancelado' && "opacity-40 line-through")}>
                               <TableCell className="py-2 text-[10px] font-bold uppercase">{t.buyerName}</TableCell>
                               <TableCell className="text-center py-2">
                                  <Badge variant="secondary" className="text-[7px] font-black">
                                    {t.exchangeRate ? `1 ${t.currency} = R$ ${t.exchangeRate.toFixed(4)}` : 'Câmbio Dinâmico'}
                                  </Badge>
                               </TableCell>
                               <TableCell className="text-right py-2 text-[10px]">{formatPrice(t.vibyGrossProfit, t.currency)}</TableCell>
                               <TableCell className="text-right py-2 text-[10px] text-orange-600">
                                  {t.taxAmountBRL ? formatPrice(t.taxAmountBRL, 'BRL') : `-${formatPrice(t.taxAmount, t.currency)}`}
                               </TableCell>
                               <TableCell className="text-right py-2 text-[10px] font-black text-green-600">
                                  {t.vibyNetProfitBRL ? formatPrice(t.vibyNetProfitBRL, 'BRL') : formatPrice(convertValue(t.vibyNetProfit, t.currency, 'BRL'), 'BRL')}
                               </TableCell>
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

function StatCard({ title, value, icon: Icon, color, formatPrice }: any) {
  const colors: any = { 
    blue: "border-blue-500 text-blue-600 bg-blue-50", 
    orange: "border-orange-500 text-orange-600 bg-orange-50", 
    green: "border-green-500 text-green-600 bg-green-50", 
    secondary: "border-secondary text-secondary bg-secondary/5", 
    red: "border-destructive text-destructive bg-destructive/5" 
  };
  return (
    <Card className={cn("border-none shadow-sm border-l-4 p-5", colors[color])}>
       <p className="text-[9px] font-black uppercase opacity-60 flex justify-between">{title}<Icon className="w-3" /></p>
       <div className="text-lg font-black mt-1">{formatPrice(value, 'BRL')}</div>
    </Card>
  )
}
