
'use client';

import * as React from 'react';
import { useFirestore, useDoc, useAuth, useUser } from '@/firebase';
import { doc, setDoc, serverTimestamp, increment } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Award, 
  Save, 
  Loader2, 
  Globe, 
  ImageIcon, 
  Palette, 
  Mail, 
  Phone, 
  Instagram, 
  Info,
  ShieldCheck,
  Layout,
  Type,
  History,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

const INITIAL_BRAND = {
  identity: {
    companyName: "Viby",
    tradeName: "Viby",
    slogan: "Viva o agora.",
    shortDescription: "Plataforma de eventos que conecta organizadores e participantes.",
    fullDescription: "",
    mission: "",
    vision: "",
    values: []
  },
  urls: {
    mainSite: "https://viby.club",
    adminPanel: "https://viby.club/admin",
    helpCenter: "https://viby.club/suporte/faq",
    blog: "",
    institutional: ""
  },
  logos: {
    main: "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2FlogoUrl_1780427858048?alt=media",
    horizontal: "",
    vertical: "",
    white: "",
    dark: "",
    icon: ""
  },
  visual: {
    primaryColor: "#000000",
    secondaryColor: "#2C52EE",
    accentColor: "#2C52EE",
    ctaColor: "#2C52EE",
    backgroundColor: "#f8fafc",
    textColor: "#000000",
    primaryFont: "Poppins",
    secondaryFont: "sans-serif"
  },
  contacts: {
    emails: {
      contact: "contato@viby.club",
      support: "suporte@viby.club",
      financial: "financeiro@viby.club",
      partnerships: "parcerias@viby.club",
      marketing: "marketing@viby.club"
    },
    whatsapp: {
      number: "",
      link: "",
      defaultText: ""
    },
    social: {
      instagram: "https://instagram.com/viby",
      facebook: "",
      tiktok: "",
      linkedin: "",
      x: "",
      youtube: ""
    }
  },
  support: {
    hours: "Seg-Sex, 09h às 18h",
    helpUrl: "https://viby.club/suporte/faq"
  },
  emailDefaults: {
    footerHtml: "",
    signatures: ["Equipe Viby", "Time Viby", "Suporte Viby", "Marketing Viby"]
  }
};

export default function BrandKnowledgePage() {
  const db = useFirestore();
  const auth = useAuth();
  const { user } = useUser(auth);
  
  const brandRef = React.useMemo(() => (db ? doc(db, "settings", "brand_knowledge") : null), [db]);
  const { data: brand, loading } = useDoc<any>(brandRef);

  const [formData, setFormData] = React.useState<any>(INITIAL_BRAND);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (brand) {
      setFormData(brand);
    }
  }, [brand]);

  const handleSave = async () => {
    if (!db || !user) return;
    setIsSaving(true);
    try {
      await setDoc(doc(db, "settings", "brand_knowledge"), {
        ...formData,
        version: increment(1),
        updatedAt: serverTimestamp(),
        updatedBy: user.uid
      }, { merge: true });
      toast({ title: "Identidade da Marca Atualizada!", description: "A IA utilizará estes dados em todas as novas gerações." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao salvar", description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const updateField = (path: string, value: any) => {
    const keys = path.split('.');
    setFormData((prev: any) => {
      const newData = { ...prev };
      let current = newData;
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
      return newData;
    });
  };

  if (loading) return <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-secondary" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-secondary/10 rounded-2xl text-secondary shadow-sm">
            <Award className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-black italic uppercase tracking-tighter text-primary">Conhecimento da Marca</h1>
            <p className="text-muted-foreground font-medium text-xs uppercase tracking-widest">Base de Verdade para Geração de Conteúdo</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="bg-secondary text-white font-black rounded-full px-10 h-14 shadow-xl gap-2 uppercase italic text-lg transition-all hover:scale-105">
          {isSaving ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : <Save className="w-6 h-6 mr-2" />} Salvar Identidade
        </Button>
      </div>

      <div className="p-6 bg-orange-50 rounded-[2.5rem] border-2 border-dashed border-orange-200 flex items-start gap-4 mb-8">
        <AlertTriangle className="w-6 h-6 text-orange-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="font-black uppercase text-xs italic text-orange-800">Regra de Fallback Ativa</h4>
          <p className="text-[10px] text-orange-700 font-medium leading-relaxed uppercase">
            A IA está proibida de inventar contatos, URLs ou cores. Caso um campo obrigatório esteja vazio, a geração de campanhas será bloqueada para evitar alucinações.
          </p>
        </div>
      </div>

      <Tabs defaultValue="identidade" className="space-y-8">
        <TabsList className="bg-muted/50 p-1 rounded-2xl h-14 flex-wrap overflow-x-auto shadow-inner">
          <TabsTrigger value="identidade" className="rounded-xl px-6 font-black uppercase text-[10px] tracking-tight gap-2">Identidade</TabsTrigger>
          <TabsTrigger value="visual" className="rounded-xl px-6 font-black uppercase text-[10px] tracking-tight gap-2">Visual & Logos</TabsTrigger>
          <TabsTrigger value="canais" className="rounded-xl px-6 font-black uppercase text-[10px] tracking-tight gap-2">Canais & Redes</TabsTrigger>
          <TabsTrigger value="padroes" className="rounded-xl px-6 font-black uppercase text-[10px] tracking-tight gap-2">Rodapé & Assinaturas</TabsTrigger>
        </TabsList>

        <ScrollArea className="h-[calc(100vh-400px)] pr-4">
          <TabsContent value="identidade" className="space-y-8 mt-0">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
                   <CardHeader className="bg-muted/30 border-b p-8">
                      <CardTitle className="text-xl font-black italic uppercase tracking-tighter text-primary">Apresentação</CardTitle>
                   </CardHeader>
                   <CardContent className="p-8 space-y-6">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Nome da Empresa</Label>
                        <Input value={formData.identity.companyName} onChange={e => updateField('identity.companyName', e.target.value)} className="rounded-xl h-11" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Slogan</Label>
                        <Input value={formData.identity.slogan} onChange={e => updateField('identity.slogan', e.target.value)} className="rounded-xl h-11" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Missão</Label>
                        <Textarea value={formData.identity.mission} onChange={e => updateField('identity.mission', e.target.value)} className="rounded-xl resize-none h-24" />
                      </div>
                   </CardContent>
                </Card>

                <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
                   <CardHeader className="bg-muted/30 border-b p-8">
                      <CardTitle className="text-xl font-black italic uppercase tracking-tighter text-primary">Links Oficiais</CardTitle>
                   </CardHeader>
                   <CardContent className="p-8 space-y-6">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-2"><Globe className="w-3 h-3" /> Site Principal</Label>
                        <Input value={formData.urls.mainSite} onChange={e => updateField('urls.mainSite', e.target.value)} className="rounded-xl h-11" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-2"><ShieldCheck className="w-3 h-3" /> Painel Admin</Label>
                        <Input value={formData.urls.adminPanel} onChange={e => updateField('urls.adminPanel', e.target.value)} className="rounded-xl h-11" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-2"><Info className="w-3 h-3" /> Central de Ajuda</Label>
                        <Input value={formData.urls.helpCenter} onChange={e => updateField('urls.helpCenter', e.target.value)} className="rounded-xl h-11" />
                      </div>
                   </CardContent>
                </Card>
             </div>
          </TabsContent>

          <TabsContent value="visual" className="space-y-8 mt-0">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
                   <CardHeader className="bg-muted/30 border-b p-8">
                      <CardTitle className="text-xl font-black italic uppercase tracking-tighter text-primary flex items-center gap-2"><Palette className="w-5 h-5" /> Cores do Sistema</CardTitle>
                   </CardHeader>
                   <CardContent className="p-8 space-y-6">
                      <div className="grid grid-cols-2 gap-6">
                         <ColorInput label="Primária" value={formData.visual.primaryColor} onChange={v => updateField('visual.primaryColor', v)} />
                         <ColorInput label="Secundária" value={formData.visual.secondaryColor} onChange={v => updateField('visual.secondaryColor', v)} />
                         <ColorInput label="Cor do CTA" value={formData.visual.ctaColor} onChange={v => updateField('visual.ctaColor', v)} />
                         <ColorInput label="Texto" value={formData.visual.textColor} onChange={v => updateField('visual.textColor', v)} />
                      </div>
                      <Separator className="border-dashed" />
                      <div className="grid grid-cols-2 gap-6">
                         <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-2"><Type className="w-3 h-3" /> Fonte Principal</Label>
                            <Input value={formData.visual.primaryFont} onChange={e => updateField('visual.primaryFont', e.target.value)} className="rounded-xl h-11" />
                         </div>
                      </div>
                   </CardContent>
                </Card>

                <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
                   <CardHeader className="bg-muted/30 border-b p-8">
                      <CardTitle className="text-xl font-black italic uppercase tracking-tighter text-primary flex items-center gap-2"><ImageIcon className="w-5 h-5" /> Logotipos Oficiais</CardTitle>
                   </CardHeader>
                   <CardContent className="p-8 space-y-6">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Logo Principal (SVG/PNG)</Label>
                        <Input value={formData.logos.main} onChange={e => updateField('logos.main', e.target.value)} className="rounded-xl h-11 font-mono text-[10px]" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Logo Branca (para fundos escuros)</Label>
                        <Input value={formData.logos.white} onChange={e => updateField('logos.white', e.target.value)} className="rounded-xl h-11 font-mono text-[10px]" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Ícone / Favicon</Label>
                        <Input value={formData.logos.icon} onChange={e => updateField('logos.icon', e.target.value)} className="rounded-xl h-11 font-mono text-[10px]" />
                      </div>
                   </CardContent>
                </Card>
             </div>
          </TabsContent>

          <TabsContent value="canais" className="space-y-8 mt-0">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
                   <CardHeader className="bg-muted/30 border-b p-8">
                      <CardTitle className="text-xl font-black italic uppercase tracking-tighter text-primary flex items-center gap-2"><Mail className="w-5 h-5" /> Emails de Contato</CardTitle>
                   </CardHeader>
                   <CardContent className="p-8 space-y-6">
                      <div className="grid grid-cols-1 gap-4">
                         <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase opacity-60">Suporte</Label>
                            <Input value={formData.contacts.emails.support} onChange={e => updateField('contacts.emails.support', e.target.value)} className="rounded-xl h-11" />
                         </div>
                         <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase opacity-60">Financeiro</Label>
                            <Input value={formData.contacts.emails.financial} onChange={e => updateField('contacts.emails.financial', e.target.value)} className="rounded-xl h-11" />
                         </div>
                         <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase opacity-60">Marketing</Label>
                            <Input value={formData.contacts.emails.marketing} onChange={e => updateField('contacts.emails.marketing', e.target.value)} className="rounded-xl h-11" />
                         </div>
                      </div>
                   </CardContent>
                </Card>

                <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
                   <CardHeader className="bg-muted/30 border-b p-8">
                      <CardTitle className="text-xl font-black italic uppercase tracking-tighter text-primary flex items-center gap-2"><Instagram className="w-5 h-5" /> Redes Sociais</CardTitle>
                   </CardHeader>
                   <CardContent className="p-8 space-y-6">
                      <div className="space-y-2">
                         <Label className="text-[10px] font-black uppercase opacity-60">Instagram</Label>
                         <Input value={formData.contacts.social.instagram} onChange={e => updateField('contacts.social.instagram', e.target.value)} className="rounded-xl h-11" />
                      </div>
                      <div className="space-y-2">
                         <Label className="text-[10px] font-black uppercase opacity-60">LinkedIn</Label>
                         <Input value={formData.contacts.social.linkedin} onChange={e => updateField('contacts.social.linkedin', e.target.value)} className="rounded-xl h-11" />
                      </div>
                      <div className="space-y-2">
                         <Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-2"><Phone className="w-3 h-3" /> WhatsApp (Número)</Label>
                         <Input value={formData.contacts.whatsapp.number} onChange={e => updateField('contacts.whatsapp.number', e.target.value)} className="rounded-xl h-11" />
                      </div>
                   </CardContent>
                </Card>
             </div>
          </TabsContent>

          <TabsContent value="padroes" className="space-y-8 mt-0">
             <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <Card className="lg:col-span-8 border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
                   <CardHeader className="bg-muted/30 border-b p-8">
                      <CardTitle className="text-xl font-black italic uppercase tracking-tighter text-primary flex items-center gap-2"><Layout className="w-5 h-5" /> Rodapé Institucional (Email)</CardTitle>
                   </CardHeader>
                   <CardContent className="p-8 space-y-6">
                      <div className="space-y-2">
                         <Label className="text-[10px] font-black uppercase opacity-60 ml-1">HTML do Rodapé Padrão</Label>
                         <Textarea 
                           value={formData.emailDefaults.footerHtml} 
                           onChange={e => updateField('emailDefaults.footerHtml', e.target.value)} 
                           className="min-h-[250px] rounded-2xl font-mono text-[10px] leading-relaxed" 
                           placeholder="<div style='text-align:center;'>...</div>"
                         />
                      </div>
                   </CardContent>
                </Card>

                <Card className="lg:col-span-4 border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
                   <CardHeader className="bg-muted/30 border-b p-8">
                      <CardTitle className="text-xl font-black italic uppercase tracking-tighter text-primary">Assinaturas</CardTitle>
                   </CardHeader>
                   <CardContent className="p-8 space-y-4">
                      {formData.emailDefaults.signatures.map((sig: string, idx: number) => (
                        <div key={idx} className="flex gap-2">
                           <Input value={sig} onChange={e => {
                             const n = [...formData.emailDefaults.signatures];
                             n[idx] = e.target.value;
                             updateField('emailDefaults.signatures', n);
                           }} className="rounded-xl h-10 text-xs font-bold" />
                        </div>
                      ))}
                      <p className="text-[9px] font-bold text-muted-foreground uppercase leading-tight italic px-1">A IA selecionará a assinatura mais adequada ao tom da campanha.</p>
                   </CardContent>
                </Card>
             </div>
          </TabsContent>
        </ScrollArea>
      </Tabs>

      <div className="p-6 bg-secondary/5 rounded-[2.5rem] border border-secondary/10 flex items-center justify-between">
         <div className="flex items-center gap-4">
            <div className="p-3 bg-white rounded-2xl shadow-sm"><History className="w-6 h-6 text-secondary" /></div>
            <div>
               <p className="text-[10px] font-black uppercase opacity-40">Versão do Conhecimento</p>
               <p className="text-xl font-black text-primary italic">V.{formData.version || 0}</p>
            </div>
         </div>
         <div className="text-right">
            <p className="text-[9px] font-black uppercase opacity-40">Última Atualização</p>
            <p className="text-xs font-bold text-muted-foreground uppercase">{formData.updatedAt ? new Date(formData.updatedAt.seconds * 1000).toLocaleString('pt-BR') : '---'}</p>
         </div>
      </div>
    </div>
  );
}

function ColorInput({ label, value, onChange }: { label: string, value: string, onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
       <Label className="text-[9px] font-black uppercase opacity-60 ml-1">{label}</Label>
       <div className="flex gap-2 items-center">
          <div className="w-10 h-10 rounded-xl border-2 border-white shadow-sm ring-1 ring-border" style={{ backgroundColor: value }} />
          <Input value={value} onChange={e => onChange(e.target.value)} className="h-10 rounded-xl font-mono text-[10px] flex-1" />
       </div>
    </div>
  );
}
