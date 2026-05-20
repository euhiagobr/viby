"use client"

import * as React from "react"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy, doc, updateDoc, deleteDoc } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Megaphone, 
  Loader2, 
  Search, 
  CheckCircle2, 
  XCircle, 
  Pause, 
  Play, 
  Trash2,
  Calendar,
  DollarSign,
  TrendingUp,
  ExternalLink,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/financial-utils"
import Link from "next/link"

export default function AdminAnunciosPage() {
  const db = useFirestore()
  const [search, setSearch] = React.useState("")

  const adsQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "ads"))
  }, [db])

  const { data: ads, loading } = useCollection<any>(adsQuery)

  const filteredAds = React.useMemo(() => {
    if (!ads) return []
    const sorted = [...ads].sort((a, b) => {
      const tA = a.createdAt?.seconds || 0
      const tB = b.createdAt?.seconds || 0
      return tB - tA
    })
    return sorted.filter(ad => 
      (ad.eventTitle?.toLowerCase() || "").includes(search.toLowerCase())
    )
  }, [ads, search])

  const handleUpdateStatus = async (adId: string, status: string) => {
    if (!db) return
    try {
      await updateDoc(doc(db, "ads", adId), { status })
      toast({ title: "Status atualizado!", description: `Anúncio agora está ${status}.` })
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao atualizar" })
    }
  }

  const handleDeleteAd = async (id: string) => {
    if (!db) return
    if (!confirm("Excluir permanentemente este registro de anúncio?")) return
    try {
      await deleteDoc(doc(db, "ads", id))
      toast({ title: "Anúncio removido" })
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao remover" })
    }
  }

  const pendingAds = filteredAds.filter(a => a.status === 'Pendente' || a.status === 'Pendente Pagamento')
  const activeAds = filteredAds.filter(a => a.status === 'Ativo')
  const otherAds = filteredAds.filter(a => a.status !== 'Ativo' && a.status !== 'Pendente' && a.status !== 'Pendente Pagamento')

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
          <Megaphone className="w-8 h-8 text-secondary" />
          Moderação de Anúncios
        </h1>
        <p className="text-muted-foreground font-medium">Revise e aprove as campanhas de impulsionamento da plataforma.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <Card className="border-none shadow-sm bg-white border-l-4 border-blue-500">
            <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Aguardando Revisão</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-black">{pendingAds.length}</div></CardContent>
         </Card>
         <Card className="border-none shadow-sm bg-white border-l-4 border-green-500">
            <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Campanhas Ativas</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-black text-green-600">{activeAds.length}</div></CardContent>
         </Card>
         <Card className="border-none shadow-sm bg-secondary text-white">
            <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase opacity-60 tracking-widest">Receita Ads (Bruto)</CardTitle></CardHeader>
            <CardContent>
               <div className="text-2xl font-black">
                 {formatCurrency(filteredAds.reduce((acc, a) => acc + (a.budget || 0), 0))}
               </div>
            </CardContent>
         </Card>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por título do evento..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 rounded-xl"
          />
        </div>
      </div>

      <Tabs defaultValue="pending" className="space-y-6">
        <TabsList className="bg-muted/50 p-1 rounded-xl h-12">
          <TabsTrigger value="pending" className="rounded-lg px-6 font-bold gap-2">
            <Clock className="w-4 h-4" /> Pendentes ({pendingAds.length})
          </TabsTrigger>
          <TabsTrigger value="active" className="rounded-lg px-6 font-bold gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-500" /> Ativos ({activeAds.length})
          </TabsTrigger>
          <TabsTrigger value="all" className="rounded-lg px-6 font-bold gap-2">
            <TrendingUp className="w-4 h-4" /> Outros ({otherAds.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <AdTable ads={pendingAds} onUpdate={handleUpdateStatus} onDelete={handleDeleteAd} />
        </TabsContent>
        <TabsContent value="active">
          <AdTable ads={activeAds} onUpdate={handleUpdateStatus} onDelete={handleDeleteAd} />
        </TabsContent>
        <TabsContent value="all">
          <AdTable ads={otherAds} onUpdate={handleUpdateStatus} onDelete={handleDeleteAd} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function AdTable({ ads, onUpdate, onDelete }: { ads: any[], onUpdate: (id: string, s: string) => void, onDelete: (id: string) => void }) {
  if (ads.length === 0) {
    return (
      <Card className="border-none shadow-sm rounded-2xl bg-white p-12 text-center">
        <Megaphone className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-10" />
        <p className="text-muted-foreground font-medium italic">Nenhum anúncio nesta categoria.</p>
      </Card>
    )
  }

  return (
    <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-white">
      <Table>
        <TableHeader className="bg-muted/30">
          <TableRow>
            <TableHead className="font-bold">Evento / Tipo</TableHead>
            <TableHead className="font-bold">Investimento</TableHead>
            <TableHead className="font-bold">Período</TableHead>
            <TableHead className="font-bold text-center">Status</TableHead>
            <TableHead className="text-right font-bold">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ads.map((ad) => (
            <TableRow key={ad.id} className="hover:bg-muted/20">
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-bold text-sm uppercase">{ad.eventTitle}</span>
                  <Badge variant="outline" className="w-fit text-[9px] font-black uppercase mt-1">{ad.type}</Badge>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-black text-sm text-primary">{formatCurrency(ad.budget || 0)}</span>
                  <span className="text-[9px] text-muted-foreground uppercase font-bold">{formatCurrency(ad.dailyBudget || 0)}/dia</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(ad.startDate).toLocaleDateString('pt-BR')} até {new Date(ad.endDate).toLocaleDateString('pt-BR')}</span>
                  <span className="text-[9px] font-black uppercase text-secondary">{ad.durationDays} dias de veiculação</span>
                </div>
              </TableCell>
              <TableCell className="text-center">
                <Badge className={cn(
                  "text-[9px] font-black uppercase",
                  ad.status === 'Ativo' ? "bg-green-500" :
                  ad.status === 'Pendente Pagamento' ? "bg-orange-500" :
                  ad.status === 'Pendente' ? "bg-blue-500" : "bg-muted"
                )}>
                  {ad.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  {ad.status !== 'Ativo' && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-green-600 hover:bg-green-50"
                      onClick={() => onUpdate(ad.id, "Ativo")}
                      title="Aprovar Anúncio"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </Button>
                  )}
                  {ad.status === 'Ativo' && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-orange-500 hover:bg-orange-50"
                      onClick={() => onUpdate(ad.id, "Pausado")}
                      title="Pausar Veiculação"
                    >
                      <Pause className="w-4 h-4" />
                    </Button>
                  )}
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                    onClick={() => onDelete(ad.id)}
                    title="Excluir"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}
