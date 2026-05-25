
'use client';

import * as React from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, updateDoc, serverTimestamp, getDocs, where, writeBatch } from 'firebase/firestore';
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
  SendHorizontal, 
  Loader2, 
  CheckCircle2, 
  Clock, 
  Building2, 
  Search, 
  ShieldCheck, 
  AlertTriangle,
  FileText,
  DollarSign,
  ArrowRight,
  ChevronRight,
  Filter,
  Lock,
  Wallet
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/financial-utils';
import { cn } from "@/lib/utils";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";

export default function AdminPayoutsERP() {
  const db = useFirestore();
  const [search, setSearch] = React.useState("");
  const [selectedRequest, setSelectedRequest] = React.useState<any>(null);
  const [actionLoading, setActionLoading] = React.useState(false);

  const payoutsQuery = useMemoFirebase(() => db ? query(collection(db, "payout_requests"), orderBy("requestedAt", "desc")) : null, [db]);
  const { data: payouts, loading } = useCollection<any>(payoutsQuery);

  const filteredPayouts = React.useMemo(() => {
    if (!payouts) return [];
    return payouts.filter(p => 
      p.organizationName?.toLowerCase().includes(search.toLowerCase()) || 
      p.id?.includes(search)
    );
  }, [payouts, search]);

  const handleUpdateStatus = async (id: string, status: string, notes?: string) => {
    if (!db || actionLoading) return;
    setActionLoading(true);
    try {
      await updateDoc(doc(db, "payout_requests", id), {
        status,
        internalNotes: notes || "",
        processedAt: status === 'Concluído' ? serverTimestamp() : null,
        updatedAt: serverTimestamp()
      });
      toast({ title: `Repasse ${status.toLowerCase()}!` });
      setSelectedRequest(null);
    } catch (e) {
      toast({ variant: "destructive", title: "Erro na operação" });
    } finally {
      setActionLoading(false);
    }
  };

  const stats = React.useMemo(() => {
    if (!payouts) return { pending: 0, completed: 0, blocked: 0 };
    return payouts.reduce((acc, p) => {
      if (p.status === 'Pendente') acc.pending += p.amount;
      if (p.status === 'Concluído') acc.completed += p.amount;
      if (p.status === 'Bloqueado') acc.blocked += p.amount;
      return acc;
    }, { pending: 0, completed: 0, blocked: 0 });
  }, [payouts]);

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
            <SendHorizontal className="w-8 h-8 text-secondary" /> Gestão de Repasses
          </h1>
          <p className="text-muted-foreground font-medium">Aprovação manual e automação de pagamentos a produtores.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <Card className="border-none shadow-sm bg-white border-l-4 border-orange-500">
            <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Aguardando Pagamento</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-black text-orange-600">{formatCurrency(stats.pending)}</div></CardContent>
         </Card>
         <Card className="border-none shadow-sm bg-white border-l-4 border-green-500">
            <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Total Pago (Efivado)</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-black text-green-600">{formatCurrency(stats.completed)}</div></CardContent>
         </Card>
         <Card className="border-none shadow-sm bg-white border-l-4 border-destructive">
            <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Valores Bloqueados</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-black text-destructive">{formatCurrency(stats.blocked)}</div></CardContent>
         </Card>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Buscar por marca ou protocolo..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-12 rounded-xl"
        />
      </div>

      <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="font-black uppercase text-[9px] tracking-widest p-6">Protocolo / Data</TableHead>
              <TableHead className="font-black uppercase text-[9px] tracking-widest">Organização</TableHead>
              <TableHead className="font-black uppercase text-[9px] tracking-widest">Banco / Favorecido</TableHead>
              <TableHead className="font-black uppercase text-[9px] tracking-widest text-right">Valor</TableHead>
              <TableHead className="font-black uppercase text-[9px] tracking-widest text-center">Status</TableHead>
              <TableHead className="text-right font-black uppercase text-[9px] tracking-widest p-6">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-secondary" /></TableCell></TableRow>
            ) : filteredPayouts.length > 0 ? (
              filteredPayouts.map((p) => (
                <TableRow key={p.id} className="hover:bg-muted/10 transition-colors">
                  <TableCell className="p-6">
                    <div className="flex flex-col">
                       <span className="text-[10px] font-bold text-muted-foreground">#{p.id.slice(-8)}</span>
                       <span className="text-[10px] font-bold">{p.requestedAt?.toDate ? p.requestedAt.toDate().toLocaleDateString('pt-BR') : new Date(p.requestedAt).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                       <Building2 className="w-4 h-4 text-secondary" />
                       <span className="font-black text-sm uppercase italic text-primary">{p.organizationName}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col text-[10px] font-medium text-muted-foreground">
                       <span className="font-black text-primary uppercase text-[9px]">{p.bankDetails?.bank}</span>
                       <span>PIX: {p.bankDetails?.pixKey}</span>
                       <span className="truncate max-w-[150px]">{p.bankDetails?.accountName}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-black text-sm text-primary">
                    {formatCurrency(p.amount)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className={cn(
                      "text-[8px] font-black uppercase h-5",
                      p.status === 'Concluído' ? "bg-green-500" : 
                      p.status === 'Bloqueado' ? "bg-destructive" : "bg-orange-500"
                    )}>
                      {p.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="p-6 text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setSelectedRequest(p)}>
                       <ChevronRight className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={6} className="py-32 text-center opacity-30 italic">Nenhuma solicitação de repasse.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* DIALOG DE APROVAÇÃO/AUDITORIA */}
      <Dialog open={!!selectedRequest} onOpenChange={(o) => !o && setSelectedRequest(null)}>
        <DialogContent className="max-w-md rounded-[2.5rem]">
           <DialogHeader>
              <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">Analise de Repasse</DialogTitle>
              <DialogDescription>Protocolo #{selectedRequest?.id.slice(-8)}</DialogDescription>
           </DialogHeader>
           <div className="space-y-6 py-4">
              <div className="p-6 bg-muted/30 rounded-3xl border border-dashed text-center">
                 <p className="text-[10px] font-black uppercase opacity-40 mb-1">Valor do Pagamento</p>
                 <p className="text-3xl font-black text-primary">{formatCurrency(selectedRequest?.amount || 0)}</p>
              </div>

              <div className="space-y-3">
                 <div className="flex items-center gap-2 text-xs font-black uppercase text-secondary"><ShieldCheck className="w-4 h-4" /> Verificação Cadastral</div>
                 <div className="grid grid-cols-2 gap-4 p-4 bg-muted/20 rounded-2xl border text-[10px] font-bold">
                    <div className="space-y-1"><span>Banco Destino:</span> <p className="text-primary">{selectedRequest?.bankDetails?.bank}</p></div>
                    <div className="space-y-1"><span>Status Titular:</span> <p className="text-green-600">Verificado</p></div>
                 </div>
              </div>

              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase opacity-40">Observações Internas</Label>
                 <Input className="rounded-xl h-12" placeholder="Motivo de bloqueio ou nota fiscal..." />
              </div>
           </div>
           <DialogFooter className="grid grid-cols-2 gap-3">
              {selectedRequest?.status === 'Pendente' && (
                <>
                  <Button variant="destructive" className="rounded-xl font-black uppercase text-[10px] h-12" onClick={() => handleUpdateStatus(selectedRequest.id, 'Bloqueado')}>Bloquear Repasse</Button>
                  <Button className="bg-green-600 text-white rounded-xl font-black uppercase text-[10px] h-12 shadow-lg" onClick={() => handleUpdateStatus(selectedRequest.id, 'Concluído')}>Confirmar Pagamento</Button>
                </>
              )}
              {selectedRequest?.status === 'Bloqueado' && (
                <Button className="col-span-2 bg-secondary text-white rounded-xl font-black uppercase text-[10px] h-12" onClick={() => handleUpdateStatus(selectedRequest.id, 'Pendente')}>Desbloquear</Button>
              )}
              {selectedRequest?.status === 'Concluído' && (
                <Button variant="outline" className="col-span-2 rounded-xl font-black uppercase text-[10px] h-12" disabled><CheckCircle2 className="w-4 h-4 mr-2" /> Pagamento Efivado</Button>
              )}
           </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
