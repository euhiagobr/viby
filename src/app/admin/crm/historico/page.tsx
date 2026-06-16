'use client';

import * as React from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  Search, 
  Inbox, 
  CheckCircle2, 
  History
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

export default function CrmHistoryPage() {
  const db = useFirestore();
  const [search, setSearch] = React.useState("");

  const historyQuery = useMemoFirebase(() => 
    db ? query(collection(db, "sent_emails"), orderBy("timestamp", "desc"), limit(100)) : null, 
    [db]
  );
  const { data: logs, loading } = useCollection<any>(historyQuery);

  const filtered = logs?.filter(log => 
    log.recipientEmail?.toLowerCase().includes(search.toLowerCase()) ||
    log.subject?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h2 className="text-xl font-black uppercase italic text-primary">Log de Disparos Reais</h2>
           <p className="text-xs font-bold text-muted-foreground uppercase">Auditoria completa de e-mails enviados pelo sistema</p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Filtrar por e-mail ou assunto..." 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            className="pl-10 h-11 rounded-xl" 
          />
        </div>
      </div>

      <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="font-black uppercase text-[9px] p-6">Data / Horário</TableHead>
              <TableHead className="font-black uppercase text-[9px]">Tipo</TableHead>
              <TableHead className="font-black uppercase text-[9px]">Destinatário</TableHead>
              <TableHead className="font-black uppercase text-[9px]">Assunto</TableHead>
              <TableHead className="text-right font-black uppercase text-[9px] p-6">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="py-20 text-center"><Loader2 className="animate-spin text-secondary mx-auto" /></TableCell></TableRow>
            ) : filtered.length > 0 ? (
              filtered.map(log => (
                <TableRow key={log.id} className="hover:bg-muted/5 transition-colors">
                  <TableCell className="p-6">
                     <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-bold text-muted-foreground">{new Date(log.timestamp?.seconds * 1000 || log.timestamp).toLocaleDateString('pt-BR')}</span>
                        <span className="text-[10px] font-black text-primary uppercase">{new Date(log.timestamp?.seconds * 1000 || log.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                     </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[8px] font-black uppercase h-5 border-secondary/20 text-secondary">
                       {log.type?.replace('_',' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs font-medium truncate block max-w-[150px]">{log.recipientEmail}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs font-bold text-primary truncate block max-w-[250px] italic uppercase">{log.subject}</span>
                  </TableCell>
                  <TableCell className="p-6 text-right">
                    <div className="flex items-center justify-end gap-2 text-[9px] font-black text-green-600 uppercase">
                       <CheckCircle2 className="w-3.5 h-3.5" /> Enviado
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={5} className="py-32 text-center opacity-30 italic"><Inbox className="w-12 h-12 mx-auto mb-4" />Nenhum disparo real registrado.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
