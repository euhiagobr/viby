"use client"

import * as React from "react"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy, where, limit } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  ShieldAlert, 
  Loader2, 
  Search, 
  CheckCircle2, 
  Clock, 
  Flag,
  Trash2,
  EyeOff,
  History,
  Inbox,
  AlertTriangle,
  Info
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
import { processReportAction } from "@/app/actions/curation-admin"
import { useAdminPermissions } from "@/hooks/use-admin-permissions"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"

export default function AdminDenunciasPage() {
  const db = useFirestore()
  const { adminProfile } = useAdminPermissions()
  const [search, setSearch] = React.useState("")
  const [selectedReport, setSelectedReport] = React.useState<any>(null)
  const [isProcessing, setIsProcessing] = React.useState(false)
  const [adminNotes, setAdminNotes] = React.useState("")

  const reportsQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "reports"), orderBy("timestamp", "desc"))
  }, [db])

  const { data: reports, loading } = useCollection<any>(reportsQuery)

  const filtered = React.useMemo(() => {
    if (!reports) return []
    return reports.filter(r => 
      (r.targetName || r.eventTitle || "").toLowerCase().includes(search.toLowerCase()) ||
      (r.reason || "").toLowerCase().includes(search.toLowerCase())
    )
  }, [reports, search])

  const handleAction = async (action: 'arquivado' | 'em_analise' | 'ocultado' | 'excluido') => {
    if (!adminProfile || !selectedReport) return;
    setIsProcessing(true);
    try {
      const res = await processReportAction({
        reportId: selectedReport.id,
        action,
        reason: adminNotes || `Ação de moderação: ${action}`,
        adminId: adminProfile.uid,
        adminName: adminProfile.nome
      });

      if (res.success) {
        toast({ title: "Moderação aplicada!" });
        setSelectedReport(null);
        setAdminNotes("");
      } else throw new Error(res.error);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro na moderação", description: e.message });
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) return <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-secondary" /></div>

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
          <ShieldAlert className="w-8 h-8 text-destructive" /> Central de Denúncias
        </h1>
        <p className="text-muted-foreground font-medium">Fiscalize irregularidades e mantenha a integridade da rede Viby.</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Filtrar por evento ou motivo..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 h-12 rounded-xl" />
      </div>

      <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="font-black uppercase text-[10px] p-6">Alvo / Data</TableHead>
              <TableHead className="font-black uppercase text-[10px]">Motivo Principal</TableHead>
              <TableHead className="font-black uppercase text-[10px] text-center">Status</TableHead>
              <TableHead className="text-right font-black uppercase text-[10px] p-6">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length > 0 ? filtered.map(report => (
              <TableRow key={report.id} className="hover:bg-muted/10 transition-colors">
                <TableCell className="p-6">
                   <div className="flex flex-col">
                      <span className="font-black text-sm uppercase italic text-primary">{report.targetName || report.eventTitle || "---"}</span>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">{new Date(report.timestamp?.seconds * 1000).toLocaleString('pt-BR')}</span>
                   </div>
                </TableCell>
                <TableCell><span className="text-xs font-bold text-destructive uppercase">{report.reason}</span></TableCell>
                <TableCell className="text-center">
                   <Badge className={cn(
                     "text-[8px] font-black uppercase h-5",
                     report.status === 'Pendente' ? "bg-orange-500" : "bg-green-600"
                   )}>{report.status}</Badge>
                </TableCell>
                <TableCell className="p-6 text-right">
                   <Button variant="ghost" size="sm" onClick={() => setSelectedReport(report)} className="rounded-lg font-black uppercase text-[9px]">Analisar</Button>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow><TableCell colSpan={4} className="py-24 text-center opacity-30 italic"><Inbox className="w-12 h-12 mx-auto mb-4" />Limpo por enquanto.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!selectedReport} onOpenChange={(o) => !o && setSelectedReport(null)}>
        <DialogContent className="max-w-2xl rounded-[2.5rem] p-0 overflow-hidden">
           <DialogHeader className="p-8 border-b bg-muted/30">
              <div className="flex items-center gap-3">
                 <ShieldAlert className="w-6 h-6 text-destructive" />
                 <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">Moderar Denúncia</DialogTitle>
              </div>
           </DialogHeader>
           <ScrollArea className="max-h-[60vh] p-8">
              <div className="space-y-6">
                 <div className="grid grid-cols-2 gap-8 p-6 bg-muted/20 rounded-3xl border border-dashed">
                    <div><p className="text-[8px] font-black uppercase opacity-40">Evento Alvo</p><p className="font-bold text-sm text-primary uppercase">{selectedReport?.eventTitle}</p></div>
                    <div><p className="text-[8px] font-black uppercase opacity-40">Relator</p><p className="font-bold text-sm text-primary">{selectedReport?.reporterName}</p></div>
                 </div>
                 <div className="space-y-1">
                    <p className="text-[9px] font-black uppercase opacity-40">Relato do Problema</p>
                    <p className="text-sm font-medium leading-relaxed italic">"{selectedReport?.reason}: {selectedReport?.description}"</p>
                 </div>
                 <Separator className="border-dashed" />
                 <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase opacity-60">Ação de Controle</Label>
                    <div className="grid grid-cols-2 gap-2">
                       <Button variant="outline" size="sm" className="h-10 text-[9px] font-black uppercase gap-1.5" onClick={() => handleAction('arquivado')}><CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> Arquivar</Button>
                       <Button variant="outline" size="sm" className="h-10 text-[9px] font-black uppercase gap-1.5" onClick={() => handleAction('em_analise')}><Clock className="w-3.5 h-3.5 text-blue-600" /> Revisar</Button>
                       <Button variant="outline" size="sm" className="h-10 text-[9px] font-black uppercase gap-1.5" onClick={() => handleAction('ocultado')}><EyeOff className="w-3.5 h-3.5 text-orange-600" /> Ocultar</Button>
                       <Button variant="destructive" size="sm" className="h-10 text-[9px] font-black uppercase gap-1.5" onClick={() => handleAction('excluido')}><Trash2 className="w-3.5 h-3.5" /> Excluir</Button>
                    </div>
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">Observações Admin</Label>
                    <Input value={adminNotes} onChange={e => setAdminNotes(e.target.value)} className="rounded-xl h-11" placeholder="Explique a decisão..." />
                 </div>
              </div>
           </ScrollArea>
           <div className="p-4 bg-orange-50 border-t flex items-center justify-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-600" />
              <p className="text-[8px] font-black uppercase text-orange-800">A exclusão de evento é irreversível e move o card para a lixeira administrativa.</p>
           </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
