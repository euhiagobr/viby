
"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { useDoc, useFirestore, useAuth, useUser, useFirebaseApp, useMemoFirebase, useCollection } from "@/firebase"
import { doc, collection, query, orderBy, where, serverTimestamp, updateDoc, getDocs } from "firebase/firestore"
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "@/hooks/use-toast"
import { 
  Loader2, 
  ArrowLeft, 
  Save, 
  Handshake, 
  Settings2, 
  Ticket, 
  RefreshCw, 
  Eye, 
  Star, 
  ChevronRight, 
  Check, 
  Calendar, 
  ShieldCheck, 
  MapPin,
  Clock,
  Copy,
  Trash2,
  Trophy,
  Plus,
  X,
  Zap,
  CheckCircle2,
  Upload,
  Camera,
  Info,
  XCircle
} from "lucide-react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Progress } from "@/components/ui/progress"
import { Checkbox } from "@/components/ui/checkbox"
import Link from "next/link"
import { cn, normalizeText, normalizeEventDates, safeParseDate, formatDateForInput, dateToAtomsphericISO } from "@/lib/utils"
import { slugify } from "@/lib/slug-utils"
import { useCurrentOrganization } from "@/contexts/OrganizationContext"
import { 
  EventHeader, 
  EventDescription, 
  EventLocation, 
  EventVisibility 
} from "@/components/events"
import { IMAGE_CACHE_METADATA } from "@/lib/image-utils"
import { saveExperienceAction } from "@/app/actions/experiences"
import { ExperienceSlotsAdmin } from "@/components/experiences/ExperienceSlotsAdmin"
import { Separator } from "@/components/ui/separator"

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
  { id: 'accessible', label: 'Acessível', icon: '♿' },
  { id: 'parking', label: 'Estacionamento', icon: '🚗' },
  { id: 'photos_ok', label: 'Fotos Permitidas', icon: '📷' },
  { id: 'rain_or_shine', label: 'Ocorre com Chuva', icon: '🌧' },
  { id: 'cancel_ok', label: 'Cancelamento OK', icon: '♻' },
  { id: 'arrive_early', label: 'Chegue Cedo', icon: '⏰' }
];

export default function EditarExperienciaPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.id as string
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  const app = useFirebaseApp()
  const { currentOrg } = useCurrentOrganization()
  const storage = React.useMemo(() => app ? getStorage(app) : null, [app])

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(true)
  const [isDataLoaded, setIsDataLoaded] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [galleryProgress, setGalleryProgress] = useState<{ [key: string]: number }>({})

  const [formData, setFormData] = useState<any>({
    title: "",
    slug: "",
    category: "",
    shortDescription: "",
    description: "",
    image: "",
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

  const eventRef = React.useMemo(() => {
    if (!db || !eventId) return null
    return doc(db, "experiences", eventId)
  }, [db, eventId])
  
  const { data: event, loading: eventLoading } = useDoc<any>(eventRef)

  const categoriesQuery = useMemoFirebase(() => 
    db ? query(collection(db, "categories"), where("type", "==", "experience")) : null, 
    [db]
  )
  const { data: categories } = useCollection<any>(categoriesQuery)

  useEffect(() => {
    if (event && !isDataLoaded) {
      setFormData({
        ...formData,
        ...event,
        availability: {
          startDate: formatDateForInput(event.availability?.startDate),
          endDate: formatDateForInput(event.availability?.endDate),
          allowedDays: event.availability?.allowedDays || [0, 1, 2, 3, 4, 5, 6],
          allowHolidays: event.availability?.allowHolidays ?? true
        },
        address: event.address || formData.address,
        gallery: event.gallery || [],
        inclusions: event.inclusions || [],
        exclusions: event.exclusions || [],
        rules: event.rules || [],
        faqs: event.faqs || [],
        steps: event.steps || []
      })
      setIsDataLoaded(true)
      setLoading(false)
    }
  }, [event, isDataLoaded])

  const handleImageUpload = async (file: File) => {
    if (!storage || !user || !eventId) return;
    setUploadProgress(0);
    try {
      const storageRef = ref(storage, `experiences/${eventId}/cover_${Date.now()}`);
      const uploadTask = uploadBytesResumable(storageRef, file, IMAGE_CACHE_METADATA);
      
      uploadTask.on('state_changed', 
        (snapshot) => setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
        () => setUploadProgress(null),
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
    if (!files || !storage || !user || !eventId) return;
    
    if (formData.gallery.length + files.length > 5) {
      toast({ variant: "destructive", title: "Limite atingido", description: "Máximo de 5 fotos." });
      return;
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const uploadId = Math.random().toString(36).substring(7);
      const storageRef = ref(storage, `experiences/${eventId}/gallery_${Date.now()}_${i}`);
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

  const handleSave = async () => {
    if (!eventId || loading) return;
    setLoading(true);
    try {
      const res = await saveExperienceAction(eventId, formData);
      if (res.success) {
        toast({ title: "Progresso salvo!" });
      } else throw new Error(res.error);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao salvar", description: e.message });
    } finally {
      setLoading(false);
    }
  };

  const nextStep = async () => {
    await handleSave();
    setStep(prev => prev + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (eventLoading || !isDataLoaded) {
    return (
      <div className="flex flex-col items-center justify-center py-40 gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-secondary" />
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">Sincronizando Dados...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-20 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild><Link href={`/dashboard/organizacoes/${currentOrg?.username}/experiencias`}><ArrowLeft className="w-5 h-5" /></Link></Button>
          <h1 className="text-3xl font-black italic uppercase tracking-tighter text-primary">Editar Experiência</h1>
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
                <Label className="text-[10px] font-black uppercase opacity-60">Categoria</Label>
                <Select value={formData.category} onValueChange={v => setFormData({...formData, category: v})}>
                  <SelectTrigger className="rounded-xl h-11">
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {categories?.map((c: any) => (
                      <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase opacity-60">Descrição Curta (Vitrine)</Label>
                <Input value={formData.shortDescription} onChange={e => setFormData({...formData, shortDescription: e.target.value})} maxLength={120} className="rounded-xl h-11" />
              </div>

              <EventDescription value={formData.description} onChange={v => setFormData({...formData, description: v})} />
              <EventVisibility value={formData.status} onChange={v => setFormData({...formData, status: v})} />
           </Card>

           <Card className="border-none shadow-sm rounded-[2rem] bg-white p-8 space-y-6">
              <div className="flex items-center justify-between">
                 <Label className="text-[10px] font-black uppercase opacity-60">Galeria de Fotos ({formData.gallery.length}/5)</Label>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                 {formData.gallery.map((url: string, i: number) => (
                   <div key={i} className="relative aspect-square rounded-2xl overflow-hidden group border shadow-sm">
                      <img src={url} className="w-full h-full object-cover" />
                      <button type="button" onClick={() => setFormData((prev:any) => ({ ...prev, gallery: prev.gallery.filter((_:any, idx:number) => idx !== i) }))} className="absolute top-2 right-2 p-1 bg-destructive text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-4 h-4" /></button>
                   </div>
                 ))}
                 {formData.gallery.length < 5 && (
                   <label className="aspect-square rounded-2xl border-2 border-dashed border-muted-foreground/20 flex flex-col items-center justify-center cursor-pointer hover:bg-muted transition-all relative overflow-hidden">
                      {Object.keys(galleryProgress).length > 0 ? <Loader2 className="w-6 h-6 animate-spin text-secondary" /> : <Plus className="w-6 h-6 opacity-40" />}
                      <input type="file" multiple accept="image/*" className="hidden" onChange={handleGalleryUpload} />
                   </label>
                 )}
              </div>
           </Card>

           <Button onClick={nextStep} className="w-full h-16 bg-primary text-white font-black rounded-2xl uppercase italic text-lg gap-2 shadow-xl">Localização <ChevronRight className="w-5 h-5" /></Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-8 animate-in slide-in-from-right-4">
           <EventLocation address={formData.address} onChange={v => setFormData({...formData, address: v})} />
           <div className="flex gap-4">
              <Button variant="ghost" onClick={() => setStep(1)} className="h-16 px-8 rounded-2xl font-bold uppercase text-xs">Voltar</Button>
              <Button onClick={nextStep} className="flex-1 h-16 bg-primary text-white font-black rounded-2xl shadow-xl uppercase italic text-lg gap-2">Disponibilidade <ChevronRight className="w-5 h-5" /></Button>
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
                    <Label className="text-[10px] font-black uppercase opacity-60">Término Final</Label>
                    <Input type="date" value={formData.availability.endDate} onChange={e => setFormData({...formData, availability: {...formData.availability, endDate: e.target.value}})} className="rounded-xl h-11" />
                 </div>
              </div>

              <div className="space-y-6">
                 <Label className="text-[10px] font-black uppercase opacity-60">Dias de Funcionamento</Label>
                 <div className="flex flex-wrap gap-3">
                    {WEEK_DAYS.map(day => (
                      <div key={day.id} className="flex items-center space-x-2 bg-muted/30 px-4 py-3 rounded-2xl border transition-all hover:bg-white">
                        <Checkbox 
                          id={`day-${day.id}`} 
                          checked={formData.availability.allowedDays.includes(day.id)} 
                          onCheckedChange={(checked) => {
                            const days = checked 
                              ? [...formData.availability.allowedDays, day.id] 
                              : formData.availability.allowedDays.filter((d:number) => d !== day.id);
                            setFormData({...formData, availability: {...formData.availability, allowedDays: days}});
                          }}
                        />
                        <label htmlFor={`day-${day.id}`} className="text-[10px] font-black uppercase cursor-pointer">{day.label}</label>
                      </div>
                    ))}
                 </div>
              </div>

              <div className="flex items-center justify-between p-5 bg-secondary/5 rounded-[1.5rem] border border-secondary/10">
                 <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-secondary" />
                    <p className="text-sm font-bold uppercase italic text-primary">Operar em Feriados?</p>
                 </div>
                 <Switch checked={formData.availability.allowHolidays} onCheckedChange={v => setFormData({...formData, availability: {...formData.availability, allowHolidays: v}})} />
              </div>
           </Card>

           <div className="flex gap-4">
              <Button variant="ghost" onClick={() => setStep(2)} className="h-16 px-8 rounded-2xl font-bold uppercase text-xs">Voltar</Button>
              <Button onClick={nextStep} className="flex-1 h-16 bg-primary text-white font-black rounded-2xl shadow-xl uppercase italic text-lg gap-2">Informações Complementares <ChevronRight className="w-5 h-5" /></Button>
           </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-10 animate-in slide-in-from-right-4">
           <Card className="border-none shadow-sm rounded-[2rem] bg-white p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">Tempo de Duração</Label>
                    <Input value={formData.duration} onChange={e => setFormData({...formData, duration: e.target.value})} placeholder="Ex: 3 horas" className="rounded-xl h-11" />
                 </div>
                 <div className="space-y-2">
                    <div className="flex justify-between items-center">
                       <Label className="text-[10px] font-black uppercase opacity-60">Participantes por grupo</Label>
                       <Switch checked={formData.isUnlimitedCapacity} onCheckedChange={v => setFormData({...formData, isUnlimitedCapacity: v, maxGroupSize: v ? null : formData.maxGroupSize})} />
                    </div>
                    <Input type="number" disabled={formData.isUnlimitedCapacity} value={formData.maxGroupSize || ""} onChange={e => setFormData({...formData, maxGroupSize: parseInt(e.target.value) || null})} className="rounded-xl h-11" />
                 </div>
              </div>
           </Card>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <ListManager title="O que está incluso" icon={CheckCircle2} items={formData.inclusions} onUpdate={(items:any) => setFormData({...formData, inclusions: items})} color="green" />
              <ListManager title="O que não inclui" icon={XCircle} items={formData.exclusions} onUpdate={(items:any) => setFormData({...formData, exclusions: items})} color="red" />
           </div>

           <Card className="border-none shadow-sm rounded-[2rem] bg-white p-8 space-y-6">
              <h3 className="text-xl font-black uppercase italic text-primary">Regras e Políticas</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                 {RULE_PRESETS.map(rule => {
                   const isSelected = formData.rules.some((r:any) => r.id === rule.id);
                   return (
                     <button
                       key={rule.id}
                       type="button"
                       onClick={() => {
                         const next = isSelected ? formData.rules.filter((r:any) => r.id !== rule.id) : [...formData.rules, rule];
                         setFormData({...formData, rules: next});
                       }}
                       className={cn("p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all", isSelected ? "border-secondary bg-secondary/5 text-primary" : "border-border bg-white text-muted-foreground")}
                     >
                        <span className="text-2xl">{rule.icon}</span>
                        <span className="text-[8px] font-black uppercase text-center">{rule.label}</span>
                     </button>
                   );
                 })}
              </div>
           </Card>

           <Card className="border-none shadow-sm rounded-[2rem] bg-white p-8 space-y-10">
              <TimelineManager steps={formData.steps} onUpdate={(steps:any) => setFormData({...formData, steps})} />
              <Separator className="border-dashed" />
              <FaqManager faqs={formData.faqs} onUpdate={(faqs:any) => setFormData({...formData, faqs})} />
           </Card>

           <div className="flex gap-4">
              <Button variant="ghost" onClick={() => setStep(3)} className="h-16 px-8 rounded-2xl font-bold uppercase text-xs">Voltar</Button>
              <Button onClick={nextStep} className="flex-1 h-16 bg-primary text-white font-black rounded-2xl shadow-xl uppercase italic text-lg gap-2">Gerenciar Horários <ChevronRight className="w-5 h-5" /></Button>
           </div>
        </div>
      )}

      {step === 5 && (
        <div className="space-y-8 animate-in slide-in-from-right-4">
           <ExperienceSlotsAdmin experienceId={eventId} />
           <div className="flex gap-4 pt-4">
              <Button variant="ghost" onClick={() => setStep(4)} className="h-20 px-8 rounded-[2.5rem] font-bold uppercase text-xs">Voltar</Button>
              <Button onClick={handleSave} disabled={loading} className="flex-1 h-20 bg-secondary text-white font-black rounded-[2.5rem] shadow-xl uppercase italic text-xl">
                 {loading ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : <Save className="w-6 h-6 mr-2" />} Salvar Experiência
              </Button>
           </div>
        </div>
      )}
    </div>
  )
}

function ListManager({ title, icon: Icon, items, onUpdate, color }: any) {
  const [input, setInput] = useState("");
  const handleAdd = () => { if (!input.trim()) return; onUpdate([...items, input.trim()]); setInput(""); };
  return (
    <Card className="border-none shadow-sm rounded-[2rem] bg-white p-8 space-y-6">
       <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-lg", color === 'green' ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600")}><Icon className="w-5 h-5" /></div>
          <h4 className="font-black uppercase italic text-sm text-primary">{title}</h4>
       </div>
       <div className="flex gap-2">
          <Input value={input} onChange={e => setInput(e.target.value)} placeholder="Adicionar item..." className="rounded-xl" />
          <Button type="button" onClick={handleAdd} size="icon" className="shrink-0 bg-primary text-white rounded-xl"><Plus className="w-4 h-4" /></Button>
       </div>
       <div className="space-y-2">
          {items.map((item: string, i: number) => (
            <div key={i} className="flex items-center justify-between p-3 bg-muted/30 rounded-xl group">
               <span className="text-xs font-bold uppercase text-primary/70">{item}</span>
               <button type="button" onClick={() => onUpdate(items.filter((_:any, idx:number) => idx !== i))} className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
       </div>
    </Card>
  )
}

function TimelineManager({ steps, onUpdate }: any) {
  const add = () => onUpdate([...steps, { label: "", desc: "" }]);
  const update = (idx: number, field: string, val: string) => { const n = [...steps]; n[idx][field] = val; onUpdate(n); };
  return (
    <div className="space-y-4">
       <Label className="text-[10px] font-black uppercase opacity-60">Timeline ("Como funciona")</Label>
       {steps.map((s:any, i:number) => (
         <div key={i} className="p-4 bg-muted/20 rounded-2xl border border-dashed flex gap-3 items-start group">
            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center font-black italic text-xs text-secondary shrink-0 shadow-sm">{i+1}</div>
            <div className="flex-1 space-y-2">
               <Input value={s.label} onChange={e => update(i, 'label', e.target.value)} placeholder="Título..." className="h-9 text-xs font-bold rounded-lg" />
               <Input value={s.desc} onChange={e => update(i, 'desc', e.target.value)} placeholder="Descrição..." className="h-8 text-[10px] rounded-lg" />
            </div>
            <button onClick={() => onUpdate(steps.filter((_:any, idx:number) => idx !== i))} className="p-2 text-destructive opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4" /></button>
         </div>
       ))}
       <Button type="button" variant="ghost" onClick={add} className="w-full border-2 border-dashed h-10 rounded-xl font-black uppercase text-[9px] gap-2"><Plus className="w-3 h-3" /> Adicionar Passo</Button>
    </div>
  )
}

function FaqManager({ faqs, onUpdate }: any) {
  const add = () => onUpdate([...faqs, { q: "", a: "" }]);
  const update = (idx: number, field: string, val: string) => { const n = [...faqs]; n[idx][field] = val; onUpdate(n); };
  return (
    <div className="space-y-4">
       <Label className="text-[10px] font-black uppercase opacity-60">Perguntas Frequentes (FAQ)</Label>
       {faqs.map((f:any, i:number) => (
         <div key={i} className="p-5 bg-white rounded-2xl border shadow-sm space-y-3 group relative">
            <Input value={f.q} onChange={e => update(i, 'q', e.target.value)} placeholder="Pergunta..." className="h-9 font-bold" />
            <Textarea value={f.a} onChange={e => update(i, 'a', e.target.value)} placeholder="Resposta..." className="min-h-[60px] text-xs resize-none" />
            <button onClick={() => onUpdate(faqs.filter((_:any, idx:number) => idx !== i))} className="absolute top-2 right-2 p-2 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-3.5 h-3.5" /></button>
         </div>
       ))}
       <Button type="button" variant="ghost" onClick={add} className="w-full border-2 border-dashed h-10 rounded-xl font-black uppercase text-[9px] gap-2"><Plus className="w-3 h-3" /> Nova Pergunta</Button>
    </div>
  )
}
