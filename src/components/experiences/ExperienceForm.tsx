'use client';

import * as React from 'react';
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { 
  Plus, 
  X, 
  ChevronRight, 
  ChevronLeft, 
  Save, 
  Loader2, 
  Camera, 
  Upload,
  Zap,
  CheckCircle2,
  XCircle,
  Trash2,
  HelpCircle,
  Clock,
  Users
} from 'lucide-react';
import { EventHeader, EventDescription, EventLocation } from '@/components/events';
import { EXPERIENCE_CHARACTERISTICS, EXPERIENCE_RULES, EXPERIENCE_INCLUSIONS, FAQ_PRESETS } from '@/lib/experience-catalog';
import { ExperienceSlotsAdmin } from './ExperienceSlotsAdmin';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

interface ExperienceFormProps {
  initialData: any;
  onSave: (data: any) => Promise<void>;
  onPublish?: (data: any) => Promise<void>;
  isEditing?: boolean;
  categories: any[];
}

export function ExperienceForm({ initialData, onSave, onPublish, isEditing, categories }: ExperienceFormProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(initialData);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const handleNext = async () => {
    setLoading(true);
    try {
      await onSave(formData);
      setStep(prev => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => setStep(prev => prev - 1);

  const handleSave = async () => {
    setLoading(true);
    try {
      if (onPublish && !isEditing) {
        await onPublish(formData);
      } else {
        await onSave(formData);
        toast({ title: "Alterações salvas!" });
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao salvar", description: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-10">
      {/* STEP 1: ESSENCIAL */}
      {step === 1 && (
        <div className="space-y-8 animate-in slide-in-from-right-4">
           <EventHeader 
              title={formData.title} 
              onTitleChange={v => setFormData({...formData, title: v})} 
              image={formData.image} 
              onImageUpload={async (file) => { /* handle upload logic */ }} 
              uploadProgress={uploadProgress} 
           />
           <Card className="border-none shadow-sm rounded-[2rem] bg-white p-8 space-y-8">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase opacity-60">Categoria</Label>
                <Select value={formData.category} onValueChange={v => setFormData({...formData, category: v})}>
                  <SelectTrigger className="rounded-xl h-11">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {categories.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase opacity-60">Descrição Curta (Vitrine)</Label>
                <Input value={formData.shortDescription} onChange={e => setFormData({...formData, shortDescription: e.target.value})} maxLength={120} className="rounded-xl h-11" />
              </div>
              <EventDescription value={formData.description} onChange={v => setFormData({...formData, description: v})} />
           </Card>
           <Button onClick={handleNext} className="w-full h-16 bg-primary text-white font-black rounded-2xl uppercase italic text-lg gap-2">Localização <ChevronRight className="w-5 h-5" /></Button>
        </div>
      )}

      {/* STEP 2: ONDE */}
      {step === 2 && (
        <div className="space-y-8 animate-in slide-in-from-right-4">
           <EventLocation address={formData.address} onChange={v => setFormData({...formData, address: v})} />
           <div className="flex gap-4">
              <Button variant="ghost" onClick={handleBack} className="h-16 px-8 rounded-2xl font-bold uppercase text-xs">Voltar</Button>
              <Button onClick={handleNext} className="flex-1 h-16 bg-primary text-white font-black rounded-2xl shadow-xl uppercase italic text-lg gap-2">Atributos e Detalhes <ChevronRight className="w-5 h-5" /></Button>
           </div>
        </div>
      )}

      {/* STEP 3: ATRIBUTOS E DETALHES */}
      {step === 3 && (
        <div className="space-y-10 animate-in slide-in-from-right-4">
           <Card className="border-none shadow-sm rounded-[2rem] bg-white p-8 space-y-8">
              <div className="flex items-center gap-3">
                 <div className="p-2 bg-secondary/10 rounded-lg text-secondary"><Zap className="w-5 h-5" /></div>
                 <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary">Informações Rápidas</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase opacity-60">Duração</Label>
                    <div className="flex gap-2">
                       <Input type="number" value={formData.duration?.value || ""} onChange={e => setFormData({...formData, duration: {...formData.duration, value: e.target.value}})} className="rounded-xl h-11 flex-1" />
                       <Select value={formData.duration?.unit || "horas"} onValueChange={v => setFormData({...formData, duration: {...formData.duration, unit: v}})}>
                          <SelectTrigger className="w-32 h-11 rounded-xl"><SelectValue /></SelectTrigger>
                          <SelectContent className="rounded-xl"><SelectItem value="minutos">Minutos</SelectItem><SelectItem value="horas">Horas</SelectItem><SelectItem value="dias">Dias</SelectItem></SelectContent>
                       </Select>
                    </div>
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">Para grupos de até (número) de pessoas</Label>
                    <Input type="number" value={formData.maxGroupSize || ""} onChange={e => setFormData({...formData, maxGroupSize: e.target.value})} className="rounded-xl h-11" placeholder="Ex: 10" />
                 </div>
              </div>

              <Separator className="border-dashed" />

              <div className="space-y-4">
                 <Label className="text-[10px] font-black uppercase opacity-60">Características (Checklist)</Label>
                 <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {EXPERIENCE_CHARACTERISTICS.map(char => {
                      const isSelected = formData.characteristics?.includes(char.id);
                      return (
                        <button
                          key={char.id}
                          type="button"
                          onClick={() => {
                            const current = formData.characteristics || [];
                            const next = isSelected ? current.filter(c => c !== char.id) : [...current, char.id];
                            setFormData({...formData, characteristics: next});
                          }}
                          className={cn("p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all", isSelected ? "border-secondary bg-secondary/5 text-primary" : "border-border bg-white text-muted-foreground")}
                        >
                           <char.icon className="w-5 h-5" />
                           <span className="text-[8px] font-black uppercase text-center">{char.label}</span>
                        </button>
                      );
                    })}
                 </div>
              </div>
           </Card>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <ListManager title="O que está incluso" icon={CheckCircle2} items={formData.inclusions || []} onUpdate={items => setFormData({...formData, inclusions: items})} color="green" />
              <ListManager title="O que não está incluso" icon={XCircle} items={formData.exclusions || []} onUpdate={items => setFormData({...formData, exclusions: items})} color="red" />
           </div>

           <Card className="border-none shadow-sm rounded-[2rem] bg-white p-8 space-y-6">
              <h3 className="text-xl font-black uppercase italic text-primary">Regras e Políticas</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                 {EXPERIENCE_RULES.map(rule => {
                   const isSelected = formData.rules?.some(r => r.id === rule.id);
                   return (
                     <button
                       key={rule.id}
                       type="button"
                       onClick={() => {
                         const current = formData.rules || [];
                         const next = isSelected ? current.filter(r => r.id !== rule.id) : [...current, { id: rule.id, label: rule.label }];
                         setFormData({...formData, rules: next});
                       }}
                       className={cn("p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all", isSelected ? "border-secondary bg-secondary/5 text-primary" : "border-border bg-white text-muted-foreground")}
                     >
                        <rule.icon className="w-5 h-5" />
                        <span className="text-[8px] font-black uppercase text-center">{rule.label}</span>
                     </button>
                   );
                 })}
              </div>
           </Card>

           <Card className="border-none shadow-sm rounded-[2rem] bg-white p-8 space-y-6">
              <div className="flex items-center justify-between">
                 <div className="flex items-center gap-3">
                    <HelpCircle className="w-6 h-6 text-secondary" />
                    <h3 className="text-xl font-black uppercase italic text-primary">FAQ (Perguntas Frequentes)</h3>
                 </div>
              </div>
              <div className="space-y-6">
                 <div className="flex flex-wrap gap-2 p-4 bg-muted/20 rounded-2xl border border-dashed">
                    <span className="text-[8px] font-black uppercase opacity-40 w-full mb-2">Sugestões da Biblioteca:</span>
                    {FAQ_PRESETS.map(q => {
                      const isAdded = formData.faqs?.some(f => f.q === q);
                      return (
                        <Button 
                          key={q} 
                          type="button" 
                          variant="outline" 
                          size="sm" 
                          disabled={isAdded}
                          onClick={() => setFormData({...formData, faqs: [...(formData.faqs || []), { q, a: "" }]})}
                          className="h-8 rounded-lg text-[9px] font-bold uppercase gap-1"
                        >
                           <Plus className="w-3 h-3" /> {q}
                        </Button>
                      );
                    })}
                 </div>
                 <div className="space-y-4">
                    {(formData.faqs || []).map((f, i) => (
                      <div key={i} className="p-6 bg-white rounded-[1.5rem] border shadow-sm space-y-4 group relative">
                         <button onClick={() => setFormData({...formData, faqs: formData.faqs.filter((_, idx) => idx !== i)})} className="absolute top-4 right-4 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-4 h-4" /></button>
                         <div className="space-y-1">
                            <Label className="text-[8px] font-black uppercase opacity-40">Pergunta</Label>
                            <Input value={f.q} onChange={e => {
                               const next = [...formData.faqs]; next[i].q = e.target.value; setFormData({...formData, faqs: next});
                            }} className="h-10 font-bold rounded-xl" />
                         </div>
                         <div className="space-y-1">
                            <Label className="text-[8px] font-black uppercase opacity-40">Resposta</Label>
                            <Textarea value={f.a} onChange={e => {
                               const next = [...formData.faqs]; next[i].a = e.target.value; setFormData({...formData, faqs: next});
                            }} className="min-h-[80px] rounded-xl resize-none" placeholder="Digite a resposta aqui..." />
                         </div>
                      </div>
                    ))}
                    <Button type="button" variant="ghost" onClick={() => setFormData({...formData, faqs: [...(formData.faqs || []), { q: "", a: "" }]})} className="w-full border-2 border-dashed h-12 rounded-2xl font-black uppercase text-[10px] gap-2"><Plus className="w-4 h-4" /> Adicionar Pergunta Personalizada</Button>
                 </div>
              </div>
           </Card>

           <div className="flex gap-4">
              <Button variant="ghost" onClick={handleBack} className="h-16 px-8 rounded-2xl font-bold uppercase text-xs">Voltar</Button>
              <Button onClick={handleNext} className="flex-1 h-16 bg-primary text-white font-black rounded-2xl shadow-xl uppercase italic text-lg gap-2">Gerenciar Horários <ChevronRight className="w-5 h-5" /></Button>
           </div>
        </div>
      )}

      {/* STEP 4: AGENDA E HORÁRIOS */}
      {step === 4 && (
        <div className="space-y-8 animate-in slide-in-from-right-4">
           <ExperienceSlotsAdmin experienceId={formData.id} />
           <div className="flex gap-4 pt-10">
              <Button variant="ghost" onClick={handleBack} className="h-20 px-8 rounded-[2.5rem] font-bold uppercase text-xs">Voltar</Button>
              <Button 
                onClick={handleSave} 
                disabled={loading}
                className="flex-1 h-20 bg-secondary text-white font-black rounded-[2.5rem] shadow-xl uppercase italic text-xl gap-2"
              >
                 {loading ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : <Save className="w-6 h-6 mr-2" />}
                 {isEditing ? "Salvar Alterações" : "Publicar Experiência"}
              </Button>
           </div>
        </div>
      )}
    </div>
  );
}

function ListManager({ title, icon: Icon, items, onUpdate, color }: any) {
  const [input, setInput] = useState("");
  const handleAdd = () => { if (!input.trim()) return; onUpdate([...items, { label: input.trim() }]); setInput(""); };
  return (
    <Card className="border-none shadow-sm rounded-[2rem] bg-white p-8 space-y-6">
       <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-lg", color === 'green' ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600")}><Icon className="w-5 h-5" /></div>
          <h4 className="font-black uppercase italic text-sm text-primary">{title}</h4>
       </div>
       <div className="flex gap-2">
          <Input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAdd())} placeholder="Adicionar item..." className="rounded-xl" />
          <Button type="button" onClick={handleAdd} size="icon" className="shrink-0 bg-primary text-white rounded-xl"><Plus className="w-4 h-4" /></Button>
       </div>
       <div className="space-y-2">
          {(items || []).map((item: any, i: number) => (
            <div key={i} className="flex items-center justify-between p-3 bg-muted/30 rounded-xl group">
               <span className="text-xs font-bold uppercase text-primary/70">{item.label}</span>
               <button type="button" onClick={() => onUpdate(items.filter((_, idx) => idx !== i))} className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
       </div>
    </Card>
  )
}
