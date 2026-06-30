
"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth, useUser, useFirestore, useFirebaseApp, useCollection, useMemoFirebase } from "@/firebase"
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage"
import { collection, query, where, orderBy, doc, serverTimestamp } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/hooks/use-toast"
import { 
  Loader2, 
  ArrowLeft, 
  Plus, 
  X,
  Calendar,
  Clock,
  Trash2,
  Sparkles,
  ShieldCheck,
  Building2,
  Info,
  CheckCircle2,
  Layout,
  Coins,
  ChevronLeft,
  ChevronRight,
  Save
} from "lucide-react"
import Link from "next/link"
import { cn, dateToAtomsphericISO } from "@/lib/utils"
import { slugify } from "@/lib/slug-utils"
import { useCurrentOrganization } from "@/contexts/OrganizationContext"
import { EventLocation, EventHeader, EventDescription } from "@/components/events"
import { IMAGE_CACHE_METADATA } from "@/lib/image-utils"
import { getOrCreateExperienceDraftAction, publishExperienceAction, saveExperienceAction } from "@/app/actions/experiences"
import { ExperienceSlotsAdmin } from "@/components/experiences/ExperienceSlotsAdmin"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"

const WEEK_DAYS = [
  { id: 0, label: "Dom" },
  { id: 1, label: "Seg" },
  { id: 2, label: "Ter" },
  { id: 3, label: "Qua" },
  { id: 4, label: "Qui" },
  { id: 5, label: "Sex" },
  { id: 6, label: "Sáb" }
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

  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    category: "",
    shortDescription: "",
    description: "",
    image: DEFAULT_EVENT_IMAGE,
    gallery: [] as string[],
    capacity: 100,
    availability: {
      startDate: "",
      endDate: "",
      allowedDays: [0, 1, 2, 3, 4, 5, 6] as number[],
      allowHolidays: true,
      baseWindows: [] as any[]
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
            availability: draftData.availability || prev.availability
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
            <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest">Passo {step} de 4</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
           {[1, 2, 3, 4].map(s => (
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
                   <label className="aspect-square rounded-2xl border-2 border-dashed border-muted-foreground/20 flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition-all relative overflow-hidden">
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
              <Button onClick={nextStep} className="flex-1 h-16 bg-primary text-white font-black rounded-2xl uppercase italic text-lg gap-2 shadow-xl shadow-primary/10">Disponibilidade <ChevronRight className="w-5 h-5" /></Button>
           </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-8 animate-in slide-in-from-right-4">
           <Card className="border-none shadow-sm rounded-[2rem] bg-white p-8 space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">Início da Experiência</Label>
                    <Input type="date" value={formData.availability.startDate} onChange={e => setFormData({...formData, availability: {...formData.availability, startDate: e.target.value}})} className="rounded-xl h-11" />
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">Término (Opcional)</Label>
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

           <Card className="border-none shadow-sm rounded-[2rem] bg-white p-8 space-y-6">
              <div className="flex items-center justify-between">
                 <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary">Horários da Agenda</h3>
                 <Button type="button" variant="outline" size="sm" onClick={() => setFormData({...formData, availability: {...formData.availability, baseWindows: [...(formData.availability.baseWindows || []), { start: "19:00", end: "22:00", label: "Aberto" }]}})} className="rounded-xl font-bold uppercase text-[10px] border-secondary text-secondary">
                    <Plus className="w-4 h-4 mr-2" /> Adicionar Janela
                 </Button>
              </div>
              
              <div className="space-y-3">
                 {formData.availability.baseWindows?.map((win, idx) => (
                   <div key={idx} className="flex items-center gap-3 p-4 bg-muted/20 rounded-2xl border border-dashed animate-in slide-in-from-left-2">
                      <Clock className="w-5 h-5 text-muted-foreground opacity-30" />
                      <Input type="time" value={win.start} onChange={e => {
                        const n = [...formData.availability.baseWindows];
                        n[idx].start = e.target.value;
                        setFormData({...formData, availability: {...formData.availability, baseWindows: n}});
                      }} className="h-10 rounded-lg w-32 font-bold" />
                      <ArrowRight className="w-4 h-4 opacity-20" />
                      <Input type="time" value={win.end} onChange={e => {
                        const n = [...formData.availability.baseWindows];
                        n[idx].end = e.target.value;
                        setFormData({...formData, availability: {...formData.availability, baseWindows: n}});
                      }} className="h-10 rounded-lg w-32 font-bold" />
                      <Input value={win.label} onChange={e => {
                        const n = [...formData.availability.baseWindows];
                        n[idx].label = e.target.value;
                        setFormData({...formData, availability: {...formData.availability, baseWindows: n}});
                      }} className="h-10 rounded-lg flex-1 text-xs" placeholder="Ex: Matinê" />
                      <button type="button" onClick={() => {
                        const n = formData.availability.baseWindows.filter((_, i) => i !== idx);
                        setFormData({...formData, availability: {...formData.availability, baseWindows: n}});
                      }} className="text-destructive"><X className="w-4 h-4" /></button>
                   </div>
                 ))}
                 {(!formData.availability.baseWindows || formData.availability.baseWindows.length === 0) && (
                   <div className="py-10 text-center opacity-30 italic text-[10px] uppercase font-bold">Nenhum horário padrão definido</div>
                 )}
              </div>
           </Card>

           <div className="flex gap-4">
              <Button variant="ghost" onClick={() => setStep(2)} className="h-16 px-8 rounded-2xl font-bold uppercase text-xs">Voltar</Button>
              <Button onClick={nextStep} className="flex-1 h-16 bg-primary text-white font-black rounded-2xl shadow-xl uppercase italic text-lg gap-2 shadow-xl shadow-primary/10">Sessões e Preços <ChevronRight className="w-5 h-5" /></Button>
           </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-8 animate-in slide-in-from-right-4">
           <ExperienceSlotsAdmin experienceId={draftId!} />
           
           <div className="p-6 bg-orange-50 rounded-[2.5rem] border-2 border-dashed border-orange-200 flex items-start gap-4">
              <ShieldCheck className="w-6 h-6 text-orange-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                 <h4 className="font-black uppercase text-xs italic text-orange-800">Conformidade de Marketplace</h4>
                 <p className="text-[10px] text-orange-700 font-medium leading-relaxed uppercase">
                    Ao publicar, sua experiência entrará no catálogo Viby. Certifique-se de que os horários e preços promocionais estão corretos.
                 </p>
              </div>
           </div>

           <div className="flex gap-4 pt-4">
              <Button variant="ghost" onClick={() => setStep(3)} className="h-20 px-8 rounded-[2.5rem] font-bold uppercase text-xs">Voltar</Button>
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
