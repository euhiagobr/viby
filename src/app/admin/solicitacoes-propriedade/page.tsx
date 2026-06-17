'use client';

import * as React from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, where, doc, getDoc } from 'firebase/firestore';
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
  UserCheck, 
  Loader2, 
  Search, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ExternalLink,
  Info,
  ShieldCheck,
  Building2,
  User,
  History,
  Inbox,
  FileText
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { toast } from '@/hooks/use-toast';
import { cn } from "@/lib/utils";
import { processOwnershipAction } from '@/app/actions/curation-admin';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function AdminSolicitacoesPropriedade() {
  const db = useFirestore();
  const { adminProfile } = useAdminPermissions();
  const [search, setSearch] = React.useState("");
  const [selectedReq, setSelectedReq] = React.useState<any>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [adminNotes, setAdminNotes] = React.useState("");

  const requestsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'admin', 'solicitacoes_propriedade', 'pedidos'), orderBy('createdAt', 'desc'));
  }, [db]);

  const { data: requests, loading } = useCollection<any>(requestsQuery);

  const filtered = React.useMemo(() => {
    if (!requests) return [];
    return requests.filter(r => 
      r.eventTitle?.toLowerCase().includes(search.toLowerCase()) ||
      r.id?.includes(search)
    );
  }, [requests, search]);

  const handleAction = async (status: 'aprovado' | 'rejeitado') => {
    if (!adminProfile || !selectedReq) return;
    setIsProcessing(true);
    try {
      const res = await processOwnershipAction({
        requestId: selectedReq.id,
        status,
        reason: adminNotes || (status === 'aprovado' ? "Propriedade transferida após análise." : "Solicitação não atende aos requisitos."),
        adminId: adminProfile.uid,
        adminName: adminProfile.nome
      });

      if (res.success) {
        toast({ title: `Solicitação ${status}!` });
        setSelectedReq(null);
        setAdminNotes("");
      } else throw new Error(res.error);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro na operação", description: e.message });
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) return <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-secondary" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
          <UserCheck className="w-8 h-8 text-secondary" /> Solicitações de Propriedade
        </h1>
        <p className="text-muted-foreground font-medium">Transfira eventos curados para organizadores e marcas reais.</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por título do evento..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 h-12 rounded-xl" />
      </div>

      <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="font-black uppercase text-[10px] p-6">Evento / Data</TableHead>
              <TableHead className="font-black uppercase text-[10px]">Marca Solicitante</TableHead>
              <TableHead className="font-black uppercase text-[10px] text-center">Status</TableHead>
              <TableHead className="text-right font-black uppercase text-[10px] p-6">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length > 0 ? filtered.map(req => (
              <TableRow key={req.id} className="hover:bg-muted/10 transition-colors">
                <TableCell className="p-6">
                  <div className="flex flex-col">
                    <span className="font-black text-sm uppercase italic text-primary">{req.eventTitle}</span>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">{new Date(req.createdAt?.seconds * 1000).toLocaleString('pt-BR')}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-secondary" />
                    <span className="font-bold text-xs uppercase">{req.orgId?.slice(0, 8)}...</span>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <Badge className={cn(
                    "text-[8px] font-black uppercase h-5",
                    req.status === 'aprovado' ? "bg-green-600" : req.status === 'rejeitado' ? "bg-red-500" : "bg-orange-50"
                  )}>{req.status}</Badge>
                </TableCell>
                <TableCell className="p-6 text-right">
                  <Button variant="ghost" size="sm" onClick={() => setSelectedReq(req)} className="rounded-lg font-black uppercase text-[9px]">Detalhes</Button>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow><TableCell colSpan={4} className="py-24 text-center opacity-30 italic"><Inbox className="w-12 h-12 mx-auto mb-4" />Nenhum pedido pendente.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!selectedReq} onOpenChange={(o) => !o && setSelectedReq(null)}>
        <DialogContent className="max-w-2xl rounded-[2.5rem] p-0 overflow-hidden flex flex-col">
           <DialogHeader className="p-8 border-b bg-muted/30">
              <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-primary">Analisar Propriedade</DialogTitle>
           </DialogHeader>
           <ScrollArea className="flex-1 p-8">
              <div className="space-y-8">
                 <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-1">
                       <p className="text-[9px] font-black uppercase opacity-40">Evento Alvo</p>
                       <p className="font-bold text-sm text-primary uppercase">{selectedReq?.eventTitle}</p>
                    </div>
                    <div className="space-y-1">
                       <p className="text-[9px] font-black uppercase opacity-40">ID da Organização</p>
                       <p className="font-mono text-xs">{selectedReq?.orgId}</p>
                    </div>
                 </div>
                 <div className="space-y-1">
                    <p className="text-[9px] font-black uppercase opacity-40">Justificativa do Solicitante</p>
                    <div className="p-4 bg-muted/20 rounded-2xl border text-sm italic">"{selectedReq?.justification || "Sem justificativa informada."}"</div>
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">Parecer Administrativo</Label>
                    <Input value={adminNotes} onChange={e => setAdminNotes(e.target.value)} placeholder="Motivo da decisão..." className="rounded-xl h-12" />
                 </div>
              </div>
           </ScrollArea>
           <DialogFooter className="p-8 bg-muted/10 border-t grid grid-cols-2 gap-4">
              {selectedReq?.status === 'pendente' ? (
                <>
                  <Button variant="outline" className="rounded-xl h-12 border-destructive text-destructive font-black uppercase" onClick={() => handleAction('rejeitado')} disabled={isProcessing}>Rejeitar</Button>
                  <Button className="rounded-xl h-12 bg-green-600 text-white font-black uppercase" onClick={() => handleAction('aprovado')} disabled={isProcessing}>{isProcessing ? <Loader2 className="animate-spin" /> : "Aprovar Transferência"}</Button>
                </>
              ) : (
                <Button className="col-span-2 rounded-xl h-12" variant="ghost" onClick={() => setSelectedReq(null)}>Fechar</Button>
              )}
           </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
