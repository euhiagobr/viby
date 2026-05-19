
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
  Calendar, 
  User, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle,
  ExternalLink,
  Flag,
  CalendarDays
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

export default function AdminDenunciasPage() {
  const db = useFirestore()
  const [search, setSearch] = React.useState("")

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

  const handleUpdateStatus = async (id: string, status: string) => {
    if (!db) return
    try {
      await updateDoc(doc(db, "reports", id), { status })
      toast({ title: "Status atualizado", description: `Denúncia marcada como ${status}.` })
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao atualizar" })
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
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Moderação de Denúncias</h1>
        <p className="text-muted-foreground">Analise relatos de irregularidades em eventos e perfis.</p>
      </div>

      <Card className="border-none shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="bg-white border-b pb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-destructive" />
                Fila de Denúncias
              </CardTitle>
              <CardDescription>Total de {filteredReports.length} relatos encontrados.</CardDescription>
            </div>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar por alvo, relator ou motivo..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 rounded-xl"
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
                  <TableHead className="font-bold">Tipo / Alvo</TableHead>
                  <TableHead className="font-bold">Motivo / Descrição</TableHead>
                  <TableHead className="font-bold">Relator</TableHead>
                  <TableHead className="font-bold">Data</TableHead>
                  <TableHead className="font-bold text-center">Status</TableHead>
                  <TableHead className="text-right font-bold">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReports.map((report) => (
                  <TableRow key={report.id} className="hover:bg-muted/20">
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant="outline" className={cn(
                          "w-fit text-[9px] font-black uppercase",
                          report.type === 'profile' ? "border-purple-200 text-purple-600 bg-purple-50" : "border-blue-200 text-blue-600 bg-blue-50"
                        )}>
                          {report.type === 'profile' ? 'Perfil' : 'Evento'}
                        </Badge>
                        <span className="font-bold text-sm">{report.targetName || report.eventTitle || "---"}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">{report.targetId || report.eventId}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 max-w-[300px]">
                        <span className="font-bold text-xs text-destructive uppercase tracking-tight">{report.reason}</span>
                        <p className="text-[11px] text-muted-foreground line-clamp-2">{report.description || "Sem descrição detalhada."}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold">{report.reporterName}</span>
                        <span className="text-[10px] text-muted-foreground">ID: {report.reporterId?.slice(0,8)}...</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-medium">{formatTimestamp(report.timestamp)}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={cn(
                        "text-[10px] font-bold uppercase",
                        report.status === 'Pendente' ? "bg-orange-500" :
                        report.status === 'Analisada' ? "bg-green-500" : "bg-muted"
                      )}>
                        {report.status || "Pendente"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {report.status !== 'Analisada' && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-green-600 hover:bg-green-50"
                            onClick={() => handleUpdateStatus(report.id, "Analisada")}
                            title="Marcar como Analisada"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </Button>
                        )}
                        {report.status !== 'Arquivada' && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-muted-foreground hover:bg-muted"
                            onClick={() => handleUpdateStatus(report.id, "Arquivada")}
                            title="Arquivar"
                          >
                            <Flag className="w-4 h-4" />
                          </Button>
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
            <div className="p-20 text-center">
              <ShieldAlert className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-20" />
              <p className="text-muted-foreground font-medium italic">Nenhuma denúncia registrada no sistema.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
