
'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useUser, useFirestore, useFirebaseApp, useCollection, useMemoFirebase } from '@/firebase';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { collection, query, where, orderBy, doc, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { 
  Loader2, 
  ArrowLeft, 
  Plus, 
  X,
  Calendar,
  Clock,
  Sparkles,
  ShieldCheck,
  Info,
  ChevronRight,
  Save,
  Users,
  Layout,
  Star,
  CheckCircle2,
  Trash2
} from 'lucide-react';
import Link from 'next/link';
import { cn, dateToAtomsphericISO } from '@/lib/utils';
import { slugify } from '@/lib/slug-utils';
import { useCurrentOrganization } from '@/contexts/OrganizationContext';
import { EventLocation, EventHeader, EventDescription } from '@/components/events';
import { IMAGE_CACHE_METADATA } from '@/lib/image-utils';
import { getOrCreateExperienceDraftAction, publishExperienceAction, saveExperienceAction } from '@/app/actions/experiences';
import { ExperienceSlotsAdmin } from '@/components/experiences/ExperienceSlotsAdmin';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

const WEEK_DAYS = [
  { id: 0, label: "Dom" },
  { id: 1, label: "Seg" },
  { id: 2, label: "Ter" },
  { id: 3, label: "Qua" },
  { id: 4, label: "Qui" },
  { id: 5, label: "Sex" },
  { id: 6, label: "Sáb" }
];

const RULE_PRESETS = [
  { id: 'no_smoking', label: 'Proibido Fumar', icon: '🚭' },
  { id: 'smoking_area', label: 'Área para Fumantes', icon: '🚬' },
  { id: 'alcohol', label: 'Venda de Bebidas', icon: '🍺' },
  { id: 'adults_only', label: 'Apenas Adultos', icon: '🔞' },
  { id: 'kids_allowed', label: 'Permitido Crianças', icon: '👶' },
  { id: 'pets_allowed', label: 'Aceita Pets', icon: '🐶' },
  { id: 'no_pets', label: 'Não aceita Pets', icon: '🚫' },
  { id: 'accessible', label: 'Acessível', icon: '♿' },
  { id: 'parking', label: 'Estacionamento', icon: '🚗' },
  { id: 'photos_ok', label: 'Fotos Permitidas', icon: '📷' },
  { id: 'no_photos', label: 'Fotos Proibidas', icon: '📵' },
  { id: 'video_ok', label: 'Filmagens OK', icon: '🎥' },
  { id: 'food_ok', label: 'Alimentação OK', icon: '🍽' },
  { id: 'drinks_ok', label: 'Bebidas OK', icon: '🥤' },
  { id: 'dress_code', label: 'Traje Obrigatório', icon: '👕' },
  { id: 'rain_or_shine', label: 'Ocorre com Chuva', icon: '🌧' },
  { id: 'cancel_ok', label: 'Cancelamento OK', icon: '♻' },
  { id: 'arrive_early', label: 'Chegue Cedo', icon: '⏰' }
];

const DEFAULT_EVENT_IMAGE = "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2FlogoUrl_1780427858048?alt=media&token=5bf01a27-8521-4a59-a78b-70c888aa0417";

export default function NovaExperienciaPage() {
  const router = useRouter()
  const auth = useAuth()
  const { user } = useUser(auth)
  const { currentOrg } = useCurrentOrganization()
  const db = useFirestore()
  const app = useFirebaseApp()
  const storage = React.useMemo(() => (app ? getStorage(app) : null), [app])

  const categoriesQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, "categories"), where("type", "==", "experience"));
  }, [db]);
  const { data: rawCategories, loading: categoriesLoading } = useCollection<any>(categoriesQuery);

  const categories = React.useMemo(() => {
    if (!rawCategories) return [];
    return [...rawCategories].sort((a, b) => a.name.localeCompare(b.name));
  }, [rawCategories]);

  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [draftId, setDraftId] = useState<string | null>(null)
  const [step, setStep] = useState(1)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [galleryProgress, setGalleryProgress] = useState<{ [key: string]: number }>({})

  const [formData, setFormData] = useState<any>({
    title: "",
    slug: "",
    category: "",
    shortDescription: "",
    description: "",
    image: DEFAULT_EVENT_IMAGE,
    gallery: [] as string[],
    capacity: 100,
    duration: "",
    maxGroupSize: null,
    isUnlimitedCapacity: false,
    instantBooking: true,
    digitalVoucher: true,
    inclusions: [] as string[],
    exclusions: [] as string[],
    rules: [] as { id: string, label: string, icon: string }[],
    faqs: [] as { q: string, a: string }[],
    steps: [] as { label: string, desc: string }[],
    usagePolicy: "",
    additionalInfo: "",
    availability: {
      startDate: "",
      endDate: "",
      allowedDays: [0, 1, 2, 3, 4, 5, 6] as number[],
      allowHolidays: true
    },
    address: {
      venueName: "", street: "", number: "", complement: "", neighborhood: "", 
      city: "", state: "", country: "Brasil", countryCode: "BR", postalCode: "", 
      latitude: null, longitude: null, formattedAddress: ""
    }
  })

  useEffect(() => {
    if (!user || !currentOrg) return;

    const init = async () => {
      const res = await getOrCreateExperienceDraftAction(user.uid, currentOrg.id);
      if (res.success) {
        setDraftId(res.id);
        if (res.data && Object.keys(res.data).length > 0) {
          const draftData = res.data;
          setFormData(prev => ({
            ...prev,
            ...draftData,
            gallery: draftData.gallery || [],
            address: draftData.address || prev.address,
            availability: draftData.availability || prev.availability,
            inclusions: draftData.inclusions || [],
            exclusions: draftData.exclusions || [],
            rules: draftData.rules || [],
            faqs: draftData.faqs || [],
            steps: draftData.steps || []
          }));
        }
      }
      setLoading(false);
    };

    init();
  }, [user, currentOrg]);

  const handleImageUpload = async (file: File) => {
    if (!storage || !user || !draftId) return;
    setUploadProgress(0);
    try {
      const storageRef = ref(storage, `experiences/${draftId}/cover_${Date.now()}`);
      const uploadTask = uploadBytesResumable(storageRef, file, IMAGE_CACHE_METADATA);
      
      uploadTask.on('state_changed', 
        (snapshot) => setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
        () => { setUploadProgress(null); toast({ variant: "destructive", title: "Erro no upload" }); },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          setFormData(prev => ({ ...prev, image: downloadURL }));
          setUploadProgress(null);
          toast({ title: "Capa carregada!" });
        }
      );
    } catch (e) {
      setUploadProgress(null);
    }
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !storage || !user || !draftId) return;
    
    if (formData.gallery.length + files.length > 5) {
      toast({ variant: "destructive", title: "Limite atingido", description: "Máximo de 5 fotos." });
      return;
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const uploadId = Math.random().toString(36).substring(7);
      const storageRef = ref(storage, `experiences/${draftId}/gallery_${Date.now()}_${i}`);
      const uploadTask = uploadBytesResumable(storageRef, file, IMAGE_CACHE_METADATA);

      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setGalleryProgress(prev => ({ ...prev, [uploadId]: progress }));
        },
        null,
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          setFormData(prev => ({ ...prev, gallery: [...prev.gallery, url] }));
          setGalleryProgress(prev => {
            const next = { ...prev };
            delete next[uploadId];
            return next;
          });
        }
      );
    }
  };

  const nextStep = async () => {
    if (step === 1 && !formData.category) {
      toast({ variant: "destructive", title: "Categoria obrigatória" });
      return;
    }
    if (step === 2 && (!formData.address.latitude || !formData.address.longitude)) {
      toast({ variant: "destructive", title: "Localização obrigatória" });
      return;
    }
    if (step === 3 && !formData.availability.startDate) {
      toast({ variant: "destructive", title: "Data de início obrigatória" });
      return;
    }

    if (draftId) {
      await saveExperienceAction(draftId, formData);
    }

    setStep(prev => prev + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePublish = async () => {
    if (!draftId || !currentOrg || publishing) return;
    setPublishing(true);
    try {
      const res = await publishExperienceAction(draftId, {
        ...formData,
        organizationId: currentOrg.id,
      });

      if (res.success) {
        toast({ title: "Experiência Publicada!" });
        router.push(`/dashboard/organizacoes/${currentOrg.username}/experiencias`);
      } else throw new Error(res.error);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro na publicação", description: e.message });
      setPublishing(false);
    }
  };

  if (loading) return <div className="flex justify-center py-32"><Loader2 className="animate-spin text-secondary w-12 h-12" /></div>

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-20 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild><Link href={`/dashboard/organizacoes/${currentOrg?.username}/experiencias`}><ArrowLeft className="w-5 h-5" /></Link></Button>
          <div>
            <h1 className="text-3xl font-black italic uppercase tracking-tighter text-primary">Nova Experiência</h1>
            <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest">Passo {step} de 5</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
           {[1, 2, 3, 4, 5].map(s => (
             <div key={s} className={cn("h-1.5 rounded-full transition-all", s <= step ? "w-8 bg-secondary" : "w-4 bg-muted")} />
           ))}
        </div>
      </div>

      {step === 1 && (
        <div className="space-y-8 animate-in slide-in-from-right-4">
           <EventHeader 
              title={formData.title} 
              onTitleChange={v => setFormData({...formData, title: v, slug: slugify(v)})} 
              image={formData.image} 
              onImageUpload={handleImageUpload} 
              uploadProgress={uploadProgress} 
           />

           <Card className="border-none shadow-sm rounded-[2rem] bg-white p-8 space-y-8">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase opacity-60">Categoria (Obrigatório)</Label>
                <Select value={formData.category} onValueChange={v => setFormData({...formData, category: v})}>
                  <SelectTrigger className="rounded-xl h-11">
                    <SelectValue placeholder={categoriesLoading ? "Carregando..." : "Selecione a categoria"} />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {categories.map((c: any) => (
                      <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase opacity-60">Descrição Curta (Vitrine)</Label>
                <Input value={formData.shortDescription} onChange={e => setFormData({...formData, shortDescription: e.target.value})} maxLength={120} className="rounded-xl h-11" placeholder="Uma frase chamativa..." />
              </div>

              <EventDescription value={formData.description} onChange={v => setFormData({...formData, description: v})} />
           </Card>

           <Card className="border-none shadow-sm rounded-[2rem] bg-white p-8 space-y-6">
              <div className="flex items-center justify-between">
                 <Label className="text-[10px] font-black uppercase opacity-60">Galeria de Fotos (Opcional - Máx 5)</Label>
                 <Badge variant="outline" className="text-[8px] font-black uppercase">{formData.gallery.length}/5</Badge>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                 {formData.gallery.map((url, i) => (
                   <div key={i} className="relative aspect-square rounded-2xl overflow-hidden group border shadow-sm">
                      <img src={url} className="w-full h-full object-cover" />
                      <button type="button" onClick={() => setFormData(prev => ({ ...prev, gallery: prev.gallery.filter((_, idx) => idx !== i) }))} className="absolute top-2 right-2 p-1 bg-destructive text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-4 h-4" /></button>
                   </div>
                 ))}
                 {formData.gallery.length < 5 && (
                   <label className="aspect-square rounded-2xl border-2 border-dashed border-muted-foreground/20 flex flex-col items-center justify-center cursor-pointer hover:bg-muted transition-all relative overflow-hidden">
                      {Object.keys(galleryProgress).length > 0 ? (
                         <Loader2 className="w-6 h-6 animate-spin text-secondary" />
                      ) : (
                         <Plus className="w-6 h-6 opacity-40" />
                      )}
                      <input type="file" multiple accept="image/*" className="hidden" onChange={handleGalleryUpload} />
                   </label>
                 )}
              </div>
           </Card>

           <Button onClick={nextStep} className="w-full h-16 bg-primary text-white font-black rounded-2xl uppercase italic text-lg gap-2 shadow-xl shadow-primary/10">Localização <ChevronRight className="w-5 h-5" /></Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-8 animate-in slide-in-from-right-4">
           <EventLocation address={formData.address} onChange={v => setFormData({...formData, address: v})} />
           <div className="flex gap-4">
              <Button variant="ghost" onClick={() => setStep(1)} className="h-16 px-8 rounded-2xl font-bold uppercase text-xs">Voltar</Button>
              <Button onClick={nextStep} className="flex-1 h-16 bg-primary text-white font-black rounded-2xl shadow-xl uppercase italic text-lg gap-2 shadow-xl shadow-primary/10">Disponibilidade <ChevronRight className="w-5 h-5" /></Button>
           </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-8 animate-in slide-in-from-right-4">
           <Card className="border-none shadow-sm rounded-[2rem] bg-white p-8 space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">Início da Experiência (Dia)</Label>
                    <Input type="date" value={formData.availability.startDate} onChange={e => setFormData({...formData, availability: {...formData.availability, startDate: e.target.value}})} className="rounded-xl h-11" />
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">Término Final (Dia)</Label>
                    <Input type="date" value={formData.availability.endDate} onChange={e => setFormData({...formData, availability: {...formData.availability, endDate: e.target.value}})} className="rounded-xl h-11" />
                 </div>
              </div>

              <div className="space-y-6">
                 <Label className="text-[10px] font-black uppercase opacity-60">Dias da Semana de Funcionamento</Label>
                 <div className="flex flex-wrap gap-3">
                    {WEEK_DAYS.map(day => (
                      <div key={day.id} className="flex items-center space-x-2 bg-muted/30 px-4 py-3 rounded-2xl border transition-all hover:bg-white shadow-sm">
                        <Checkbox 
                          id={`day-${day.id}`} 
                          checked={formData.availability.allowedDays.includes(day.id)} 
                          onCheckedChange={(checked) => {
                            const days = checked 
                              ? [...formData.availability.allowedDays, day.id] 
                              : formData.availability.allowedDays.filter(d => d !== day.id);
                            setFormData({...formData, availability: {...formData.availability, allowedDays: days}});
                          }}
                        />
                        <label htmlFor={`day-${day.id}`} className="text-[10px] font-black uppercase cursor-pointer select-none">{day.label}</label>
                      </div>
                    ))}
                 </div>
              </div>

              <div className="flex items-center justify-between p-5 bg-secondary/5 rounded-[1.5rem] border border-secondary/10">
                 <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-secondary" />
                    <div><p className="text-sm font-bold uppercase italic text-primary">Operar em Feriados?</p></div>
                 </div>
                 <Switch checked={formData.availability.allowHolidays} onCheckedChange={v => setFormData({...formData, availability: {...formData.availability, allowHolidays: v}})} />
              </div>
           </Card>

           <div className="flex gap-4">
              <Button variant="ghost" onClick={() => setStep(2)} className="h-16 px-8 rounded-2xl font-bold uppercase text-xs">Voltar</Button>
              <Button onClick={nextStep} className="flex-1 h-16 bg-primary text-white font-black rounded-2xl uppercase italic text-lg gap-2 shadow-xl shadow-primary/10">Informações Complementares <ChevronRight className="w-5 h-5" /></Button>
           </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-10 animate-in slide-in-from-right-4">
           {/* OPERACIONAL */}
           <Card className="border-none shadow-sm rounded-[2rem] bg-white p-8 space-y-8">
              <div className="flex items-center gap-3">
                 <div className="p-2 bg-secondary/10 rounded-lg text-secondary"><Zap className="w-5 h-5" /></div>
                 <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary">Destaques Rápidos</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">Tempo de Duração</Label>
                    <Input 
                      value={formData.duration} 
                      onChange={e => setFormData({...formData, duration: e.target.value})} 
                      placeholder="Ex: 3 horas, Dia inteiro..." 
                      className="rounded-xl h-11" 
                    />
                 </div>
                 <div className="space-y-2">
                    <div className="flex justify-between items-center">
                       <Label className="text-[10px] font-black uppercase opacity-60">Participantes por grupo</Label>
                       <div className="flex items-center gap-2">
                          <span className="text-[8px] font-black uppercase opacity-40">Ilimitado</span>
                          <Switch 
                            checked={formData.isUnlimitedCapacity} 
                            onCheckedChange={v => setFormData({...formData, isUnlimitedCapacity: v, maxGroupSize: v ? null : formData.maxGroupSize})} 
                          />
                       </div>
                    </div>
                    <Input 
                      type="number"
                      disabled={formData.isUnlimitedCapacity}
                      value={formData.maxGroupSize || ""} 
                      onChange={e => setFormData({...formData, maxGroupSize: parseInt(e.target.value) || null})} 
                      placeholder="Ex: 10" 
                      className="rounded-xl h-11" 
                    />
                 </div>
              </div>
           </Card>

           {/* LISTAS DINÂMICAS */}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <ListManager 
                title="O que está incluso" 
                icon={CheckCircle2} 
                items={formData.inclusions} 
                onUpdate={items => setFormData({...formData, inclusions: items})} 
                placeholder="Ex: Café da manhã"
                color="green"
              />
              <ListManager 
                title="O que não inclui" 
                icon={XCircle} 
                items={formData.exclusions} 
                onUpdate={items => setFormData({...formData, exclusions: items})} 
                placeholder="Ex: Transporte"
                color="red"
              />
           </div>

           {/* REGRAS E POLÍTICAS */}
           <Card className="border-none shadow-sm rounded-[2rem] bg-white p-8 space-y-6">
              <div className="flex items-center gap-3">
                 <div className="p-2 bg-primary/5 rounded-lg text-primary"><ShieldCheck className="w-5 h-5" /></div>
                 <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary">Regras e Políticas</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                 {RULE_PRESETS.map(rule => {
                   const isSelected = formData.rules.some((r:any) => r.id === rule.id);
                   return (
                     <button
                       key={rule.id}
                       type="button"
                       onClick={() => {
                         const next = isSelected 
                           ? formData.rules.filter((r:any) => r.id !== rule.id)
                           : [...formData.rules, rule];
                         setFormData({...formData, rules: next});
                       }}
                       className={cn(
                         "p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all",
                         isSelected ? "border-secondary bg-secondary/5 text-primary" : "border-border bg-white text-muted-foreground hover:bg-muted"
                       )}
                     >
                        <span className="text-2xl">{rule.icon}</span>
                        <span className="text-[8px] font-black uppercase tracking-tight text-center">{rule.label}</span>
                     </button>
                   );
                 })}
              </div>
           </Card>

           {/* FAQ E TIMELINE */}
           <Card className="border-none shadow-sm rounded-[2rem] bg-white p-8 space-y-10">
              <div className="space-y-4">
                 <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Timeline: Como Funciona? (Opcional)</Label>
                 <TimelineManager 
                   steps={formData.steps} 
                   onUpdate={steps => setFormData({...formData, steps: steps})} 
                 />
              </div>
              <Separator className="border-dashed" />
              <div className="space-y-4">
                 <Label className="text-[10px] font-black uppercase opacity-60 ml-1">FAQ: Dúvidas Frequentes (Opcional)</Label>
                 <FaqManager 
                   faqs={formData.faqs} 
                   onUpdate={faqs => setFormData({...formData, faqs: faqs})} 
                 />
              </div>
           </Card>

           <div className="flex gap-4">
              <Button variant="ghost" onClick={() => setStep(3)} className="h-16 px-8 rounded-2xl font-bold uppercase text-xs">Voltar</Button>
              <Button onClick={nextStep} className="flex-1 h-16 bg-primary text-white font-black rounded-2xl shadow-xl uppercase italic text-lg gap-2 shadow-xl shadow-primary/10">Definir Horários <ChevronRight className="w-5 h-5" /></Button>
           </div>
        </div>
      )}

      {step === 5 && (
        <div className="space-y-8 animate-in slide-in-from-right-4">
           <ExperienceSlotsAdmin experienceId={draftId!} />
           
           <div className="p-6 bg-orange-50 rounded-2xl border-2 border-dashed border-orange-200 flex items-start gap-4">
              <ShieldCheck className="w-6 h-6 text-orange-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                 <h4 className="font-black uppercase text-xs italic text-orange-800">Conformidade de Marketplace</h4>
                 <p className="text-[10px] text-orange-700 font-medium leading-relaxed uppercase">
                    Ao publicar, sua experiência entrará no catálogo Viby. Certifique-se de que os horários e preços promocionais estão corretos.
                 </p>
              </div>
           </div>

           <div className="flex gap-4 pt-4">
              <Button variant="ghost" onClick={() => setStep(4)} className="h-20 px-8 rounded-[2.5rem] font-bold uppercase text-xs">Voltar</Button>
              <Button 
                onClick={handlePublish} 
                disabled={publishing} 
                className="flex-1 h-20 bg-secondary text-white font-black rounded-[2.5rem] shadow-2xl shadow-secondary/30 uppercase italic text-xl gap-3 transition-all active:scale-95"
              >
                 {publishing ? <Loader2 className="w-8 h-8 animate-spin" /> : <Sparkles className="w-8 h-8" />}
                 Publicar Experiência
              </Button>
           </div>
        </div>
      )}
    </div>
  )
}

function ListManager({ title, icon: Icon, items, onUpdate, placeholder, color }: any) {
  const [input, setInput] = useState("");
  const handleAdd = () => {
    if (!input.trim()) return;
    onUpdate([...items, input.trim()]);
    setInput("");
  };
  const remove = (idx: number) => onUpdate(items.filter((_:any, i:number) => i !== idx));

  return (
    <Card className="border-none shadow-sm rounded-[2rem] bg-white p-8 space-y-6">
       <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-lg", color === 'green' ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600")}>
             <Icon className="w-5 h-5" />
          </div>
          <h4 className="font-black uppercase italic text-sm text-primary">{title}</h4>
       </div>
       <div className="flex gap-2">
          <Input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAdd())} placeholder={placeholder} className="rounded-xl" />
          <Button type="button" onClick={handleAdd} size="icon" className="shrink-0 bg-primary text-white rounded-xl"><Plus className="w-4 h-4" /></Button>
       </div>
       <div className="space-y-2">
          {items.map((item: string, i: number) => (
            <div key={i} className="flex items-center justify-between p-3 bg-muted/30 rounded-xl group border border-transparent hover:border-border">
               <span className="text-xs font-bold uppercase text-primary/70">{item}</span>
               <button type="button" onClick={() => remove(i)} className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
       </div>
    </Card>
  )
}

function TimelineManager({ steps, onUpdate }: { steps: any[], onUpdate: (s: any[]) => void }) {
  const add = () => onUpdate([...steps, { label: "", desc: "" }]);
  const update = (idx: number, field: string, val: string) => {
    const n = [...steps]; n[idx][field] = val; onUpdate(n);
  };
  const remove = (idx: number) => onUpdate(steps.filter((_, i) => i !== idx));

  return (
    <div className="space-y-3">
       {steps.map((s, i) => (
         <div key={i} className="p-4 bg-muted/20 rounded-2xl border border-dashed flex gap-3 items-start group">
            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center font-black italic text-xs text-secondary shrink-0 shadow-sm">{i+1}</div>
            <div className="flex-1 space-y-2">
               <Input value={s.label} onChange={e => update(i, 'label', e.target.value)} placeholder="Título do passo..." className="h-9 text-xs font-bold uppercase rounded-lg" />
               <Input value={s.desc} onChange={e => update(i, 'desc', e.target.value)} placeholder="Breve descrição..." className="h-8 text-[10px] rounded-lg" />
            </div>
            <button onClick={() => remove(i)} className="p-2 text-destructive opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4" /></button>
         </div>
       ))}
       <Button type="button" variant="ghost" onClick={add} className="w-full border-2 border-dashed h-10 rounded-xl font-black uppercase text-[9px] gap-2"><Plus className="w-3 h-3" /> Adicionar Passo na Jornada</Button>
    </div>
  )
}

function FaqManager({ faqs, onUpdate }: { faqs: any[], onUpdate: (s: any[]) => void }) {
  const add = () => onUpdate([...faqs, { q: "", a: "" }]);
  const update = (idx: number, field: string, val: string) => {
    const n = [...faqs]; n[idx][field] = val; onUpdate(n);
  };
  const remove = (idx: number) => onUpdate(faqs.filter((_, i) => i !== idx));

  return (
    <div className="space-y-4">
       {faqs.map((f, i) => (
         <div key={i} className="p-5 bg-white rounded-2xl border shadow-sm space-y-3 group relative">
            <div className="space-y-1">
               <Label className="text-[8px] font-black uppercase opacity-40">Pergunta</Label>
               <Input value={f.q} onChange={e => update(i, 'q', e.target.value)} className="h-9 font-bold" />
            </div>
            <div className="space-y-1">
               <Label className="text-[8px] font-black uppercase opacity-40">Resposta</Label>
               <Textarea value={f.a} onChange={e => update(i, 'a', e.target.value)} className="min-h-[60px] text-xs resize-none" />
            </div>
            <button onClick={() => remove(i)} className="absolute top-2 right-2 p-2 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-3.5 h-3.5" /></button>
         </div>
       ))}
       <Button type="button" variant="ghost" onClick={add} className="w-full border-2 border-dashed h-10 rounded-xl font-black uppercase text-[9px] gap-2"><Plus className="w-3 h-3" /> Nova Pergunta</Button>
    </div>
  )
}
