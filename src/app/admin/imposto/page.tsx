
"use client"

import * as React from "react"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy, where, updateDoc, doc, serverTimestamp, addDoc } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Receipt, 
  Loader2, 
  Search, 
  Filter, 
  Download, 
  FileText, 
  Calendar, 
  Building2, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  FilterX,
  FileSpreadsheet
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
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/financial-utils"
import * as XLSX from 'xlsx'
import { useSearchParams, useRouter } from "next/navigation"

export default function AdminImpostoPage() {
  const db = useFirestore()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [searchName, setSearchName] = React.useState(searchParams.get('q') || "")
  const [searchCnpj, setSearchCnpj] = React.useState(searchParams.get('cnpj') || "")
  const [selectedMonth, setSelectedCategory] = React.useState(searchParams.get('month') || "all")
  const [activeTab, setActiveTab] = React.useState(searchParams.get('tab') || "ads")

  const adsQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "tax_ads"), orderBy("nfDeadlineDate", "desc"))
  }, [db])

  const ticketsQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "tax_tickets"), orderBy("nfDeadlineDate", "desc"))
  }, [db])

  const { data: ads, loading: adsLoading } = useCollection<any>(adsQuery)
  const { data: tickets, loading: ticketsLoading } = useCollection<any>(ticketsQuery)

  const updateFilters = React.useCallback(() => {
    const params = new URLSearchParams()
    if (searchName) params.set('q', searchName)
    if (searchCnpj) params.set('cnpj', searchCnpj)
    if (selectedMonth !== 'all') params.set('month', selectedMonth)
    params.set('tab', activeTab)
    router.push(`?${params.toString()}`)
  }, [searchName, searchCnpj, selectedMonth, activeTab, router])

  React.useEffect(() => {
    const timer = setTimeout(updateFilters, 500)
    return () => clearTimeout(timer)
  }, [searchName, searchCnpj, selectedMonth, activeTab, updateFilters])

  const filterList = (list: any[]) => {
    if (!list) return []
    return list.filter(item => {
      const matchName = !searchName || (item.advertiserName || item.orgName || "").toLowerCase().includes(searchName.toLowerCase()) || (item.adTitle || item.eventTitle || "").toLowerCase().includes(searchName.toLowerCase())
      const matchCnpj = !searchCnpj || (item.advertiserCnpj || item.orgCnpj || "").includes(searchCnpj.replace(/\D/g, ""))
      const matchMonth = selectedMonth === 'all' || item.monthKey === selectedMonth
      return matchName && matchCnpj && matchMonth
    })
  }

  const filteredAds = React.useMemo(() => filterList(ads || []), [ads, searchName, searchCnpj, selectedMonth])
  const filteredTickets = React.useMemo(() => filterList(tickets || []), [tickets, searchName, searchCnpj, selectedMonth])

  const adStats = React.useMemo(() => {
    return filteredAds.reduce((acc, ad) => {
      acc.gross += (ad.grossValue || 0)
      acc.tax += (ad.taxValue || 0)
      acc.net += (ad.netValue || 0)
      if (ad.status === 'ativo') acc.active++
      if (ad.status === 'cancelado') acc.canceled++
      return acc
    }, { gross: 0, tax: 0, net: 0, active: 0, canceled: 0 })
  }, [filteredAds])

  const ticketStats = React.useMemo(() => {
    return filteredTickets.reduce((acc, t) => {
      acc.gross += (t.vibyGrossValue || 0)
      acc.tax += (t.taxValue || 0)
      acc.net += (t.vibyNetValue || 0)
      acc.tickets += (t.ticketsSold || 0)
      acc.events++
      return acc
    }, { gross: 0, tax: 0, net: 0, tickets: 0, events: 0 })
  }, [filteredTickets])

  const handleExport = (format: 'csv' | 'xlsx', type: 'ads' | 'tickets') => {
    const data = type === 'ads' ? filteredAds : filteredTickets
    const fileName = `viby_tax_${type}_${new Date().toISOString().split('T')[0]}`
    
    const exportData = data.map(item => {
      if (type === 'ads') {
        return {
          'CNPJ': item.advertiserCnpj,
          'Empresa': item.advertiserName,
          'Anúncio': item.adTitle,
          'Início': item.startDate,
          'Fim': item.endDate,
          'Status': item.status,
          'Valor Bruto': item.grossValue,
          'Imposto (11%)': item.taxValue,
          'Valor Líquido': item.netValue,
          'Data Limite NF': item.nfDeadlineDate,
          'Status NF': item.nfStatus
        }
      }
      return {
        'Evento': item.eventTitle,
        'Empresa': item.orgName,
        'CNPJ': item.orgCnpj,
        'Ingressos Vendidos': item.ticketsSold,
        'Bruto Viby': item.vibyGrossValue,
        'Imposto (11%)': item.taxValue,
        'Líquido Viby': item.vibyNetValue,
        'Data Limite NF': item.nfDeadlineDate,
        'Status NF': item.nfStatus
      }
    })

    if (format === 'csv') {
      const worksheet = XLSX.utils.json_to_sheet(exportData)
      const csv = XLSX.utils.sheet_to_csv(worksheet)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement("a")
      link.href = URL.createObjectURL(blob)
      link.download = `${fileName}.csv`
      link.click()
    } else {
      const worksheet = XLSX.utils.json_to_sheet(exportData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, "Impostos")
      XLSX.writeFile(workbook, `${fileName}.xlsx`)
    }

    if (db) {
      addDoc(collection(db, "tax_exports"), {
        type, format, filterMonth: selectedMonth, timestamp: serverTimestamp(), count: data.length
      })
    }
  }

  const handleUpdateNF = async (type: 'ads' | 'tickets', id: string, status: string) => {
    if (!db) return
    const coll = type === 'ads' ? 'tax_ads' : 'tax_tickets'
    try {
      await updateDoc(doc(db, coll, id), { 
        nfStatus: status, 
        nfUpdatedAt: serverTimestamp() 
      })
      toast({ title: "Status da NF atualizado!" })
      
      addDoc(collection(db, "tax_audit"), {
        type: 'nf_status_change',
        entityId: id,
        entityType: type,
        newStatus: status,
        timestamp: serverTimestamp()
      })
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao atualizar" })
    }
  }

  const months = React.useMemo(() => {
    const list = []
    const now = new Date()
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
      list.push({ key, label })
    }
    return list
  }, [])

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
          <Receipt className="w-8 h-8 text-secondary" />
          Gestão de Impostos e Notas
        </h1>
        <p className="text-muted-foreground font-medium">Controle fiscal da plataforma e emissão de notas fiscais obrigatórias.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {activeTab === 'ads' ? (
          <>
            <StatCard title="Total Bruto Anúncios" value={formatCurrency(adStats.gross)} icon={ArrowUpRight} color="blue" />
            <StatCard title="Total Imposto (11%)" value={formatCurrency(adStats.tax)} icon={Receipt} color="orange" />
            <StatCard title="Total Líquido Anúncios" value={formatCurrency(adStats.net)} icon={ArrowDownRight} color="green" />
            <StatCard title="Campanhas Ativas" value={adStats.active} icon={CheckCircle2} color="secondary" />
            <StatCard title="Campanhas Canceladas" value={adStats.canceled} icon={XCircle} color="red" />
          </>
        ) : (
          <>
            <StatCard title="Total Bruto Viby" value={formatCurrency(ticketStats.gross)} icon={ArrowUpRight} color="blue" />
            <StatCard title="Total Imposto (11%)" value={formatCurrency(ticketStats.tax)} icon={Receipt} color="orange" />
            <StatCard title="Total Líquido Viby" value={formatCurrency(ticketStats.net)} icon={ArrowDownRight} color="green" />
            <StatCard title="Ingressos Vendidos" value={ticketStats.tickets} icon={Ticket} color="secondary" />
            <StatCard title="Total de Eventos" value={ticketStats.events} icon={Calendar} color="purple" />
          </>
        )}
      </div>

      <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
        <CardHeader className="p-8 border-b">
           <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
              <div className="md:col-span-3">
                <Label className="text-[10px] font-black uppercase opacity-40 mb-1 block">Filtrar Mês</Label>
                <Select value={selectedMonth} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="rounded-xl h-11 border-dashed border-secondary/20">
                    <SelectValue placeholder="Selecione o mês" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all">Todos os meses</SelectItem>
                    {months.map(m => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-3">
                <Label className="text-[10px] font-black uppercase opacity-40 mb-1 block">Buscar Nome</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Empresa ou Título..." value={searchName} onChange={e => setSearchName(e.target.value)} className="pl-9 h-11 rounded-xl" />
                </div>
              </div>
              <div className="md:col-span-3">
                <Label className="text-[10px] font-black uppercase opacity-40 mb-1 block">Filtrar CNPJ</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Somente números..." value={searchCnpj} onChange={e => setSearchCnpj(e.target.value)} className="pl-9 h-11 rounded-xl" />
                </div>
              </div>
              <div className="md:col-span-3 flex items-end gap-2">
                 <Button variant="outline" className="flex-1 h-11 rounded-xl border-dashed" onClick={() => { setSearchName(""); setSearchCnpj(""); setSelectedCategory("all") }}>
                    <FilterX className="w-4 h-4 mr-2" /> Limpar
                 </Button>
                 <div className="flex gap-1">
                    <Button variant="secondary" size="icon" className="h-11 w-11 rounded-xl" onClick={() => handleExport('csv', activeTab as any)}><FileText className="w-4 h-4" /></Button>
                    <Button variant="secondary" size="icon" className="h-11 w-11 rounded-xl" onClick={() => handleExport('xlsx', activeTab as any)}><FileSpreadsheet className="w-4 h-4" /></Button>
                 </div>
              </div>
           </div>
        </CardHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
           <TabsList className="bg-muted/30 w-full h-14 rounded-none border-b p-0 gap-0">
              <TabsTrigger value="ads" className="flex-1 h-full rounded-none border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:bg-white font-black uppercase text-[10px] tracking-widest gap-2">
                <Megaphone className="w-4 h-4" /> Anúncios Pagos
              </TabsTrigger>
              <TabsTrigger value="tickets" className="flex-1 h-full rounded-none border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:bg-white font-black uppercase text-[10px] tracking-widest gap-2">
                <Ticket className="w-4 h-4" /> Taxas de Ingressos
              </TabsTrigger>
           </TabsList>

           <TabsContent value="ads" className="m-0">
              {adsLoading ? (
                <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-secondary" /></div>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/20">
                    <TableRow>
                      <TableHead className="font-black uppercase text-[9px] tracking-widest py-6 px-8">Anunciante / CNPJ</TableHead>
                      <TableHead className="font-black uppercase text-[9px] tracking-widest text-center">Anúncio</TableHead>
                      <TableHead className="font-black uppercase text-[9px] tracking-widest text-right">Valores</TableHead>
                      <TableHead className="font-black uppercase text-[9px] tracking-widest text-center">Data Limite NF</TableHead>
                      <TableHead className="font-black uppercase text-[9px] tracking-widest text-center">Status NF</TableHead>
                      <TableHead className="font-black uppercase text-[9px] tracking-widest text-right px-8">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAds.length > 0 ? filteredAds.map((ad) => (
                      <TableRow key={ad.id} className="hover:bg-muted/5 transition-colors">
                        <TableCell className="py-6 px-8">
                           <div className="flex flex-col">
                              <span className="font-bold text-sm uppercase">{ad.advertiserName}</span>
                              <span className="text-[10px] font-mono text-muted-foreground">{ad.advertiserCnpj}</span>
                           </div>
                        </TableCell>
                        <TableCell className="text-center">
                           <div className="flex flex-col gap-1 items-center">
                              <span className="font-bold text-xs uppercase">{ad.adTitle}</span>
                              <Badge variant="outline" className="text-[7px] font-black uppercase h-4 px-1">{ad.status}</Badge>
                           </div>
                        </TableCell>
                        <TableCell className="text-right">
                           <div className="flex flex-col">
                              <span className="font-black text-sm text-primary">{formatCurrency(ad.grossValue)}</span>
                              <span className="text-[9px] font-bold text-orange-500 uppercase">Imposto: {formatCurrency(ad.taxValue)}</span>
                              <span className="text-[9px] font-bold text-green-600 uppercase">Líquido: {formatCurrency(ad.netValue)}</span>
                           </div>
                        </TableCell>
                        <TableCell className="text-center">
                           <span className="text-xs font-bold text-muted-foreground">{ad.nfDeadlineDate}</span>
                        </TableCell>
                        <TableCell className="text-center">
                           <Badge className={cn(
                             "text-[9px] font-black uppercase px-2.5 h-6",
                             ad.nfStatus === 'emitida' ? "bg-green-600 text-white" : "bg-orange-500 text-white"
                           )}>
                             {ad.nfStatus || 'pendente'}
                           </Badge>
                        </TableCell>
                        <TableCell className="text-right px-8">
                           <Select value={ad.nfStatus || 'pendente'} onValueChange={(val) => handleUpdateNF('ads', ad.id, val)}>
                              <SelectTrigger className="h-8 rounded-lg text-[9px] font-black uppercase border-secondary/20">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl">
                                <SelectItem value="pendente">Pendente</SelectItem>
                                <SelectItem value="emitida">Emitida</SelectItem>
                              </SelectContent>
                           </Select>
                        </TableCell>
                      </TableRow>
                    )) : (
                      <TableRow><TableCell colSpan={6} className="py-20 text-center italic text-muted-foreground">Nenhum registro de imposto de anúncio localizado.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
           </TabsContent>

           <TabsContent value="tickets" className="m-0">
              {ticketsLoading ? (
                <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-secondary" /></div>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/20">
                    <TableRow>
                      <TableHead className="font-black uppercase text-[9px] tracking-widest py-6 px-8">Empresa / Evento</TableHead>
                      <TableHead className="font-black uppercase text-[9px] tracking-widest text-center">Vendas</TableHead>
                      <TableHead className="font-black uppercase text-[9px] tracking-widest text-right">Comissões Viby</TableHead>
                      <TableHead className="font-black uppercase text-[9px] tracking-widest text-center">Data Limite NF</TableHead>
                      <TableHead className="font-black uppercase text-[9px] tracking-widest text-center">Status NF</TableHead>
                      <TableHead className="font-black uppercase text-[9px] tracking-widest text-right px-8">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTickets.length > 0 ? filteredTickets.map((t) => (
                      <TableRow key={t.id} className="hover:bg-muted/5 transition-colors">
                        <TableCell className="py-6 px-8">
                           <div className="flex flex-col">
                              <span className="font-bold text-sm uppercase">{t.orgName}</span>
                              <span className="text-[10px] font-bold text-muted-foreground uppercase">{t.eventTitle}</span>
                              <span className="text-[9px] font-mono opacity-40">{t.orgCnpj}</span>
                           </div>
                        </TableCell>
                        <TableCell className="text-center font-black text-sm">{t.ticketsSold} <span className="text-[10px] font-bold text-muted-foreground ml-1">un.</span></TableCell>
                        <TableCell className="text-right">
                           <div className="flex flex-col">
                              <span className="font-black text-sm text-primary">{formatCurrency(t.vibyGrossValue)}</span>
                              <span className="text-[9px] font-bold text-orange-500 uppercase">Imposto (11%): {formatCurrency(t.taxValue)}</span>
                              <span className="text-[9px] font-bold text-green-600 uppercase">Líquido Viby: {formatCurrency(t.vibyNetValue)}</span>
                           </div>
                        </TableCell>
                        <TableCell className="text-center">
                           <span className="text-xs font-bold text-muted-foreground">{t.nfDeadlineDate}</span>
                        </TableCell>
                        <TableCell className="text-center">
                           <Badge className={cn(
                             "text-[9px] font-black uppercase px-2.5 h-6",
                             t.nfStatus === 'emitida' ? "bg-green-600 text-white" : "bg-orange-500 text-white"
                           )}>
                             {t.nfStatus || 'pendente'}
                           </Badge>
                        </TableCell>
                        <TableCell className="text-right px-8">
                           <Select value={t.nfStatus || 'pendente'} onValueChange={(val) => handleUpdateNF('tickets', t.id, val)}>
                              <SelectTrigger className="h-8 rounded-lg text-[9px] font-black uppercase border-secondary/20">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl">
                                <SelectItem value="pendente">Pendente</SelectItem>
                                <SelectItem value="emitida">Emitida</SelectItem>
                              </SelectContent>
                           </Select>
                        </TableCell>
                      </TableRow>
                    )) : (
                      <TableRow><TableCell colSpan={6} className="py-20 text-center italic text-muted-foreground">Nenhum registro de imposto sobre ingressos localizado.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
           </TabsContent>
        </Tabs>
      </Card>
    </div>
  )
}

function StatCard({ title, value, icon: Icon, color }: { title: string, value: string | number, icon: any, color: string }) {
  const colorMap: Record<string, string> = {
    blue: "border-blue-500 text-blue-600 bg-blue-50",
    orange: "border-orange-500 text-orange-600 bg-orange-50",
    green: "border-green-500 text-green-600 bg-green-50",
    secondary: "border-secondary text-secondary bg-secondary/5",
    red: "border-destructive text-destructive bg-destructive/5",
    purple: "border-purple-500 text-purple-600 bg-purple-50"
  }
  
  return (
    <Card className={cn("border-none shadow-sm overflow-hidden border-l-4", colorMap[color])}>
       <CardHeader className="pb-2 p-6">
          <CardTitle className="text-[10px] font-black uppercase opacity-60 tracking-widest flex justify-between">
            {title}
            <Icon className="w-3.5 h-3.5" />
          </CardTitle>
       </CardHeader>
       <CardContent className="px-6 pb-6 pt-0">
          <div className="text-2xl font-black">{value}</div>
       </CardContent>
    </Card>
  )
}
