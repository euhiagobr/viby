"use client"

import * as React from "react"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy, doc, updateDoc, deleteDoc } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  ShieldAlert, 
  Loader2, 
  Search, 
  Trash2, 
  CheckCircle2, 
  Flag,
  ExternalLink,
  Paperclip,
  Clock,
  User,
  Building2,
  Inbox
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"

export default function AdminDenunciasPage() {
  const db = useFirestore()
  const [search, setSearch] = React.useState("")
  const [actionLoadingId, setActionLoadingId] = React.useState<string | null>(null)

  const reportsQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "reports"), orderBy("timestamp", "desc"))
  }, [db])

  const { data: reports, loading } = useCollection<any>(reportsQuery)

  const filteredReports = React.useMemo(() => {
    if (!reports) return []
    return reports.filter(r => 
      (r.targetName?.toLowerCase() || "").includes(search.toLowerCase()) ||
      (r.reporterName?.toLowerCase() || "").includes(search.toLowerCase()) ||
      (r.reason?.toLowerCase() || "").includes(search.toLowerCase())
    )
  }, [reports, search])

  const handleUpdateStatus = async (report: any, status: string) => {
    if (!db || actionLoadingId) return
    
    setActionLoadingId(report.id)
    try {
      // 1. Atualiza o ticket de denúncia
      await updateDoc(doc(db, "reports", report.id), { status })
      
      // 2. Se a denúncia for aceita (Analisada), bloqueia o alvo
      if (status === 'Analisada') {
        const collectionName = report.targetCollection || (report.type === 'profile' ? 'users' : 'events');
        await updateDoc(doc(db, collectionName, report.targetId), {
          status: 'Bloqueado',
          blockedAt: new Date().toISOString(),
          blockedReason: `Denúncia aceita: ${report.reason}`
        });
        toast({ title: "Denúncia aceita", description: "O conteúdo alvo foi bloqueado e saiu do ar." })
      } else {
        toast({ title: "Status atualizado", description: `Denúncia marcada como ${status}.` })
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao atualizar" })
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleDeleteReport = async (id: string) => {
    if (!db) return
    if (!confirm("Excluir registro de denúncia?")) return
    try {
      await deleteDoc(doc(db, "reports", id))
      toast({ title: "Denúncia removida" })
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao remover" })
    }
  }

  const formatTimestamp = (ts: any) => {
    if (!ts) return "---";
    try {
      const d = ts.toDate ? ts.toDate() : new Date(ts);
      return d.toLocaleString('pt-BR');
    } catch (e) { return "---"; }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
          <ShieldAlert className="w-8 h-8 text-destructive" />
          Central de Moderação
        </h1>
        <p className="text-muted-foreground font-medium">Analise denúncias de usuários e aplique punições se necessário.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <Card className="border-none shadow-sm bg-white border-l-4 border-orange-500">
            <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Denúncias Pendentes</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-black text-orange-600">{reports?.filter((r:any) => r.status === 'Pendente').length || 0}</div></CardContent>
         </Card>
         <Card className="border-none shadow-sm bg-white border-l-4 border-green-500">
            <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Casos Resolvidos</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-black text-green-600">{reports?.filter((r:any) => r.status === 'Analisada').length || 0}</div></CardContent>
         </Card>
         <Card className="border-none shadow-sm bg-destructive text-white">
            <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase opacity-60 tracking-widest">Perfis Bloqueados</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-black">{reports?.filter((r:any) => r.status === 'Analisada' && r.type === 'profile').length || 0}</div></CardContent>
         </Card>
      </div>

      <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
        <CardHeader className="bg-white border-b p-8 pb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-destructive" />
                Fila de Denúncias
              </CardTitle>
              <CardDescription>Gerencie {filteredReports.length} relatos de irregularidades.</CardDescription>
            </div>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar por alvo, relator ou motivo..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 rounded-xl h-11"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-secondary" /></div>
          ) : filteredReports.length > 0 ? (
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest p-6">Tipo / Alvo</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest">Motivo / Descrição</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest">Relator</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest">Data</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest text-center">Status</TableHead>
                  <TableHead className="text-right font-black uppercase text-[10px] tracking-widest p-6">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReports.map((report) => (
                  <TableRow key={report.id} className="hover:bg-muted/10 transition-colors">
                    <TableCell className="p-6">
                      <div className="flex flex-col gap-1">
                        <Badge variant="outline" className={cn(
                          "w-fit text-[9px] font-black uppercase h-5",
                          report.type === 'profile' ? "border-purple-200 text-purple-600 bg-purple-50" : "border-blue-200 text-blue-600 bg-blue-50"
                        )}>
                          {report.targetCollection === 'organizations' ? <Building2 className="w-2.5 h-2.5 mr-1" /> : <User className="w-2.5 h-2.5 mr-1" />}
                          {report.targetCollection === 'organizations' ? 'Organizador' : (report.type === 'profile' ? 'Usuário' : 'Evento')}
                        </Badge>
                        <span className="font-black text-sm uppercase italic text-primary">{report.targetName || report.eventTitle || "---"}</span>
                        <span className="text-[9px] text-muted-foreground font-mono">{report.targetId}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 max-w-[250px]">
                        <span className="font-black text-[10px] text-destructive uppercase tracking-tight">{report.reason}</span>
                        <p className="text-[11px] text-muted-foreground line-clamp-2 italic">"{report.description || "Sem descrição detalhada."}"</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold">{report.reporterName}</span>
                        <span className="text-[10px] text-muted-foreground uppercase font-black">ID: {report.reporterId?.slice(0,8)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {formatTimestamp(report.timestamp)}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={cn(
                        "text-[9px] font-black uppercase px-2.5 h-6",
                        report.status === 'Pendente' ? "bg-orange-500 text-white" :
                        report.status === 'Analisada' ? "bg-green-600 text-white" : "bg-muted text-muted-foreground"
                      )}>
                        {report.status || "Pendente"}
                      </Badge>
                    </TableCell>
                    <TableCell className="p-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {report.attachments?.length > 0 && (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm" className="h-8 rounded-lg gap-1.5 font-black text-[9px] uppercase border-secondary/20 text-secondary">
                                <Paperclip className="w-3 h-3" /> Ver Provas ({report.attachments.length})
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl rounded-[2.5rem]">
                               <DialogHeader>
                                  <DialogTitle className="text-xl font-black italic uppercase tracking-tighter">Evidências da Denúncia</DialogTitle>
                                  <DialogDescription>Arquivos anexados pelo relator {report.reporterName}.</DialogDescription>
                               </DialogHeader>
                               <ScrollArea className="max-h-[60vh] mt-4">
                                  <div className="grid grid-cols-2 gap-4 p-1">
                                     {report.attachments.map((url: string, i: number) => (
                                       <div key={i} className="group relative aspect-square rounded-2xl bg-muted border overflow-hidden">
                                          {url.includes('.pdf') ? (
                                            <div className="flex flex-col items-center justify-center h-full gap-2">
                                               <Paperclip className="w-8 h-8 text-primary opacity-20" />
                                               <span className="text-[10px] font-black uppercase">Documento PDF</span>
                                            </div>
                                          ) : (
                                            <img src={url} className="w-full h-full object-cover transition-transform group-hover:scale-110" alt="Prova" />
                                          )}
                                          <a href={url} target="_blank" className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                             <Button size="sm" variant="secondary" className="font-bold text-[9px] uppercase rounded-full h-8">Abrir Original</Button>
                                          </a>
                                       </div>
                                     ))}
                                  </div>
                               </ScrollArea>
                            </DialogContent>
                          </Dialog>
                        )}

                        {report.status === 'Pendente' && (
                          <>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-green-600 hover:bg-green-50"
                              onClick={() => handleUpdateStatus(report, "Analisada")}
                              disabled={actionLoadingId === report.id}
                              title="Aceitar e Bloquear Alvo"
                            >
                              {actionLoadingId === report.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-muted-foreground hover:bg-muted"
                              onClick={() => handleUpdateStatus(report, "Arquivada")}
                              disabled={actionLoadingId === report.id}
                              title="Arquivar (Ignorar)"
                            >
                              <Flag className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                        
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteReport(report.id)}
                          title="Excluir Registro"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="py-32 text-center">
              <Inbox className="w-16 h-16 mx-auto text-muted-foreground mb-4 opacity-10" />
              <p className="text-muted-foreground font-black uppercase tracking-[0.2em] text-xs">Nenhuma denúncia na fila.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
