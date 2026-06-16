'use client';

import * as React from 'react';
import { useFirestore, useCollection, useMemoFirebase, useAuth, useUser } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Plus, 
  Search, 
  Loader2, 
  Sparkles, 
  Inbox,
  ChevronRight,
  Mail,
  Zap,
  Tag
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from '@/hooks/use-toast';
import { createCrmCampaignAction } from '@/app/actions/crm-marketing';
import { gerarCampanhaEmail } from '@/ai/flows/gerar-campanha-email';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

export default function CrmCampaignsPage() {
  const db = useFirestore();
  const auth = useAuth();
  const { user } = useUser(auth);
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [isAiLoading, setIsAiLoading] = React.useState(false);

  const campaignsQuery = useMemoFirebase(() => db ? query(collection(db, "crm_campaigns"), orderBy("createdAt", "desc")) : null, [db]);
  const { data: campaigns, loading } = useCollection<any>(campaignsQuery);

  const filtered = campaigns?.filter(c => c.title?.toLowerCase().includes(search.toLowerCase())) || [];

  const handleGenerateAi = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || isAiLoading) return;
    
    setIsAiLoading(true);
    const formData = new FormData(e.currentTarget);
    
    try {
      console.log("[CRM-AI] Iniciando geração de campanha...");
      
      const aiResult = await gerarCampanhaEmail({
        objetivo: formData.get('objetivo') as string,
        publicoAlvo: formData.get('segmento') as string,
        tom: formData.get('tom') as string,
        maxEventos: 3
      });

      const campaignRes = await createCrmCampaignAction({
        title: formData.get('title') as string,
        ...aiResult,
        objective: formData.get('objetivo') as string,
        tom: formData.get('tom') as string,
      }, user.uid);

      if (campaignRes.success) {
        toast({ title: "Campanha gerada pela IA!" });
        router.push(`/admin/crm/campanhas/${campaignRes.id}`);
      } else throw new Error(campaignRes.error);
    } catch (err: any) {
      console.error("[CRM-AI-ERROR] Falha na geração da campanha:", err);
      toast({ 
        variant: "destructive", 
        title: "Erro na IA", 
        description: err.message || "Não foi possível processar a geração no momento."
      });
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar campanha..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 h-11 rounded-xl" />
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
           <DialogTrigger asChild>
              <Button className="bg-secondary text-white font-black rounded-full px-8 h-11 shadow-lg gap-2 uppercase italic">
                <Plus className="w-5 h-5" /> Nova Campanha IA
              </Button>
           </DialogTrigger>
           <DialogContent className="max-w-md rounded-[2.5rem] p-0 overflow-hidden">
              <DialogHeader className="p-8 bg-muted/30 border-b">
                 <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-secondary/10 rounded-lg text-secondary"><Sparkles className="w-6 h-6 fill-current" /></div>
                    <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-primary">Viby AI Marketing</DialogTitle>
                 </div>
                 <DialogDescription className="font-bold text-secondary uppercase text-[10px]">Criação inteligente baseada em dados reais</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleGenerateAi} className="p-8 space-y-6">
                 <div className="space-y-2"><Label className="text-[10px] font-black uppercase ml-1">Título Interno</Label><Input name="title" required className="rounded-xl h-11" placeholder="Ex: Campanha Retenção SP" /></div>
                 <div className="space-y-2"><Label className="text-[10px] font-black uppercase ml-1">Objetivo Estratégico</Label><Input name="objetivo" required className="rounded-xl h-11" placeholder="Ex: Reativar usuários antigos" /></div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase ml-1">Público Alvo</Label>
                       <Select name="segmento" required defaultValue="Interessados em Shows">
                          <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                          <SelectContent className="rounded-xl">
                             <SelectItem value="Interessados em Shows">Interessados em Shows</SelectItem>
                             <SelectItem value="Usuários de São Paulo">Usuários de SP</SelectItem>
                             <SelectItem value="Leads de Organizadores">Leads Pendentes</SelectItem>
                          </SelectContent>
                       </Select>
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase ml-1">Tom de Voz</Label>
                       <Select name="tom" required defaultValue="profissional">
                          <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                          <SelectContent className="rounded-xl">
                             <SelectItem value="profissional">Profissional</SelectItem>
                             <SelectItem value="amigável">Amigável</SelectItem>
                             <SelectItem value="urgente">Urgente</SelectItem>
                             <SelectItem value="entusiasmado">Entusiasmado</SelectItem>
                          </SelectContent>
                       </Select>
                    </div>
                 </div>
                 <Button type="submit" disabled={isAiLoading} className="w-full h-14 bg-secondary text-white font-black rounded-2xl shadow-xl uppercase italic text-lg">
                    {isAiLoading ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : <><Sparkles className="w-5 h-5 mr-2 fill-current" /> Gerar com IA</>}
                 </Button>
              </form>
           </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-secondary" /></div>
        ) : filtered.length > 0 ? (
          filtered.map(c => (
            <Link key={c.id} href={`/admin/crm/campanhas/${c.id}`}>
               <Card className="border-none shadow-sm rounded-[1.5rem] bg-white hover:shadow-md transition-all group overflow-hidden">
                  <CardContent className="p-0">
                     <div className="px-8 py-6 flex items-center justify-between">
                        <div className="flex items-center gap-6">
                           <div className={cn(
                             "p-3 rounded-2xl transition-colors",
                             c.status === 'concluido' ? "bg-green-50 text-green-600" : "bg-muted text-muted-foreground group-hover:bg-secondary/10 group-hover:text-secondary"
                           )}>
                              <Mail className="w-6 h-6" />
                           </div>
                           <div className="space-y-1">
                              <h3 className="font-black text-base uppercase italic text-primary leading-none">{c.title}</h3>
                              <div className="flex items-center gap-3">
                                 <Badge variant="outline" className="text-[8px] font-black uppercase h-4 px-1.5">{c.status}</Badge>
                                 <span className="text-[9px] font-bold text-muted-foreground uppercase">{new Date(c.createdAt?.seconds * 1000).toLocaleDateString('pt-BR')}</span>
                              </div>
                           </div>
                        </div>

                        <div className="flex items-center gap-10">
                           <ChevronRight className="w-5 h-5 text-muted-foreground/30 group-hover:text-secondary transition-colors" />
                        </div>
                     </div>
                  </CardContent>
               </Card>
            </Link>
          ))
        ) : (
          <div className="py-32 text-center bg-white rounded-[3rem] border-2 border-dashed opacity-30 italic flex flex-col items-center gap-4">
             <Inbox className="w-12 h-12" />
             <p className="text-xs font-black uppercase tracking-widest">Nenhuma campanha para exibir</p>
          </div>
        )}
      </div>
    </div>
  );
}