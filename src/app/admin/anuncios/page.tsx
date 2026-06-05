"use client"

import * as React from "react"
import { useFirestore, useCollection, useMemoFirebase, useAuth, useUser } from "@/firebase"
import { collection, query, orderBy, doc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore"
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
import { moderateAdAction } from "@/app/actions/ads"

export default function AdminAnunciosPage() {
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  const [search, setSearch] = React.useState("")
  const [actionLoading, setActionLoading] = React.useState<string | null>(null)

  const adsQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "ads"))
  }, [db])

  const { data: ads, loading } = useCollection<any>(adsQuery)

  const filteredAds = React.useMemo(() => {
    if (!ads) return []
    return [...ads].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
      .filter(ad => (ad.eventTitle?.toLowerCase() || "").includes(search.toLowerCase()))
  }, [ads, search])

  const handleUpdateStatus = async (adId: string, status: 'Ativo' | 'Rejeitado') => {
    if (!user) return
    setActionLoading(adId)
    try {
      const result = await moderateAdAction(adId, status, user.uid)
      if (result.success) {
        toast({ title: "Status atualizado!", description: `Campanha marcada como ${status}.` })
      } else {
        throw new Error(result.error)
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao moderar" })
    } finally {
      setActionLoading(null)
    }
  }

  const pendingAds = filteredAds.filter(a => a.status === 'Pendente')
  const activeAds = filteredAds.filter(a => a.status === 'Ativo')

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-secondary" /></div>

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
          <Megaphone className="w-8 h-8 text-secondary" />
          Moderação de Anúncios
        </h1>
        <p className="text-muted-foreground font-medium">Controle central de faturamento e aprovação de Viby Ads.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <Card className="border-none shadow-sm bg-white border-l-4 border-blue-500">
            <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase opacity-40">Aguardando Revisão</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-black">{pendingAds.length}</div></CardContent>
         </Card>
         <Card className="border-none shadow-sm bg-white border-l-4 border-green-500">
            <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase opacity-40">Campanhas Ativas</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-black text-green-600">{activeAds.length}</div></CardContent>
         </Card>
      </div>

      <Tabs defaultValue="pending" className="space-y-6">
        <TabsList className="bg-muted/50 p-1 rounded-xl h-12">
          <TabsTrigger value="pending" className="rounded-lg px-6 font-bold gap-2"><Clock className="w-4 h-4" /> Pendentes ({pendingAds.length})</TabsTrigger>
          <TabsTrigger value="active" className="rounded-lg px-6 font-bold gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> Ativas ({activeAds.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <Table className="bg-white rounded-2xl overflow-hidden shadow-sm">
             <TableHeader className="bg-muted/30">
                <TableRow>
                   <TableHead className="font-black uppercase text-[10px] p-6">Campanha</TableHead>
                   <TableHead className="font-black uppercase text-[10px]">Orçamento Total</TableHead>
                   <TableHead className="font-black uppercase text-[10px]">Diário</TableHead>
                   <TableHead className="text-right font-black uppercase text-[10px] p-6">Ações</TableHead>
                </TableRow>
             </TableHeader>
             <TableBody>
                {pendingAds.map(ad => (
                  <TableRow key={ad.id}>
                     <TableCell className="p-6 font-bold uppercase">{ad.eventTitle}</TableCell>
                     <TableCell className="font-black text-primary">{formatCurrency(ad.initialBudget)}</TableCell>
                     <TableCell className="font-bold text-muted-foreground">{formatCurrency(ad.dailyBudget)}</TableCell>
                     <TableCell className="p-6 text-right">
                        <div className="flex justify-end gap-2">
                           <Button size="sm" variant="outline" className="text-destructive border-destructive" onClick={() => handleUpdateStatus(ad.id, 'Rejeitado')} disabled={!!actionLoading}><XCircle className="w-3 h-3 mr-1" /> Rejeitar</Button>
                           <Button size="sm" className="bg-green-600 text-white" onClick={() => handleUpdateStatus(ad.id, 'Ativo')} disabled={!!actionLoading}><CheckCircle2 className="w-3 h-3 mr-1" /> Aprovar</Button>
                        </div>
                     </TableCell>
                  </TableRow>
                ))}
             </TableBody>
          </Table>
        </TabsContent>
        <TabsContent value="active">
           <Table className="bg-white rounded-2xl overflow-hidden shadow-sm">
              <TableHeader className="bg-muted/30">
                 <TableRow>
                    <TableHead className="font-black uppercase text-[10px] p-6">Campanha</TableHead>
                    <TableHead className="font-black uppercase text-[10px]">Consumido</TableHead>
                    <TableHead className="font-black uppercase text-[10px]">Restante</TableHead>
                    <TableHead className="text-right font-black uppercase text-[10px] p-6">Status</TableHead>
                 </TableRow>
              </TableHeader>
              <TableBody>
                 {activeAds.map(ad => (
                   <TableRow key={ad.id}>
                      <TableCell className="p-6 font-bold uppercase">{ad.eventTitle}</TableCell>
                      <TableCell className="font-bold text-muted-foreground">{formatCurrency(ad.initialBudget - ad.remainingBudget)}</TableCell>
                      <TableCell className="font-black text-green-600">{formatCurrency(ad.remainingBudget)}</TableCell>
                      <TableCell className="p-6 text-right"><Badge className="bg-green-500 text-white font-black uppercase text-[8px]">ATIVO</Badge></TableCell>
                   </TableRow>
                 ))}
              </TableBody>
           </Table>
        </TabsContent>
      </Tabs>
    </div>
  )
}
