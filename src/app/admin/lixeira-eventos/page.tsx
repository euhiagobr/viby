
'use client';

import * as React from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, where, deleteDoc, doc } from 'firebase/firestore';
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
  Trash2, 
  Loader2, 
  Search, 
  RefreshCw,
  History,
  Inbox,
  AlertTriangle,
  User,
  ShieldAlert,
  ArrowLeft
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from '@/hooks/use-toast';
import { cn } from "@/lib/utils";
import { restoreEventAction, permanentDeleteEventAction } from '@/app/actions/curation-admin';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import Link from 'next/link';

export default function AdminLixeiraEventos() {
  const db = useFirestore();
  const { adminProfile } = useAdminPermissions();
  const [search, setSearch] = React.useState("");
  const [isProcessing, setIsProcessing] = React.useState(false);

  const deletedEventsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'events'), where('status', '==', 'Excluído'));
  }, [db]);

  const { data: events, loading } = useCollection<any>(deletedEventsQuery);

  const filtered = React.useMemo(() => {
    if (!events) return [];
    return events.filter(e => 
      e.title?.toLowerCase().includes(search.toLowerCase()) ||
      e.deleteReason?.toLowerCase().includes(search.toLowerCase())
    ).sort((a, b) => (b.deletedAt?.seconds || 0) - (a.deletedAt?.seconds || 0));
  }, [events, search]);

  const handleRestore = async (id: string) => {
    if (!adminProfile || isProcessing) return;
    setIsProcessing(true);
    try {
      const res = await restoreEventAction(id, adminProfile.uid, adminProfile.nome);
      if (res.success) toast({ title: "Evento Restaurado!", description: "O card voltou a ficar ativo no feed público." });
      else throw new Error(res.error);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao restaurar", description: e.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePermanentDelete = async (id: string) => {
    if (!adminProfile || isProcessing) return;
    setIsProcessing(true);
    try {
      const res = await permanentDeleteEventAction(id, adminProfile.uid, adminProfile.nome);
      if (res.success) toast({ title: "Exclusão Definitiva!", description: "O evento e todos os seus dados foram apagados." });
      else throw new Error(res.error);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro na exclusão", description: e.message });
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) return <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-secondary" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
          <Trash2 className="w-8 h-8 text-secondary" /> Lixeira Administrativa
        </h1>
        <p className="text-muted-foreground font-medium">Controle de eventos excluídos ou removidos por moderação.</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por título ou motivo..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 h-12 rounded-xl" />
      </div>

      <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="font-black uppercase text-[10px] p-6">Evento / Data Exclusão</TableHead>
              <TableHead className="font-black uppercase text-[10px]">Motivo da Remoção</TableHead>
              <TableHead className="font-black uppercase text-[10px] text-center">Responsável</TableHead>
              <TableHead className="text-right font-black uppercase text-[10px] p-6">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length > 0 ? filtered.map(event => (
              <TableRow key={event.id} className="hover:bg-muted/10 transition-colors opacity-75">
                <TableCell className="p-6">
                  <div className="flex flex-col">
                    <span className="font-black text-sm uppercase italic text-primary">{event.title}</span>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">{event.deletedAt ? new Date(event.deletedAt.seconds * 1000).toLocaleString('pt-BR') : '---'}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <p className="text-xs font-medium leading-relaxed max-w-[300px] truncate" title={event.deleteReason}>
                    {event.deleteReason || "Remoção direta pelo admin."}
                  </p>
                </TableCell>
                <TableCell className="text-center">
                   <Badge variant="outline" className="text-[8px] font-black uppercase gap-1.5 h-6">
                      <User className="w-3 h-3" /> {event.deletedBy?.slice(0, 8) || "Sistema"}
                   </Badge>
                </TableCell>
                <TableCell className="p-6 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleRestore(event.id)} disabled={isProcessing} className="rounded-lg font-black text-[9px] uppercase border-secondary text-secondary">
                      <RefreshCw className="w-3 h-3 mr-1.5" /> Restaurar
                    </Button>

                    <AlertDialog>
                       <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-lg">
                             <Trash2 className="w-4 h-4" />
                          </Button>
                       </AlertDialogTrigger>
                       <AlertDialogContent className="rounded-[2.5rem]">
                          <AlertDialogHeader>
                             <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-destructive/10 rounded-lg text-destructive"><ShieldAlert className="w-6 h-6" /></div>
                                <AlertDialogTitle className="text-xl font-black italic uppercase tracking-tighter">EXCLUIR PERMANENTEMENTE?</AlertDialogTitle>
                             </div>
                             <AlertDialogDescription className="font-medium text-foreground/80 leading-relaxed">
                                Você está prestes a apagar este evento do banco de dados definitivamente. Isso removerá todos os dados, comentários e históricos vinculados. **Esta ação não pode ser desfeita.**
                             </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter className="gap-3 mt-4">
                             <AlertDialogCancel className="rounded-xl font-bold uppercase text-[10px]">Desistir</AlertDialogCancel>
                             <AlertDialogAction onClick={() => handlePermanentDelete(event.id)} className="bg-destructive text-white rounded-xl font-black uppercase text-[10px] px-8">Confirmar Exclusão</AlertDialogAction>
                          </AlertDialogFooter>
                       </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow><TableCell colSpan={4} className="py-24 text-center opacity-30 italic"><Inbox className="w-12 h-12 mx-auto mb-4" />Lixeira vazia.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
