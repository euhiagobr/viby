
'use client';

import * as React from 'react';
import { useFirestore, useDoc, useAuth, useUser } from '@/firebase';
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
  Users, 
  FileJson,
  Plus,
  Trash2,
  AlertCircle
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

const DEFAULT_CONFIG = {
  brandName: "Viby",
  brandDescription: "Plataforma de eventos que conecta organizadores e participantes.",
  objectives: [
    "aumentar vendas de ingressos",
    "aumentar participação em eventos",
    "aumentar retenção de usuários",
    "aumentar recorrência de compra",
    "ajudar organizadores a vender mais"
  ],
  toneOfVoice: {
    do: ["ser amigável", "ser moderna", "ser próxima", "ser humana", "ser positiva", "ser inclusiva"],
    dont: ["ser robótica", "ser excessivamente corporativa", "ser agressiva", "utilizar clickbait exagerado"]
  },
  userTypes: {
    lead: { description: "Pessoa que deixou contato mas não possui conta.", objective: "Converter para cadastro." },
    user: { description: "Pessoa que possui conta mas nunca comprou.", objective: "Primeira compra." },
    buyer: { description: "Pessoa que já comprou.", objective: "Nova compra." },
    recurrent: { description: "Pessoa que compra frequentemente.", objective: "Fidelização." },
    organizer: { description: "Pessoa que cria eventos.", objective: "Mais eventos publicados e mais vendas." }
  },
  globalBasePrompt: `Você é a IA oficial da Viby.\n\nA Viby é uma plataforma de eventos.\n\nSempre utilize apenas informações reais existentes na plataforma.\n\nNunca invente eventos, organizadores, datas, preços ou links.\n\nSempre priorize eventos relevantes para o público.\n\nSempre utilizar a identidade visual da Viby.\n\nSempre utilizar a logo oficial da Viby.\n\nPriorizar conversão, engajamento e participação em eventos.\n\nSempre recomendar eventos relacionados ao interesse do usuário.\n\nSempre utilizar linguagem amigável e humana.\n\nSempre destacar entre 3 e 8 eventos relevantes quando existirem.`
};

export default function AiKnowledgeBasePage() {
  const db = useFirestore();
  const auth = useAuth();
  const { user } = useUser(auth);
  const configRef = React.useMemo(() => (db ? doc(db, "settings", "ai_config") : null), [db]);
  const { data: config, loading } = useDoc<any>(configRef);

  const [localConfig, setLocalConfig] = React.useState<any>(DEFAULT_CONFIG);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (config) {
      setLocalConfig(config);
    }
  }, [config]);

  const handleSave = async () => {
    if (!db || !user) return;
    setIsSaving(true);
    try {
      await setDoc(doc(db, "settings", "ai_config"), {
        ...localConfig,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid
      }, { merge: true });
      toast({ title: "Base de Conhecimento atualizada!", description: "A IA utilizará estas novas diretrizes imediatamente." });
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
        <div>
          <h1 className="text-3xl font-black italic uppercase tracking-tighter text-primary flex items-center gap-3">
            <BrainCircuit className="w-8 h-8 text-secondary" /> Inteligência Permanente
          </h1>
          <p className="text-muted-foreground font-medium text-xs uppercase tracking-widest">Base de conhecimento mestre da IA da Viby</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="bg-secondary text-white font-black rounded-full px-8 h-12 shadow-lg gap-2 uppercase italic">
          {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} Salvar Diretrizes
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-8">
          {/* IDENTIDADE DA MARCA */}
          <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
            <CardHeader className="bg-muted/30 border-b p-8">
              <CardTitle className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-secondary" /> Conhecimento da Marca
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase opacity-60">Nome da Marca</Label>
                <Input value={localConfig.brandName} onChange={e => setLocalConfig({...localConfig, brandName: e.target.value})} className="rounded-xl h-11" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase opacity-60">Descrição / Missão</Label>
                <Textarea value={localConfig.brandDescription} onChange={e => setLocalConfig({...localConfig, brandDescription: e.target.value})} className="rounded-xl min-h-[100px] resize-none" />
              </div>
              <div className="space-y-4">
                <Label className="text-[10px] font-black uppercase opacity-60">Objetivos Estratégicos</Label>
                <div className="space-y-2">
                  {localConfig.objectives.map((obj: string, idx: number) => (
                    <div key={idx} className="flex gap-2">
                      <Input value={obj} onChange={e => {
                        const newObjs = [...localConfig.objectives];
                        newObjs[idx] = e.target.value;
                        setLocalConfig({...localConfig, objectives: newObjs});
                      }} className="rounded-xl h-10" />
                      <Button variant="ghost" size="icon" onClick={() => setLocalConfig({...localConfig, objectives: localConfig.objectives.filter((_:any, i:number) => i !== idx)})} className="text-destructive"><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => setLocalConfig({...localConfig, objectives: [...localConfig.objectives, ""]})} className="rounded-xl h-10 w-full border-dashed gap-2">
                    <Plus className="w-4 h-4" /> Adicionar Objetivo
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* TOM DE VOZ */}
          <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
            <CardHeader className="bg-muted/30 border-b p-8">
              <CardTitle className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2">
                <Mic2 className="w-5 h-5 text-secondary" /> Tom de Voz
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <Label className="text-[10px] font-black uppercase text-green-600 tracking-widest">O que fazer (Do)</Label>
                <div className="space-y-2">
                  {localConfig.toneOfVoice.do.map((t: string, idx: number) => (
                    <div key={idx} className="flex gap-2">
                      <Input value={t} onChange={e => {
                        const newDo = [...localConfig.toneOfVoice.do];
                        newDo[idx] = e.target.value;
                        setLocalConfig({...localConfig, toneOfVoice: {...localConfig.toneOfVoice, do: newDo}});
                      }} className="rounded-xl h-10" />
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                <Label className="text-[10px] font-black uppercase text-destructive tracking-widest">O que evitar (Don't)</Label>
                <div className="space-y-2">
                  {localConfig.toneOfVoice.dont.map((t: string, idx: number) => (
                    <div key={idx} className="flex gap-2">
                      <Input value={t} onChange={e => {
                        const newDont = [...localConfig.toneOfVoice.dont];
                        newDont[idx] = e.target.value;
                        setLocalConfig({...localConfig, toneOfVoice: {...localConfig.toneOfVoice, dont: newDont}});
                      }} className="rounded-xl h-10" />
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-5 space-y-8">
          {/* PROMPT GLOBAL */}
          <Card className="border-none shadow-xl rounded-[2.5rem] bg-primary text-white overflow-hidden relative">
            <CardHeader className="p-8 border-b border-white/10">
              <CardTitle className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2">
                <Target className="w-5 h-5 text-secondary" /> Prompt Base Global
              </CardTitle>
              <CardDescription className="text-white/60 font-medium">Este é o comando mestre que a IA lê antes de cada tarefa.</CardDescription>
            </CardHeader>
            <CardContent className="p-8">
              <Textarea 
                value={localConfig.globalBasePrompt} 
                onChange={e => setLocalConfig({...localConfig, globalBasePrompt: e.target.value})} 
                className="min-h-[300px] bg-white/5 border-white/10 text-white font-mono text-xs leading-relaxed rounded-2xl resize-none focus-visible:ring-secondary/50" 
              />
              <div className="mt-6 p-4 bg-white/10 rounded-2xl border border-white/10 flex items-start gap-3">
                 <AlertCircle className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
                 <p className="text-[10px] font-medium leading-relaxed uppercase opacity-80">Alterações aqui impactam drasticamente a personalidade da IA em todos os disparos.</p>
              </div>
            </CardContent>
            <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-secondary/10 rounded-full blur-3xl" />
          </Card>

          {/* TIPOS DE USUÁRIOS */}
          <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
             <CardHeader className="bg-muted/30 border-b p-8">
                <CardTitle className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2 text-primary">
                   <Users className="w-5 h-5 text-secondary" /> Segmentos de Usuários
                </CardTitle>
             </CardHeader>
             <CardContent className="p-0">
                <div className="divide-y">
                   {Object.entries(localConfig.userTypes).map(([key, data]: [string, any]) => (
                     <div key={key} className="p-6 space-y-3">
                        <div className="flex items-center justify-between">
                           <Badge variant="outline" className="font-black uppercase text-[9px] tracking-widest text-secondary border-secondary/20">{key}</Badge>
                        </div>
                        <div className="space-y-2">
                           <Label className="text-[8px] font-black uppercase opacity-40">Perfil do Público</Label>
                           <Input value={data.description} onChange={e => {
                             const newUserTypes = {...localConfig.userTypes};
                             newUserTypes[key].description = e.target.value;
                             setLocalConfig({...localConfig, userTypes: newUserTypes});
                           }} className="h-9 text-xs rounded-lg" />
                        </div>
                        <div className="space-y-2">
                           <Label className="text-[8px] font-black uppercase opacity-40">Objetivo IA</Label>
                           <Input value={data.objective} onChange={e => {
                             const newUserTypes = {...localConfig.userTypes};
                             newUserTypes[key].objective = e.target.value;
                             setLocalConfig({...localConfig, userTypes: newUserTypes});
                           }} className="h-9 text-xs rounded-lg" />
                        </div>
                     </div>
                   ))}
                </div>
             </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
