
'use client';

import * as React from 'react';
import { useFirestore, useDoc } from '@/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  BrainCircuit, 
  Save, 
  Loader2, 
  Sparkles, 
  Target, 
  Mic2, 
  Globe,
  Settings,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';

export default function AiKnowledgeBaseRestructuredPage() {
  const db = useFirestore();
  const configRef = React.useMemo(() => (db ? doc(db, "settings", "ai_config") : null), [db]);
  const { data: config, loading } = useDoc<any>(configRef);

  const [localConfig, setLocalConfig] = React.useState<any>({
    brandName: "Viby",
    brandDescription: "Plataforma de eventos que conecta organizadores e participantes.",
    mission: "",
    values: "",
    toneOfVoice: "",
    globalBasePrompt: ""
  });

  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (config) setLocalConfig(config);
  }, [config]);

  const handleSave = async () => {
    if (!db) return;
    setIsSaving(true);
    try {
      await setDoc(doc(db, "settings", "ai_config"), {
        ...localConfig,
        updatedAt: serverTimestamp()
      }, { merge: true });
      toast({ title: "Base de Conhecimento Atualizada!" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao salvar" });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-secondary" /></div>;

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black italic uppercase tracking-tighter text-primary flex items-center gap-3">
            <BrainCircuit className="w-8 h-8 text-secondary" /> Inteligência Permanente
          </h1>
          <p className="text-muted-foreground font-medium text-[10px] uppercase tracking-widest">Base de Verdade para Geração de Conteúdo</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="bg-secondary text-white font-black rounded-full px-8 h-12 shadow-lg gap-2 uppercase italic transition-all hover:scale-105">
          {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} Salvar Diretrizes
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-8">
          <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
            <CardHeader className="bg-muted/30 border-b p-8">
              <CardTitle className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-secondary" /> Identidade da Empresa
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Nome da Marca</Label>
                <Input value={localConfig.brandName} onChange={e => setLocalConfig({...localConfig, brandName: e.target.value})} className="rounded-xl h-11" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Missão e Valores</Label>
                <Textarea value={localConfig.mission} onChange={e => setLocalConfig({...localConfig, mission: e.target.value})} className="rounded-xl min-h-[100px] resize-none" placeholder="Qual o propósito da Viby?" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Tom de Voz</Label>
                <Textarea value={localConfig.toneOfVoice} onChange={e => setLocalConfig({...localConfig, toneOfVoice: e.target.value})} className="rounded-xl min-h-[100px] resize-none" placeholder="Ex: Amigável, humana, próxima..." />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-5 space-y-8">
          <Card className="border-none shadow-xl rounded-[2.5rem] bg-primary text-white overflow-hidden relative">
            <CardHeader className="p-8 border-b border-white/10">
              <CardTitle className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2">
                <Target className="w-5 h-5 text-secondary" /> Prompt Base Global
              </CardTitle>
              <CardDescription className="text-white/60 font-medium">Comando mestre que a IA lê antes de cada tarefa.</CardDescription>
            </CardHeader>
            <CardContent className="p-8">
              <Textarea 
                value={localConfig.globalBasePrompt} 
                onChange={e => setLocalConfig({...localConfig, globalBasePrompt: e.target.value})} 
                className="min-h-[350px] bg-white/5 border-white/10 text-white font-mono text-xs leading-relaxed rounded-2xl resize-none" 
              />
              <div className="mt-6 p-4 bg-white/10 rounded-2xl border border-white/10 flex items-start gap-3">
                 <AlertTriangle className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
                 <p className="text-[9px] font-medium leading-relaxed uppercase opacity-80">Cuidado: Alterações aqui impactam a personalidade da IA em toda a plataforma.</p>
              </div>
            </CardContent>
            <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-secondary/10 rounded-full blur-3xl" />
          </Card>
        </div>
      </div>
    </div>
  );
}
