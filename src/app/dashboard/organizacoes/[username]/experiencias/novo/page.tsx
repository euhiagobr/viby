'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useUser, useFirestore, useFirebaseApp, useCollection, useMemoFirebase } from '@/firebase';
import { useCurrentOrganization } from '@/contexts/OrganizationContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { 
  ArrowLeft, 
  Sparkles, 
  Save, 
  Loader2, 
  Check,
  Zap,
  MapPin,
  Camera,
  Plus,
  X,
  Coins,
  Users,
  Info,
  ShieldCheck,
  Calendar,
  Layout,
  ChevronRight,
  Clock,
  ChevronLeft
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { toast } from '@/hooks/use-toast';
import { getOrCreateExperienceDraftAction, publishExperienceAction, saveExperienceAction } from '@/app/actions/experiences';
import { slugify } from '@/lib/slug-utils';
import { EventLocation, EventHeader, EventDescription } from '@/components/events';
import { IMAGE_CACHE_METADATA } from '@/lib/image-utils';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ExperienceSlotsAdmin } from '@/components/experiences/ExperienceSlotsAdmin';
import { Checkbox } from '@/components/ui/checkbox';
import { query, collection, where, orderBy } from 'firebase/firestore';

const WEEK_DAYS = [
  { id: 0, label: "Dom" },
  { id: 1, label: "Seg" },
  { id: 2, label: "Ter" },
  { id: 3, label: "Qua" },
  { id: 4, label: "Qui" },
  { id: 5, label: "Sex" },
  { id: 6, label: "Sáb" }
];

export default function NovaExperienciaPage() {
  const router = useRouter();
  const auth = useAuth();
  const { user } = useUser(auth);
  const { currentOrg } = useCurrentOrganization();
  const db = useFirestore();
  const app = useFirebaseApp();
  const storage = React.useMemo(() => (app ? getStorage(app) : null), [app]);

  // Busca categorias dinâmicas do tipo 'experience'
  const categoriesQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(
      collection(db, "categories"),
      where("type", "==", "experience"),
      orderBy("name", "asc")
    );
  }, [db]);
  const { data: categories, loading: categoriesLoading } = useCollection<any>(categoriesQuery);

  const [loading, setLoading] = React.useState(true);
  const [publishing, setPublishing] = React.useState(false);
  const [draftId, setDraftId] = React.useState<string | null>(null);
  const [step, setStep] = React.useState(1);
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null);
  const [galleryProgress, setGalleryProgress] = React.useState<{ [key: string]: number }>({});

  const [formData, setFormData] = React.useState({
    title: "",
    slug: "",
    category: "",
    shortDescription: "",
    description: "",
    image: "",
    gallery: [] as string[],
    price: 0,
    capacity: 100,
    availability: {
      startDate: "",
      endDate: "",
      allowedDays: [0, 1, 2, 3, 4, 5, 6] as number[],
      allowHolidays: true
    },
    address: {
      venueName: "",
      addressLine1: "", 
      addressLine2: "",
      streetNumber: "",
      neighborhood: "", 
      city: "", 
      stateRegion: "", 
      country: "Brasil", 
      countryCode: "BR",
      postalCode: "", 
      latitude: null, 
      longitude: null,
      formattedAddress: "",
      isCustomized: false
    }
  });

  React.useEffect(() => {
    if (!user || !currentOrg) return;

    const init = async () => {
      const res = await getOrCreateExperienceDraftAction(user.uid, currentOrg.id);
      if (res.success) {
        setDraftId(res.id);
        setFormData(prev => ({
          ...prev,
          ...res,
          gallery: res.gallery || [],
          address: res.address || prev.address,
          availability: res.availability || prev.availability
        }));
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
    
    const currentCount = formData.gallery.length;
    if (currentCount + files.length > 5) {
      toast({ variant: "destructive", title: "Limite atingido", description: "Máximo de 5 fotos na galeria." });
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
      toast({ variant: "destructive", title: "Selecione uma categoria" });
      return;
    }
    if (step === 2 && (!formData.address.latitude || !formData.address.longitude)) {
      toast({ variant: "destructive", title: "Localização obrigatória" });
      return;
    }
    if (step === 3 && !formData.availability.startDate) {
      toast({ variant: "destructive", title: "Defina a data de início" });
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

  if (loading) return <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-secondary" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild><Link href={`/dashboard/organizacoes/${currentOrg?.username}/experiencias`}><ArrowLeft className="w-5 h-5" /></Link></Button>
          <div>
            <h1 className="text-3xl font-black italic uppercase tracking-tighter text-primary">Nova Experiência</h1>
            <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest">Etapa {step} de 4</p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 mb-8">
        {[1, 2, 3, 4].map(s => (
          <div key={s} className={cn("h-1.5 flex-1 rounded-full transition-all", s <= step ? "bg-secondary" : "bg-muted")} />
        ))}
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">Categoria (Obrigatório)</Label>
                    <Select value={formData.category} onValueChange={v => setFormData({...formData, category: v})}>
                       <SelectTrigger className="rounded-xl h-11">
                          <SelectValue placeholder={categoriesLoading ? "Carregando..." : "Selecione"} />
                       </SelectTrigger>
                       <SelectContent className="rounded-xl">
                          {categories?.map((c: any) => (
                             <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                          ))}
                          {!categoriesLoading && categories?.length === 0 && (
                             <SelectItem value="none" disabled>Nenhuma categoria de experiência cadastrada</SelectItem>
                          )}
                       </SelectContent>
                    </Select>
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-2">
                       <Coins className="w-3.5 h-3.5 text-secondary" /> Preço Base Fallback (R$)
                    </Label>
                    <Input 
                       type="number" step="0.01"
                       value={formData.price} 
                       onChange={e => setFormData({...formData, price: parseFloat(e.target.value) || 0})}
                       className="h-11 rounded-xl font-black"
                    />
                 </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase opacity-60">Descrição Curta (Vitrine)</Label>
                <Input value={formData.shortDescription} onChange={e => setFormData({...formData, shortDescription: e.target.value})} maxLength={120} className="rounded-xl h-11" />
              </div>

              <EventDescription value={formData.description} onChange={v => setFormData({...formData, description: v})} />
           </Card>

           <Card className="border-none shadow-sm rounded-[2rem] bg-white p-8 space-y-6">
              <div className="flex items-center justify-between">
                 <Label className="text-[10px] font-black uppercase opacity-60">Galeria de Fotos (Máx 5)</Label>
                 <Badge variant="outline" className="text-[8px] font-black uppercase">{formData.gallery.length}/5</Badge>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                 {formData.gallery.map((url, i) => (
                   <div key={i} className="relative aspect-square rounded-2xl overflow-hidden group border">
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

           <Button onClick={nextStep} className="w-full h-16 bg-primary text-white font-black rounded-2xl uppercase italic text-lg gap-2">Configurar Localização <ChevronRight className="w-5 h-5" /></Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-8 animate-in slide-in-from-right-4">
           <EventLocation address={formData.address} onChange={v => setFormData({...formData, address: v})} />
           <div className="flex gap-4">
              <Button variant="ghost" onClick={() => setStep(1)} className="h-16 px-8 rounded-2xl font-bold uppercase text-xs">Voltar</Button>
              <Button onClick={nextStep} className="flex-1 h-16 bg-primary text-white font-black rounded-2xl uppercase italic text-lg gap-2">Disponibilidade <ChevronRight className="w-5 h-5" /></Button>
           </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-8 animate-in slide-in-from-right-4">
           <Card className="border-none shadow-sm rounded-[2rem] bg-white p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">Início da Experiência</Label>
                    <Input type="date" value={formData.availability.startDate} onChange={e => setFormData({...formData, availability: {...formData.availability, startDate: e.target.value}})} className="rounded-xl h-11" />
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">Fim (Opcional)</Label>
                    <Input type="date" value={formData.availability.endDate} onChange={e => setFormData({...formData, availability: {...formData.availability, endDate: e.target.value}})} className="rounded-xl h-11" />
                 </div>
              </div>

              <div className="space-y-4">
                 <Label className="text-[10px] font-black uppercase opacity-60">Dias da Semana Permitidos</Label>
                 <div className="flex flex-wrap gap-2">
                    {WEEK_DAYS.map(day => (
                      <div key={day.id} className="flex items-center space-x-2 bg-muted/30 px-3 py-2 rounded-xl border">
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
                        <label htmlFor={`day-${day.id}`} className="text-[10px] font-black uppercase cursor-pointer">{day.label}</label>
                      </div>
                    ))}
                 </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-secondary/5 rounded-2xl border border-secondary/10">
                 <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-secondary" />
                    <div><p className="text-sm font-bold uppercase italic text-primary">Permitir Feriados?</p></div>
                 </div>
                 <Switch checked={formData.availability.allowHolidays} onCheckedChange={v => setFormData({...formData, availability: {...formData.availability, allowHolidays: v}})} />
              </div>
           </Card>
           <div className="flex gap-4">
              <Button variant="ghost" onClick={() => setStep(2)} className="h-16 px-8 rounded-2xl font-bold uppercase text-xs">Voltar</Button>
              <Button onClick={nextStep} className="flex-1 h-16 bg-primary text-white font-black rounded-2xl uppercase italic text-lg gap-2">Gerenciar Horários <ChevronRight className="w-5 h-5" /></Button>
           </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-8 animate-in slide-in-from-right-4">
           <ExperienceSlotsAdmin experienceId={draftId!} />
           <div className="flex gap-4 pt-8">
              <Button variant="ghost" onClick={() => setStep(3)} className="h-16 px-8 rounded-2xl font-bold uppercase text-xs">Voltar</Button>
              <Button 
                onClick={handlePublish} 
                disabled={publishing} 
                className="flex-1 h-16 bg-secondary text-white font-black rounded-2xl shadow-xl uppercase italic text-lg gap-2"
              >
                 {publishing ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : <ShieldCheck className="w-6 h-6" />}
                 Finalizar e Publicar
              </Button>
           </div>
        </div>
      )}
    </div>
  );
}
