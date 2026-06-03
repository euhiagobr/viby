'use client';

import * as React from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit, updateDoc, doc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  ShieldAlert, 
  Loader2, 
  Search, 
  Filter, 
  ChevronRight, 
  User, 
  Globe, 
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Terminal,
  FileText,
  MousePointer2,
  Trash2,
  Inbox
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

export default function AdminLogsPage() {
  const db = useFirestore();
  const [search, setSearch] = React.useState("");
  const [selectedLog, setSelectedLog] = React.useState<any>(null);
  const [isUpdating, setIsUpdating] = React.useState<string | null>(null);

  const logsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'system_logs'), orderBy('createdAt', 'desc'), limit(100));
  }, [db]);

  const { data: logs, loading } = useCollection<any>(logsQuery);

  const filteredLogs = React.useMemo(() => {
    if (!logs) return [];
    return logs.filter(log => 
      log.code?.toLowerCase().includes(search.toLowerCase()) ||
      log.message?.toLowerCase().includes(search.toLowerCase()) ||
      log.userEmail?.toLowerCase().includes(search.toLowerCase())
    );
  }, [logs, search]);

  const handleUpdateStatus = async (logId: string, status: string) => {
    if (!db) return;
    setIsUpdating(logId);
    try {
      await updateDoc(doc(db, 'system_logs', logId), { 
        status, 
        resolved: status === 'resolvido',
        updatedAt: new Date()
      });
      toast({ title: "Status atualizado!" });
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao atualizar" });
    } finally {
      setIsUpdating(null);
    }
  };

  const getSeverityColor = (sev: string) => {
    switch (sev) {
      case 'critical': return 'bg-red-600 text-white';
      case 'error': return 'bg-orange-50 text-white';
      case 'warning': return 'bg-yellow-500 text-black';
      default: return 'bg-blue-500 text-white';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
          <Terminal className="w-8 h-8 text-secondary" />
          ErrorManager Console
        </h1>
        <p className="text-muted-foreground font-medium">Monitoramento de saúde do sistema e trilha de erros técnica.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard title="Erros Hoje" value={logs?.filter(l => l.severity === 'error' || l.severity === 'critical').length || 0} icon={AlertTriangle} color="red" />
        <StatCard title="Críticos" value={logs?.filter(l => l.severity === 'critical').length || 0} icon={XCircle} color="red" />
        <StatCard title="Pendentes" value={logs?.filter(l => l.status === 'pendente').length || 0} icon={Clock} color="orange" />
        <StatCard title="Resolvidos" value={logs?.filter(l => l.status === 'resolvido').length || 0} icon={CheckCircle2} color="green" />
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por código, mensagem ou e-mail..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-12 rounded-xl"
          />
        </div>
      </div>

      <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-20 flex justify-center"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>
          ) : filteredLogs.length > 0 ? (
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest p-6">Código / Data</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest">Severidade / Tipo</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest">Mensagem</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest">Usuário</TableHead>
                  <TableHead className="text-right font-black uppercase text-[10px] tracking-widest p-6">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => (
                  <TableRow key={log.id} className={cn("hover:bg-muted/10 transition-colors", log.severity === 'critical' && "bg-red-50/10")}>
                    <TableCell className="p-6">
                      <div className="flex flex-col">
                        <span className="font-black text-sm text-primary">{log.code}</span>
                        <span className="text-[9px] font-bold text-muted-foreground uppercase">
                          {log.createdAt?.toDate ? log.createdAt.toDate().toLocaleString('pt-BR') : 'agora'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge className={cn("text-[8px] font-black uppercase h-4 w-fit", getSeverityColor(log.severity))}>
                          {log.severity}
                        </Badge>
                        <span className="text-[9px] font-bold text-muted-foreground uppercase">{log.type}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[300px]">
                      <p className="text-xs font-medium truncate" title={log.message}>{log.message}</p>
                      <p className="text-[9px] text-muted-foreground truncate">{log.pathname}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold truncate max-w-[150px]">{log.userEmail || 'Anônimo'}</span>
                        <span className="text-[9px] text-muted-foreground uppercase">{log.device} • {log.os}</span>
                      </div>
                    </TableCell>
                    <TableCell className="p-6 text-right">
                      <Button variant="ghost" size="sm" onClick={() => setSelectedLog(log)} className="h-8 rounded-lg gap-2 font-bold text-[9px] uppercase">
                        <MousePointer2 className="w-3 h-3" /> Detalhes
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="py-24 text-center">
              <Inbox className="w-12 h-12 text-muted-foreground mx-auto opacity-10 mb-4" />
              <p className="text-muted-foreground font-bold italic">Nenhum log registrado.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* DIALOG DE DETALHES DO LOG */}
      <Dialog open={!!selectedLog} onOpenChange={(o) => !o && setSelectedLog(null)}>
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 overflow-hidden rounded-[2.5rem]">
          <DialogHeader className="p-8 border-b bg-muted/30">
             <div className="flex justify-between items-start">
                <div className="space-y-1">
                   <div className="flex items-center gap-2">
                      <Badge className={cn("uppercase text-[10px] font-black", getSeverityColor(selectedLog?.severity))}>{selectedLog?.severity}</Badge>
                      <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Protocolo {selectedLog?.code}</span>
                   </div>
                   <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-primary break-all pr-8">
                     {selectedLog?.message}
                   </DialogTitle>
                </div>
                <div className="flex gap-2">
                   <Select value={selectedLog?.status} onValueChange={(v) => handleUpdateStatus(selectedLog.id, v)}>
                      <SelectTrigger className="w-32 h-9 rounded-xl text-[10px] font-black uppercase">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="pendente">Pendente</SelectItem>
                        <SelectItem value="em_analise">Em Análise</SelectItem>
                        <SelectItem value="resolvido">Resolvido</SelectItem>
                        <SelectItem value="ignorado">Ignorado</SelectItem>
                      </SelectContent>
                   </Select>
                </div>
             </div>
          </DialogHeader>

          <ScrollArea className="flex-1 p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-10">
               <div className="md:col-span-2 space-y-8">
                  <section className="space-y-3">
                     <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2"><Terminal className="w-4 h-4" /> Stack Trace</h3>
                     <div className="p-4 bg-primary text-white rounded-2xl font-mono text-[10px] overflow-x-auto whitespace-pre leading-relaxed shadow-inner">
                        {selectedLog?.stack || 'Nenhum stack trace capturado.'}
                     </div>
                  </section>

                  {selectedLog?.metadata && (
                    <section className="space-y-3">
                       <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2"><FileText className="w-4 h-4" /> Metadados / Contexto</h3>
                       <div className="p-4 bg-muted/50 rounded-2xl border border-dashed font-mono text-[10px]">
                          {JSON.stringify(selectedLog.metadata, null, 2)}
                       </div>
                    </section>
                  )}
               </div>

               <div className="space-y-8">
                  <Card className="border-none bg-muted/20 rounded-2xl p-6 space-y-4">
                     <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Ambiente</h4>
                     <div className="space-y-3">
                        <EnvItem label="Pathname" value={selectedLog?.pathname} />
                        <EnvItem label="Tipo" value={selectedLog?.type} />
                        <EnvItem label="Browser" value={selectedLog?.browser} />
                        <EnvItem label="OS" value={selectedLog?.os} />
                        <EnvItem label="Device" value={selectedLog?.device} />
                     </div>
                  </Card>

                  <Card className="border-none bg-muted/20 rounded-2xl p-6 space-y-4">
                     <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Usuário Afetado</h4>
                     <div className="space-y-3">
                        <div className="flex items-center gap-2">
                           <User className="w-3.5 h-3.5 opacity-40" />
                           <span className="text-[10px] font-bold truncate">{selectedLog?.userEmail || 'Anônimo'}</span>
                        </div>
                        <p className="text-[8px] font-mono opacity-40 break-all">{selectedLog?.userId || 'N/A'}</p>
                     </div>
                  </Card>
               </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color }: any) {
  const colors: any = { red: "text-red-500 bg-red-50", orange: "text-orange-500 bg-orange-50", green: "text-green-600 bg-green-50" };
  return (
    <Card className="border-none shadow-sm rounded-3xl bg-white">
       <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
             <div className={cn("p-2.5 rounded-2xl", colors[color])}><Icon className="w-5 h-5" /></div>
          </div>
          <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">{title}</p>
          <p className="text-2xl font-black text-primary">{value}</p>
       </CardContent>
    </Card>
  );
}

function EnvItem({ label, value }: { label: string, value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
       <span className="text-[8px] font-black uppercase opacity-40">{label}</span>
       <span className="text-[10px] font-bold truncate text-primary">{value || 'N/A'}</span>
    </div>
  );
}
