'use client';

import * as React from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
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
  Mail, 
  Loader2, 
  Search, 
  Eye, 
  Calendar, 
  User, 
  ArrowRight,
  Inbox,
  Filter,
  RefreshCcw,
  Zap,
  MousePointer2
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/hooks/use-toast';
import { resendLoggedEmail } from '@/app/actions/email';
import { cn } from '@/lib/utils';

export default function AdminNotificacoesPage() {
  const db = useFirestore();
  const [search, setSearch] = React.useState('');
  const [resendingId, setResendingId] = React.useState<string | null>(null);

  const emailsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'sent_emails'), orderBy('timestamp', 'desc'), limit(100));
  }, [db]);

  const { data: emails, loading } = useCollection<any>(emailsQuery);

  const filteredEmails = React.useMemo(() => {
    if (!emails) return [];
    return emails.filter(e => 
      (e.recipientEmail?.toLowerCase() || '').includes(search.toLowerCase()) ||
      (e.recipientName?.toLowerCase() || '').includes(search.toLowerCase()) ||
      (e.subject?.toLowerCase() || '').includes(search.toLowerCase())
    );
  }, [emails, search]);

  const handleResend = async (email: any) => {
    setResendingId(email.id);
    try {
      // Next.js Server Actions exigem objetos planos (plain objects).
      // Enviamos apenas os campos necessários, removendo o objeto 'timestamp' do Firestore
      // que causa erro de serialização por possuir métodos internos.
      const sanitizedEmail = {
        recipientEmail: email.recipientEmail,
        recipientName: email.recipientName,
        subject: email.subject,
        content: email.content,
        type: email.type
      };

      const result = await resendLoggedEmail(sanitizedEmail);
      if (result.success) {
        toast({ title: "E-mail reenviado com sucesso!" });
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao reenviar", description: error.message });
    } finally {
      setResendingId(null);
    }
  };

  const formatTimestamp = (ts: any) => {
    if (!ts) return '---';
    try {
      const d = ts.toDate ? ts.toDate() : new Date(ts);
      return d.toLocaleString('pt-BR');
    } catch (e) { return '---'; }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
          <Mail className="w-8 h-8 text-secondary" />
          E-mails Enviados
        </h1>
        <p className="text-muted-foreground font-medium">Auditoria de comunicações disparadas pela plataforma.</p>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por e-mail, nome ou assunto..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-12 rounded-xl"
          />
        </div>
        <Button variant="outline" className="h-12 w-12 rounded-xl" size="icon">
          <Filter className="w-4 h-4" />
        </Button>
      </div>

      <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-20 flex justify-center"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>
          ) : filteredEmails.length > 0 ? (
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest">Data / Hora</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest">Origem / Tipo</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest">Destinatário</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest">Assunto</TableHead>
                  <TableHead className="text-right font-black uppercase text-[10px] tracking-widest">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmails.map((email) => {
                  const isAutomated = email.sender === "Viby System";
                  
                  return (
                    <TableRow key={email.id} className="hover:bg-muted/10 transition-colors">
                      <TableCell className="text-[10px] font-bold text-muted-foreground">
                        {formatTimestamp(email.timestamp)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                           <Badge variant={isAutomated ? "secondary" : "outline"} className={cn(
                             "text-[9px] font-black uppercase w-fit",
                             isAutomated ? "bg-muted text-muted-foreground" : "border-secondary text-secondary"
                           )}>
                             {isAutomated ? (
                               <><Zap className="w-2.5 h-2.5 mr-1" /> Automático</>
                             ) : (
                               <><MousePointer2 className="w-2.5 h-2.5 mr-1" /> Manual</>
                             )}
                           </Badge>
                           <span className="text-[8px] font-bold uppercase opacity-40 ml-1">
                             {isAutomated ? "Sistema" : `Por: ${email.sender}`}
                           </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-bold text-xs">{email.recipientName}</span>
                          <span className="text-[10px] text-muted-foreground">{email.recipientEmail}</span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <span className="text-xs font-medium truncate block">{email.subject}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 gap-2 font-bold text-[9px] uppercase rounded-lg border-secondary/20 text-secondary hover:bg-secondary/10"
                            onClick={() => handleResend(email)}
                            disabled={resendingId === email.id}
                          >
                             {resendingId === email.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCcw className="w-3 h-3" />}
                             Reenviar
                          </Button>

                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 gap-2 font-bold text-[9px] uppercase rounded-lg">
                                <Eye className="w-3.5 h-3.5" /> Ver Cópia
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-3xl h-[80vh] flex flex-col p-0 overflow-hidden rounded-2xl">
                              <DialogHeader className="p-6 bg-muted/30 border-b">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <DialogTitle className="text-xl font-black italic uppercase tracking-tighter">Cópia do E-mail</DialogTitle>
                                    <DialogDescription className="font-medium mt-1">Enviado em {formatTimestamp(email.timestamp)}</DialogDescription>
                                  </div>
                                  <Badge className="bg-secondary text-white uppercase text-[9px] font-black h-5">{email.type}</Badge>
                                </div>
                                <div className="mt-4 space-y-1">
                                   <p className="text-[10px] font-black uppercase opacity-40">Para: {email.recipientName} ({email.recipientEmail})</p>
                                   <p className="text-[10px] font-black uppercase opacity-40">Assunto: {email.subject}</p>
                                </div>
                              </DialogHeader>
                              <ScrollArea className="flex-1 bg-white p-6">
                                 <div 
                                   className="border rounded-xl p-4 bg-[#f8fafc] shadow-inner"
                                   dangerouslySetInnerHTML={{ __html: email.content }} 
                                 />
                              </ScrollArea>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="py-24 text-center">
              <Inbox className="w-12 h-12 text-muted-foreground mx-auto opacity-10 mb-4" />
              <p className="text-muted-foreground font-bold italic">Nenhum e-mail registrado recentemente.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}