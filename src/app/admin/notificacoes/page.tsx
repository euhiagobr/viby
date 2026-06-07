'use client';

import * as React from 'react';
import { useFirestore, useAuth, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { 
  collection, 
  query, 
  where, 
  limit, 
  getDocs, 
  addDoc, 
  serverTimestamp,
  writeBatch,
  doc,
  deleteDoc,
  orderBy,
  getDoc
} from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Bell, 
  Send, 
  Loader2, 
  AtSign, 
  CheckCircle2, 
  Eye, 
  Zap,
  Building2,
  X,
  ShieldCheck,
  Info,
  BadgeCheck,
  Users,
  Megaphone,
  User,
  History,
  Trash2,
  Search,
  Clock
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MentionTextarea } from '@/components/ui/mention-textarea';
import { RichText } from '@/components/ui/rich-text';
import { toast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const VIBY_OFFICIAL_UID = "dd9665af-ad6d-405c-a51d-08220fecf96f";
const VIBY_AVATAR = "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2FiconUrl_1780427863977?alt=media&token=1ab99264-b05c-4d1d-ab5a-0c27b7bfb77b";

export default function AdminNotificacoesCreatorPage() {
  const db = useFirestore();
  const auth = useAuth();
  const { user: adminUser } = useUser(auth);

  const [sendMode, setSendMode] = React.useState<'single' | 'all'>('single');
  const [searchTarget, setSearchTarget] = React.useState("");
  const [isSearching, setIsSearching] = React.useState(false);
  const [targetUser, setTargetUser] = React.useState<any>(null);
  const [message, setMessage] = React.useState("");
  const [isSending, setIsSending] = React.useState(false);
  
  // Histórico
  const [historySearch, setHistorySearch] = React.useState("");
  const notificationsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, "notifications"), limit(100));
  }, [db]);
  const { data: rawNotifications, loading: loadingHistory } = useCollection<any>(notificationsQuery);

  const filteredHistory = React.useMemo(() => {
    if (!rawNotifications) return [];
    return [...rawNotifications]
      .sort((a, b) => {
        const tA = a.createdAt?.seconds || 0;
        const tB = b.createdAt?.seconds || 0;
        return tB - tA;
      })
      .filter(n => 
        n.message?.toLowerCase().includes(historySearch.toLowerCase()) ||
        n.senderName?.toLowerCase().includes(historySearch.toLowerCase())
      );
  }, [rawNotifications, historySearch]);

  const handleSearchUser = async () => {
    if (!db || !searchTarget.trim() || isSearching) return;
    
    setIsSearching(true);
    try {
      const cleanUsername = searchTarget.toLowerCase().replace('@', '').trim();
      const q = query(collection(db, "usernames"), where("__name__", "==", cleanUsername), limit(1));
      const snap = await getDocs(q);

      if (snap.empty) {
        toast({ variant: "destructive", title: "Usuário não encontrado" });
        setTargetUser(null);
      } else {
        const uData = snap.docs[0].data();
        const profileSnap = await getDocs(query(collection(db, uData.type === 'user' ? 'users' : 'organizations'), where("__name__", "==", uData.uid), limit(1)));
        
        if (!profileSnap.empty) {
          setTargetUser({ id: profileSnap.docs[0].id, ...profileSnap.docs[0].data(), username: cleanUsername });
          toast({ title: "Destinatário selecionado!" });
        }
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Erro na busca" });
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !message.trim() || isSending) return;

    if (sendMode === 'single' && !targetUser) {
      toast({ variant: "destructive", title: "Selecione um destinatário" });
      return;
    }

    setIsSending(true);
    try {
      if (sendMode === 'single') {
        const personalizedMessage = message.replace(/\[username\]/g, `@${targetUser.username}`);
        const notificationData = {
          targetUid: targetUser.id,
          senderId: VIBY_OFFICIAL_UID,
          senderName: "Viby",
          type: "system",
          message: personalizedMessage.trim(),
          read: false,
          createdAt: serverTimestamp(),
          adminExecutorId: adminUser?.uid
        };
        await addDoc(collection(db, "notifications"), notificationData);
        toast({ title: "Notificação Enviada!" });
      } else {
        const usersSnap = await getDocs(collection(db, "users"));
        let batch = writeBatch(db);
        let batchCount = 0;

        for (const uDoc of usersSnap.docs) {
          const userData = uDoc.data();
          const personalizedMessage = message.replace(/\[username\]/g, `@${userData.username || 'usuário'}`);
          const notificationData = {
            targetUid: uDoc.id,
            senderId: VIBY_OFFICIAL_UID,
            senderName: "Viby",
            type: "system",
            message: personalizedMessage.trim(),
            read: false,
            createdAt: serverTimestamp(),
            adminExecutorId: adminUser?.uid
          };
          const newNotifRef = doc(collection(db, "notifications"));
          batch.set(newNotifRef, notificationData);
          batchCount++;
          if (batchCount >= 400) {
            await batch.commit();
            batch = writeBatch(db);
            batchCount = 0;
          }
        }
        if (batchCount > 0) await batch.commit();
        toast({ title: "Disparo Concluído!" });
      }
      setMessage("");
      setTargetUser(null);
      setSearchTarget("");
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao enviar" });
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteNotification = async (id: string) => {
    if (!db || !confirm("Deseja excluir permanentemente este comunicado do histórico?")) return;
    try {
      await deleteDoc(doc(db, "notifications", id));
      toast({ title: "Registro removido" });
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao excluir" });
    }
  };

  const insertShortcut = (tag: string) => {
    setMessage(prev => prev + (prev.endsWith(' ') || prev === '' ? '' : ' ') + tag + ' ');
  };

  const previewMessage = React.useMemo(() => {
    return message.replace(/\[username\]/g, "@exemplo");
  }, [message]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-6xl mx-auto pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
          <Bell className="w-8 h-8 text-secondary" />
          Central de Comunicados
        </h1>
        <p className="text-muted-foreground font-medium">Gestão oficial de notificações e mensagens de sistema.</p>
      </div>

      <Tabs defaultValue="create" className="space-y-8">
        <TabsList className="bg-muted/50 p-1 rounded-xl h-12">
          <TabsTrigger value="create" className="rounded-lg px-8 font-bold gap-2"><Send className="w-4 h-4" /> Enviar Alerta</TabsTrigger>
          <TabsTrigger value="history" className="rounded-lg px-8 font-bold gap-2"><History className="w-4 h-4" /> Histórico de Envios</TabsTrigger>
        </TabsList>

        <TabsContent value="create">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
             <div className="lg:col-span-7 space-y-8">
                <Card className="border-none shadow-sm rounded-[2.5rem] bg-white overflow-hidden">
                   <CardHeader className="bg-muted/30 border-b p-8">
                      <div className="flex items-center justify-between">
                         <CardTitle className="text-lg font-black uppercase italic tracking-tighter text-primary">Configurar Envio</CardTitle>
                         <div className="bg-white p-1 rounded-xl border flex gap-1">
                            <Button variant={sendMode === 'single' ? 'secondary' : 'ghost'} size="sm" className="rounded-lg text-[9px] font-black uppercase h-8 px-4" onClick={() => setSendMode('single')}><AtSign className="w-3 h-3 mr-1.5" /> Individual</Button>
                            <Button variant={sendMode === 'all' ? 'secondary' : 'ghost'} size="sm" className="rounded-lg text-[9px] font-black uppercase h-8 px-4" onClick={() => setSendMode('all')}><Users className="w-3 h-3 mr-1.5" /> Todos</Button>
                         </div>
                      </div>
                   </CardHeader>
                   <CardContent className="p-8 space-y-8">
                      {sendMode === 'single' && (
                        <div className="space-y-3">
                          <Label className="text-[10px] font-black uppercase tracking-widest opacity-60 ml-1">Para: (@username)</Label>
                          {!targetUser ? (
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                  <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" />
                                  <Input placeholder="Ex: joaosilva" value={searchTarget} onChange={e => setSearchTarget(e.target.value)} className="pl-10 h-12 rounded-xl border-dashed border-secondary/30" onKeyDown={e => e.key === 'Enter' && handleSearchUser()} />
                                </div>
                                <Button onClick={handleSearchUser} disabled={isSearching} className="h-12 px-6 rounded-xl font-bold bg-secondary text-white">{isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Buscar"}</Button>
                            </div>
                          ) : (
                            <div className="p-4 bg-secondary/5 rounded-2xl border border-secondary/10 flex items-center justify-between animate-in zoom-in-95">
                                <div className="flex items-center gap-3">
                                  <Avatar className="h-10 w-10 border shadow-sm"><AvatarImage src={targetUser.avatar} className="object-cover" /><AvatarFallback className="font-black bg-muted">{targetUser.name?.charAt(0)}</AvatarFallback></Avatar>
                                  <div><p className="text-sm font-bold text-primary">{targetUser.name}</p><p className="text-[10px] font-black text-secondary uppercase tracking-widest">@{targetUser.username}</p></div>
                                </div>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setTargetUser(null)}><X className="w-4 h-4" /></Button>
                            </div>
                          )}
                        </div>
                      )}

                      {sendMode === 'all' && (
                        <div className="p-6 bg-primary/5 border-2 border-dashed border-primary/20 rounded-[2rem] flex items-center gap-4">
                           <div className="p-3 bg-primary rounded-2xl text-white"><Users className="w-6 h-6" /></div>
                           <div className="space-y-1"><p className="text-sm font-black uppercase italic text-primary">Modo Broadcast Ativo</p><p className="text-[10px] font-medium text-muted-foreground uppercase leading-tight">Envio personalizado para cada usuário da base.</p></div>
                        </div>
                      )}

                      <Separator className="border-dashed" />

                      <div className="space-y-3">
                         <div className="flex items-center justify-between">
                            <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Conteúdo do Comunicado</Label>
                            <div className="flex flex-wrap gap-2">
                               <Button variant="outline" size="sm" className="h-7 text-[8px] font-black uppercase rounded-lg border-dashed" onClick={() => insertShortcut('**texto**')}>Negrito</Button>
                               <Button variant="outline" size="sm" className="h-7 text-[8px] font-black uppercase rounded-lg border-dashed" onClick={() => insertShortcut('[username]')}>Username</Button>
                            </div>
                         </div>
                         <MentionTextarea placeholder="Escreva sua mensagem..." value={message} onValueChange={setMessage} className="min-h-[180px] p-6 rounded-3xl border-dashed border-secondary/30" />
                      </div>

                      <div className="p-4 bg-secondary/5 rounded-2xl border border-secondary/10 flex items-start gap-3">
                         <Info className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
                         <p className="text-[9px] text-secondary font-bold uppercase leading-relaxed">
                            Use o atalho [username] para que o sistema preencha automaticamente o nome de cada usuário.
                         </p>
                      </div>

                      <Button onClick={handleSendNotification} disabled={isSending || (sendMode === 'single' && !targetUser) || !message.trim()} className={cn("w-full h-16 text-white font-black rounded-2xl shadow-xl uppercase italic text-lg", sendMode === 'all' ? "bg-primary" : "bg-secondary")}>
                         {isSending ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : <Send className="w-5 h-5 mr-2" />} {sendMode === 'all' ? "Disparar para Todos" : "Enviar Notificação"}
                      </Button>
                   </CardContent>
                </Card>
             </div>

             <div className="lg:col-span-5 space-y-6">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-2 flex items-center gap-2"><Eye className="w-4 h-4" /> Preview do Usuário</h3>
                <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
                   <div className="p-1.5 bg-secondary/10 flex items-center justify-center gap-2"><ShieldCheck className="w-3.5 h-3.5 text-secondary" /><span className="text-[8px] font-black uppercase tracking-widest text-secondary">Aviso Oficial Viby.Club</span></div>
                   <CardContent className="p-8 space-y-6">
                      <div className="flex items-start gap-4">
                         <div className="relative"><Avatar className="h-12 w-12 border-2 border-primary/10 shadow-sm"><AvatarImage src={VIBY_AVATAR} className="object-cover" /><AvatarFallback className="font-black bg-primary text-white">V</AvatarFallback></Avatar><div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-sm"><BadgeCheck className="w-4 h-4 fill-blue-500 text-white" /></div></div>
                         <div className="flex-1 space-y-3">
                            <div className="flex justify-between items-start"><div><div className="flex items-center gap-1.5"><h4 className="font-black text-sm uppercase italic text-primary leading-none">Viby</h4><BadgeCheck className="w-3.5 h-3.5 fill-blue-500 text-white" /></div><p className="text-[8px] font-bold text-muted-foreground uppercase mt-1">Agora mesmo</p></div><Badge className="bg-secondary text-white border-none text-[8px] font-black uppercase px-2 h-4">Sistema</Badge></div>
                            <div className="bg-muted/30 p-5 rounded-3xl border border-dashed min-h-[120px]">{message ? <RichText content={previewMessage} className="text-sm font-medium text-foreground/80" /> : <div className="flex flex-col items-center justify-center h-full gap-2 py-8 opacity-20"><Megaphone className="w-8 h-8" /><p className="text-[10px] font-black uppercase italic">Sua mensagem aqui...</p></div>}</div>
                         </div>
                      </div>
                   </CardContent>
                </Card>
             </div>
          </div>
        </TabsContent>

        <TabsContent value="history">
          <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden bg-white">
            <CardHeader className="p-8 border-b">
               <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div><CardTitle className="text-xl font-black italic uppercase tracking-tighter">Histórico de Alertas</CardTitle><CardDescription>Monitoramento de comunicados recentes.</CardDescription></div>
                  <div className="relative w-full md:w-80">
                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                     <Input placeholder="Buscar no histórico..." value={historySearch} onChange={e => setHistorySearch(e.target.value)} className="pl-10 h-11 rounded-xl h-11" />
                  </div>
               </div>
            </CardHeader>
            <CardContent className="p-0">
               {loadingHistory ? <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-secondary" /></div> : (
                 <Table>
                   <TableHeader className="bg-muted/30">
                     <TableRow>
                        <TableHead className="font-black uppercase text-[10px] p-6">Data / Horário</TableHead>
                        <TableHead className="font-black uppercase text-[10px]">Destinatário</TableHead>
                        <TableHead className="font-black uppercase text-[10px]">Conteúdo da Mensagem</TableHead>
                        <TableHead className="text-right font-black uppercase text-[10px] p-6">Ação</TableHead>
                     </TableRow>
                   </TableHeader>
                   <TableBody>
                     {filteredHistory.map(n => (
                       <TableRow key={n.id} className="hover:bg-muted/10 transition-colors">
                         <TableCell className="p-6">
                            <div className="flex items-center gap-3">
                               <div className="p-2 bg-muted rounded-lg"><Clock className="w-3.5 h-3.5 text-secondary" /></div>
                               <span className="text-[10px] font-bold text-muted-foreground uppercase">{n.createdAt?.toDate ? n.createdAt.toDate().toLocaleString('pt-BR') : '---'}</span>
                            </div>
                         </TableCell>
                         <TableCell>
                            <Badge variant="outline" className="text-[8px] font-black uppercase h-5 border-secondary/20 text-secondary bg-secondary/5 truncate max-w-[120px]">
                               {n.targetUid?.slice(0, 8)}...
                            </Badge>
                         </TableCell>
                         <TableCell className="max-w-md">
                            <div className="text-[11px] line-clamp-1 opacity-70">
                               <RichText content={n.message} />
                            </div>
                         </TableCell>
                         <TableCell className="p-6 text-right">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleDeleteNotification(n.id)}>
                               <Trash2 className="w-4 h-4" />
                            </Button>
                         </TableCell>
                       </TableRow>
                     ))}
                     {filteredHistory.length === 0 && (
                       <TableRow><TableCell colSpan={4} className="py-32 text-center opacity-30 italic"><Inbox className="w-12 h-12 mx-auto mb-4" />Nenhum comunicado no histórico.</TableCell></TableRow>
                     )}
                   </TableBody>
                 </Table>
               )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
