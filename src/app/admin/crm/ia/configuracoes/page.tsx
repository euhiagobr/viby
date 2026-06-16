'use client';

import * as React from 'react';
import { useFirestore, useDoc, useAuth, useUser } from '@/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Settings, 
  Save, 
  Loader2, 
  Cpu, 
  Zap,
  ArrowLeft,
  Info,
  ShieldCheck
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import Link from 'next/link';

const DEFAULT_MODELS = {
  modelEmails: "openai/gpt-4o-mini",
  modelCampaigns: "openai/gpt-4o-mini",
  modelRecommendations: "openai/gpt-4o-mini",
  modelAutomations: "openai/gpt-4o-mini",
};

export default function AiModelSettingsPage() {
  const db = useFirestore();
  const auth = useAuth();
  const { user } = useUser(auth);
  
  const configRef = React.useMemo(() => (db ? doc(db, "settings", "ai_config") : null), [db]);
  const { data: config, loading } = useDoc<any>(configRef);

  const [models, setModels] = React.useState<any>(DEFAULT_MODELS);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (config) {
      setModels({
        modelEmails: config.modelEmails || DEFAULT_MODELS.modelEmails,
        modelCampaigns: config.modelCampaigns || DEFAULT_MODELS.modelCampaigns,
        modelRecommendations: config.modelRecommendations || DEFAULT_MODELS.modelRecommendations,
        modelAutomations: config.modelAutomations || DEFAULT_MODELS.modelAutomations,
      });
    }
  }, [config]);

  const handleSave = async () => {
    if (!db || !user) return;
    setIsSaving(true);
    try {
      await setDoc(doc(db, "settings", "ai_config"), {
        ...models,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid
      }, { merge: true });
      toast({ title: "Modelos atualizados!", description: "A arquitetura de IA agora utiliza as novas definições." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao salvar", description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-secondary" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild><Link href="/admin/crm/ia"><ArrowLeft className="w-5 h-5" /></Link></Button>
          <div>
            <h1 className="text-3xl font-black italic uppercase tracking-tighter text-primary flex items-center gap-3">
              <Cpu className="w-8 h-8 text-secondary" /> Configuração de Modelos
            </h1>
            <p className="text-muted-foreground font-medium text-xs uppercase tracking-widest">Arquitetura e Escala de IA</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="bg-secondary text-white font-black rounded-full px-8 h-12 shadow-lg gap-2 uppercase italic">
          {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} Salvar Configurações
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-1 gap-8 max-w-2xl mx-auto">
        <Card className="border-none shadow-sm rounded-[2.5rem] bg-white overflow-hidden">
          <CardHeader className="bg-muted/30 border-b p-8">
            <CardTitle className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2">
              <Zap className="w-5 h-5 text-secondary" /> Engine de Geração
            </CardTitle>
            <CardDescription className="text-xs font-bold uppercase">Utilize IDs oficiais do provedor (ex: openai/gpt-4o-mini)</CardDescription>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase opacity-60">Modelo para Emails</Label>
              <Input value={models.modelEmails} onChange={e => setModels({...models, modelEmails: e.target.value})} className="rounded-xl h-11 font-mono" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase opacity-60">Modelo para Campanhas</Label>
              <Input value={models.modelCampaigns} onChange={e => setModels({...models, modelCampaigns: e.target.value})} className="rounded-xl h-11 font-mono" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase opacity-60">Modelo para Recomendações</Label>
              <Input value={models.modelRecommendations} onChange={e => setModels({...models, modelRecommendations: e.target.value})} className="rounded-xl h-11 font-mono" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase opacity-60">Modelo para Automações</Label>
              <Input value={models.modelAutomations} onChange={e => setModels({...models, modelAutomations: e.target.value})} className="rounded-xl h-11 font-mono" />
            </div>

            <Separator className="border-dashed" />

            <div className="p-4 bg-secondary/5 rounded-2xl flex gap-3 border border-secondary/10">
               <Info className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
               <div className="space-y-1">
                  <p className="text-[10px] text-secondary font-black uppercase">Padrão Sugerido: GPT-5 Mini (gpt-4o-mini)</p>
                  <p className="text-[9px] text-secondary font-medium leading-relaxed uppercase">
                    Este modelo oferece o melhor equilíbrio entre latência, custo e qualidade para fluxos de CRM.
                  </p>
               </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
