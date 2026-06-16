
'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, useAuth, useUser } from '@/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft, 
  Send, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  Loader2,
  Eye,
  Mail,
  Zap,
  Target,
  BarChart3,
  AlertTriangle,
  XCircle,
  Smartphone,
  Monitor
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { sendTestEmailAction, approveCrmCampaignAction } from '@/app/actions/crm-marketing';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from '@/components/ui/separator';

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const db = useFirestore();
  const auth = useAuth();
  const { user } = useUser(auth);

  const campaignRef = React.useMemo(() => (db && id) ? doc(db, "crm_campaigns", id) : null, [db, id]);
  const { data: campaign, loading } = useDoc<any>(campaignRef);

  const [isProcessing, setIsProcessing] = React.useState(false);
  const [previewMode, setPreviewMode] = React.useState<'mobile' | 'desktop'>('desktop');

  const handleSendTest = async () => {
    if (!id || isProcessing) return;
    setIsProcessing(true);
    try {
      const res = await sendTestEmailAction(id, user?.uid!);
      if (res.success) toast({ title: "E-mail de teste enviado!", description: "Verifique viby@viby.club" });
      else throw new Error(res.error);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro", description: e.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApprove = async () => {
    if (!id || isProcessing) return;
    setIsProcessing(true);
    try {
      const res = await approveCrmCampaignAction(id, user?.uid!);
      if (res.success) toast({ title: "Campanha Aprovada!", description: "O disparo agora pode ser agendado." });
      else throw new Error(res.error);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro na aprovação", description: e.message });
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) return <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-secondary" /></div>;
  if (!campaign) return <div className="py-20 text-center opacity-20 uppercase font-black italic">Campanha não encontrada</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full bg-white shadow-sm border"><ArrowLeft className="w-5 h-5" /></Button>
          <div>
            <h1 className="text-3xl font-black italic uppercase tracking-tighter text-primary">{campaign.title}</h1>
            <div className="flex items-center gap-3 mt-1">
               <Badge className={cn(
                 "uppercase text-[9px] font-black h-5 px-2 shadow-sm",
                 campaign.status === 'aprovado' ? "bg-green-600" : "bg-orange-500"
               )}>{campaign.status.replace('_',' ')}</Badge>
               <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Criada em {new Date(campaign.createdAt?.seconds * 1000).toLocaleString('pt-BR')}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
           <Button variant="outline" onClick={handleSendTest} disabled={isProcessing} className="rounded-xl h-11 px-6 font-bold uppercase text-[10px] gap-2 border-primary text-primary">
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Teste (Viby Club)
           </Button>
           {campaign.status === 'teste_enviado' && (
             <Button onClick={handleApprove} disabled={isProcessing} className="bg-green-600 text-white rounded-xl h-11 px-8 font-black uppercase italic text-xs shadow-lg shadow-green-900/10">
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />} Aprovar Campanha
             </Button>
           )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-4 space-y-8">
           <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
              <CardHeader className="bg-muted/30 border-b p-8">
                 <CardTitle className="text-lg font-black italic uppercase tracking-tighter flex items-center gap-2 text-primary">
                    <Target className="w-5 h-5 text-secondary" /> Definições IA
                 </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                 <div className="space-y-1">
                    <p className="text-[9px] font-black uppercase text-muted-foreground opacity-40">Objetivo</p>
                    <p className="text-sm font-bold text-primary italic uppercase">{campaign.objective}</p>
                 </div>
                 <div className="space-y-1">
                    <p className="text-[9px] font-black uppercase text-muted-foreground opacity-40">Tom da Voz</p>
                    <p className="text-sm font-bold text-primary uppercase">{campaign.tom || campaign.tone || 'Profissional'}</p>
                 </div>
                 <Separator className="border-dashed" />
                 <div className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-secondary flex items-center gap-2"><Zap className="w-3.5 h-3.5 fill-current" /> Eventos Selecionados</h4>
                    <div className="space-y-2">
                       {campaign.selectedEventIds?.map((eid: string) => (
                         <div key={eid} className="p-3 bg-muted/30 rounded-xl border border-dashed text-[10px] font-bold uppercase truncate">
                            ID: {eid}
                         </div>
                       ))}
                    </div>
                 </div>
              </CardContent>
           </Card>

           <div className="p-6 bg-orange-50 rounded-[2rem] border-2 border-dashed border-orange-200 flex items-start gap-4">
              <AlertTriangle className="w-6 h-6 text-orange-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                 <h4 className="font-black uppercase text-xs italic text-orange-800">Fluxo de Segurança</h4>
                 <p className="text-[10px] text-orange-700 font-medium leading-relaxed uppercase">
                    Nenhum disparo é realizado sem o envio prévio do teste para viby@viby.club e aprovação manual da administração.
                 </p>
              </div>
           </div>
        </div>

        <div className="lg:col-span-8 space-y-6">
           <div className="flex items-center justify-between px-2">
              <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-2"><Eye className="w-4 h-4" /> Visualização do E-mail</h2>
              <div className="bg-muted/50 p-1 rounded-xl flex gap-1 border">
                 <Button variant={previewMode === 'desktop' ? 'secondary' : 'ghost'} size="icon" className="h-9 w-9 rounded-lg" onClick={() => setPreviewMode('desktop')}><Monitor className="w-4 h-4" /></Button>
                 <Button variant={previewMode === 'mobile' ? 'secondary' : 'ghost'} size="icon" className="h-9 w-9 rounded-lg" onClick={() => setPreviewMode('mobile')}><Smartphone className="w-4 h-4" /></Button>
              </div>
           </div>

           <Card className="border-none shadow-2xl rounded-[3rem] bg-white overflow-hidden p-1">
              <div className="bg-muted/10 p-6 border-b space-y-2">
                 <div className="flex items-center gap-2"><span className="text-[9px] font-black uppercase opacity-40 w-16">Assunto:</span> <p className="text-sm font-black text-primary italic uppercase">{campaign.subject}</p></div>
                 <div className="flex items-center gap-2"><span className="text-[9px] font-black uppercase opacity-40 w-16">Preview:</span> <p className="text-xs font-medium text-muted-foreground truncate">{campaign.preheader}</p></div>
              </div>
              <div className="bg-slate-100 flex justify-center p-8 min-h-[600px]">
                 <div className={cn(
                   "bg-white shadow-lg transition-all duration-500 overflow-hidden",
                   previewMode === 'mobile' ? "w-[360px] rounded-[3rem]" : "w-full rounded-[1.5rem]"
                 )}>
                    <iframe 
                      srcDoc={campaign.contentHtml} 
                      className="w-full h-[800px] border-none"
                      title="Email Content"
                    />
                 </div>
              </div>
           </Card>
        </div>
      </div>
    </div>
  );
}
