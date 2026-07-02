'use client';

import * as React from 'react';
import { useFirestore, useCollection, useMemoFirebase, useAuth, useUser } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  Key, 
  Plus, 
  Loader2, 
  Search, 
  Copy, 
  Check, 
  Trash2, 
  ShieldAlert, 
  History, 
  Code2, 
  X,
  Power,
  PowerOff,
  Terminal,
  Activity,
  Calendar,
  Zap,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { createApiTokenAction, toggleTokenStatusAction, deleteApiTokenAction } from '@/app/actions/api-tokens';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function AdminApiTokensPage() {
  const db = useFirestore();
  const auth = useAuth();
  const { user } = useUser(auth);

  const [search, setSearch] = React.useState("");
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [newTokenResult, setNewTokenResult] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [copiedExample, setCopiedExample] = React.useState(false);

  const tokensQuery = useMemoFirebase(() => 
    db ? query(collection(db, "api_tokens"), orderBy("createdAt", "desc")) : null, 
    [db]
  );
  const { data: tokens, loading } = useCollection<any>(tokensQuery);

  const filtered = tokens?.filter(t => t.name?.toLowerCase().includes(search.toLowerCase())) || [];

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || isSubmitting) return;

    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    try {
      const res = await createApiTokenAction({
        name: formData.get('name') as string,
        description: formData.get('description') as string,
        adminUid: user.uid
      });

      if (res.success && res.token) {
        setNewTokenResult(res.token);
        toast({ title: "Token gerado com sucesso!" });
      } else throw new Error(res.error);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao criar", description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = (txt: string, setter: (v: boolean) => void) => {
    navigator.clipboard.writeText(txt);
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  const handleCopyExample = () => {
    const curl = `curl -X POST https://viby.club/api/integrations/tickets/find \\
-H "Authorization: Bearer viby_live_xxxxxxxxxxxxxxxxx" \\
-H "Content-Type: application/json" \\
-d '{
  "eventId": "YBrAVYPCTPoomxB9MtNz",
  "cpf": "12345678900"
}'`;
    handleCopy(curl, setCopiedExample);
    toast({ title: "Exemplo copiado para o clipboard!" });
  };

  const handleToggleStatus = async (id: string, current: string) => {
    const next = current === 'active' ? 'revoked' : 'active';
    const res = await toggleTokenStatusAction(id, next);
    if (res.success) toast({ title: `Token ${next === 'active' ? 'ativado' : 'revogado'}!` });
  };

  const handleDelete = async (id: string) => {
    const res = await deleteApiTokenAction(id);
    if (res.success) toast({ title: "Token excluído." });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h1 className="text-3xl font-black italic uppercase tracking-tighter text-primary flex items-center gap-3">
              <Code2 className="w-8 h-8 text-secondary" /> Tokens de API
           </h1>
           <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest">Integrações de Terceiros e Credenciais Externas</p>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={(v) => { setIsCreateOpen(v); if(!v) setNewTokenResult(null); }}>
           <DialogTrigger asChild>
              <Button className="bg-secondary text-white font-black rounded-full px-8 h-12 shadow-lg gap-2 uppercase italic transition-all hover:scale-105">
                 <Plus className="w-5 h-5" /> Gerar Novo Token
              </Button>
           </DialogTrigger>
           <DialogContent className="max-w-md rounded-[2.5rem] p-0 overflow-hidden">
              {!newTokenResult ? (
                <form onSubmit={handleCreate}>
                   <DialogHeader className="p-8 border-b bg-muted/30">
                      <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-primary">Nova Credencial</DialogTitle>
                      <DialogDescription className="font-bold text-secondary uppercase text-[10px]">Crie um token de acesso para um parceiro externo.</DialogDescription>
                   </DialogHeader>
                   <div className="p-8 space-y-6">
                      <div className="space-y-2">
                         <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Nome da Integração</Label>
                         <Input name="name" required placeholder="Ex: App Ranking Troféu" className="rounded-xl h-11" />
                      </div>
                      <div className="space-y-2">
                         <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Descrição (Opcional)</Label>
                         <Input name="description" placeholder="Finalidade deste acesso..." className="rounded-xl h-11" />
                      </div>
                      <div className="p-4 bg-secondary/5 rounded-2xl border border-secondary/10 flex items-start gap-3">
                         <ShieldCheck className="w-3.5 h-3.5 text-secondary shrink-0 mt-0.5" />
                         <p className="text-[9px] text-secondary font-bold uppercase leading-relaxed">O token será gerado com permissões de leitura restrita à consulta de ingressos (tickets.find).</p>
                      </div>
                   </div>
                   <DialogFooter className="p-8 bg-muted/10 border-t">
                      <Button type="submit" disabled={isSubmitting} className="w-full bg-secondary text-white font-black h-14 rounded-2xl shadow-xl uppercase italic">
                         {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : "Gerar Credencial Live"}
                      </Button>
                   </DialogFooter>
                </form>
              ) : (
                <div className="p-10 space-y-10 text-center animate-in zoom-in-95">
                   <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto text-white shadow-lg animate-in zoom-in-50 duration-500">
                      <Zap className="w-10 h-10 fill-current" />
                   </div>
                   <div className="space-y-2">
                      <h3 className="text-2xl font-black italic uppercase tracking-tighter text-primary">Token Gerado!</h3>
                      <p className="text-sm font-medium text-muted-foreground leading-relaxed">Copie-o agora. Por segurança, ele **não será exibido novamente** após fechar esta janela.</p>
                   </div>
                   
                   <div className="relative group">
                      <Input readOnly value={newTokenResult} className="h-16 text-center font-mono text-sm bg-muted/40 border-dashed border-secondary/40 rounded-2xl pr-14" />
                      <Button onClick={() => handleCopy(newTokenResult, setCopied)} variant="ghost" size="icon" className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10">
                         {copied ? <Check className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5" />}
                      </Button>
                   </div>

                   <div className="p-6 bg-orange-50 rounded-[1.5rem] border-2 border-dashed border-orange-200 flex items-start gap-3 text-left">
                      <AlertTriangle className="w-6 h-6 text-orange-600 shrink-0" />
                      <p className="text-[10px] text-orange-800 font-bold uppercase leading-tight">Mantenha esta chave em segredo. Ela concede acesso a dados protegidos da plataforma.</p>
                   </div>
                   
                   <Button onClick={() => setIsCreateOpen(false)} className="w-full bg-primary text-white font-black h-14 rounded-2xl shadow-xl uppercase italic">Concluído</Button>
                </div>
              )}
           </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-6">
           <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por nome da integração..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 h-12 rounded-xl" />
           </div>

           <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
              <Table>
                 <TableHeader className="bg-muted/30">
                    <TableRow>
                       <TableHead className="font-black uppercase text-[9px] tracking-widest p-6">Integração / Token</TableHead>
                       <TableHead className="font-black uppercase text-[9px] tracking-widest">Status</TableHead>
                       <TableHead className="font-black uppercase text-[9px] tracking-widest text-center">Requisições</TableHead>
                       <TableHead className="font-black uppercase text-[9px] tracking-widest">Último Uso</TableHead>
                       <TableHead className="text-right font-black uppercase text-[9px] tracking-widest p-6">Gestão</TableHead>
                    </TableRow>
                 </TableHeader>
                 <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={5} className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-secondary" /></TableCell></TableRow>
                    ) : filtered.length > 0 ? (
                      filtered.map(t => (
                        <TableRow key={t.id} className={cn("hover:bg-muted/5 transition-colors", t.status === 'revoked' && "opacity-50 grayscale bg-muted/20")}>
                           <TableCell className="p-6">
                              <div className="flex flex-col gap-1">
                                 <span className="font-black text-sm uppercase italic text-primary">{t.name}</span>
                                 <div className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
                                    <Key className="w-3 h-3 text-secondary" /> {t.prefix}****************{t.suffix}
                                 </div>
                              </div>
                           </TableCell>
                           <TableCell>
                              <Badge className={cn("text-[8px] font-black uppercase h-5", t.status === 'active' ? "bg-green-600 text-white" : "bg-red-500 text-white")}>
                                 {t.status === 'active' ? "ATIVO" : "REVOGADO"}
                              </Badge>
                           </TableCell>
                           <TableCell className="text-center font-black text-xs text-primary">{t.requestCount || 0}</TableCell>
                           <TableCell>
                              <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase">
                                 <Clock className="w-3.5 h-3.5" />
                                 {t.lastUsedAt ? new Date(t.lastUsedAt.seconds * 1000).toLocaleString('pt-BR') : "---"}
                              </div>
                           </TableCell>
                           <TableCell className="p-6 text-right">
                              <div className="flex justify-end gap-1">
                                 <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                       <Button variant="ghost" size="icon" className={cn("h-8 w-8 rounded-lg", t.status === 'active' ? "text-orange-500" : "text-green-600")}>
                                          {t.status === 'active' ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                                       </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent className="rounded-[2.5rem]">
                                       <AlertDialogHeader>
                                          <AlertDialogTitle className="text-xl font-black italic uppercase tracking-tighter">
                                             {t.status === 'active' ? 'REVOGAR ACESSO?' : 'REATIVAR TOKEN?'}
                                          </AlertDialogTitle>
                                          <AlertDialogDescription className="font-medium text-foreground/70">
                                             {t.status === 'active' 
                                               ? `A integração "${t.name}" deixará de funcionar imediatamente em todos os sistemas externos.` 
                                               : `O acesso será restabelecido para as chaves já distribuídas de "${t.name}".`}
                                          </AlertDialogDescription>
                                       </AlertDialogHeader>
                                       <AlertDialogFooter>
                                          <AlertDialogCancel className="rounded-xl font-bold uppercase text-[10px]">Desistir</AlertDialogCancel>
                                          <AlertDialogAction onClick={() => handleToggleStatus(t.id, t.status)} className={cn("rounded-xl font-black uppercase text-[10px] text-white", t.status === 'active' ? "bg-orange-600" : "bg-green-600")}>Confirmar</AlertDialogAction>
                                       </AlertDialogFooter>
                                    </AlertDialogContent>
                                 </AlertDialog>

                                 <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                       <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-lg hover:bg-destructive/10"><Trash2 className="w-4 h-4" /></Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent className="rounded-[2.5rem]">
                                       <AlertDialogHeader>
                                          <AlertDialogTitle className="text-xl font-black italic uppercase tracking-tighter">EXCLUIR DEFINITIVAMENTE?</AlertDialogTitle>
                                          <AlertDialogDescription className="font-medium text-foreground/70">Esta ação apagará o hash do banco. O token nunca mais poderá ser reativado. **Isso é irreversível.**</AlertDialogDescription>
                                       </AlertDialogHeader>
                                       <AlertDialogFooter>
                                          <AlertDialogCancel className="rounded-xl font-bold uppercase text-[10px]">Manter</AlertDialogCancel>
                                          <AlertDialogAction onClick={() => handleDelete(t.id)} className="bg-destructive text-white rounded-xl font-black uppercase text-[10px]">Sim, Excluir</AlertDialogAction>
                                       </AlertDialogFooter>
                                    </AlertDialogContent>
                                 </AlertDialog>
                              </div>
                           </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow><TableCell colSpan={5} className="py-32 text-center opacity-30 italic"><Inbox className="w-12 h-12 mx-auto mb-4" />Nenhum token cadastrado na base real.</TableCell></TableRow>
                    )}
                 </TableBody>
              </Table>
           </Card>
        </div>

        <aside className="lg:col-span-4 space-y-8">
           <Card className="border-none shadow-xl rounded-[2.5rem] bg-slate-900 text-white overflow-hidden group">
              <CardHeader className="bg-slate-800/50 p-8 border-b border-white/5">
                 <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                       <div className="p-2 bg-secondary/10 rounded-lg text-secondary"><Terminal className="w-5 h-5" /></div>
                       <CardTitle className="text-lg font-black italic uppercase tracking-tighter">Dev Sandbox</CardTitle>
                    </div>
                    <Button variant="ghost" size="icon" onClick={handleCopyExample} className="text-white/40 hover:text-white rounded-lg">
                       {copiedExample ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    </Button>
                 </div>
              </CardHeader>
              <CardContent className="p-0">
                 <ScrollArea className="h-64 bg-slate-950/50">
                    <pre className="p-8 text-[10px] font-mono text-emerald-400 leading-relaxed overflow-x-auto whitespace-pre">
{`curl -X POST https://viby.club/api/integrations/tickets/find \\
-H "Authorization: Bearer viby_live_..." \\
-H "Content-Type: application/json" \\
-d '{
  "eventId": "YBrAVYPCTPoomxB9MtNz",
  "cpf": "12345678900"
}'`}
                    </pre>
                 </ScrollArea>
                 <div className="p-8 space-y-6">
                    <div className="space-y-4">
                       <div className="flex items-center gap-3">
                          <Activity className="w-4 h-4 text-secondary" />
                          <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Status do Endpoint</span>
                          <Badge className="ml-auto bg-green-500/20 text-green-400 border-none text-[8px] font-black uppercase h-5 px-2">ONLINE</Badge>
                       </div>
                       <Separator className="bg-white/5" />
                       <div className="space-y-1">
                          <p className="text-[9px] font-bold text-white/40 uppercase">Resposta Esperada:</p>
                          <p className="text-[10px] font-mono text-emerald-500/80">{`{ "success": true, "ticket": { ... } }`}</p>
                       </div>
                    </div>
                    <Button variant="outline" onClick={handleCopyExample} className="w-full h-11 rounded-xl border-white/10 text-white hover:bg-white/5 font-black uppercase text-[10px] gap-2">
                       Copiar Exemplo cURL
                    </Button>
                 </div>
              </CardContent>
           </Card>

           <div className="p-6 bg-secondary/5 rounded-3xl border border-secondary/10 space-y-4">
              <div className="flex items-center gap-2">
                 <Info className="w-4 h-4 text-secondary" />
                 <h4 className="text-[10px] font-black uppercase tracking-widest text-primary">Segurança Ativa</h4>
              </div>
              <p className="text-[10px] text-muted-foreground font-medium leading-relaxed uppercase">
                 O sistema não armazena tokens em texto puro. O hash gerado é irreversível e verificado em tempo real no servidor (D+0). 
                 A revogação desconecta a integração instantaneamente sem afetar outras chaves.
              </p>
           </div>
        </aside>
      </div>
    </div>
  );
}
