
'use client';

import * as React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth, useUser, useFirestore, useDoc, useFirebaseApp, useCollection, useMemoFirebase } from '@/firebase';
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
  Zap,
  MapPin,
  Plus,
  X,
  Calendar,
  Layout,
  Clock,
  Info,
  ShieldCheck,
  Star,
  History,
  MessageSquare,
  ThumbsUp,
  Inbox,
  CheckCircle2,
  TrendingUp,
  BarChart3,
  Coins,
  XCircle,
  Trash2,
  Target,
  Users
} from 'lucide-react';
import { doc, serverTimestamp, updateDoc, query, collection, where, orderBy, limit } from 'firebase/firestore';
import Link from 'next/link';
import { toast } from '@/hooks/use-toast';
import { saveExperienceAction } from '@/app/actions/experiences';
import { slugify } from '@/lib/slug-utils';
import { EventLocation, EventHeader, EventDescription } from '@/components/events';
import { IMAGE_CACHE_METADATA } from '@/lib/image-utils';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { ExperienceSlotsAdmin } from '@/components/experiences/ExperienceSlotsAdmin';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatCurrency } from '@/lib/financial-utils';

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

export default function EditarExperienciaPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const db = useFirestore();
  const auth = useAuth();
  const app = useFirebaseApp();
  const { user } = useUser(auth);
  const { currentOrg } = useCurrentOrganization();
  const storage = React.useMemo(() => (app ? getStorage(app) : null), [app]);

  const categoriesQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, "categories"), where("type", "==", "experience"));
  }, [db]);
  const { data: rawCategories, loading: categoriesLoading } = useCollection<any>(categoriesQuery);

  const categories = React.useMemo(() => {
    if (!rawCategories) return [];
    return [...rawCategories].sort((a, b) => a.name.localeCompare(b.name));
  }, [rawCategories]);

  const expRef = React.useMemo(() => (db && id) ? doc(db, "experiences", id) : null, [db, id]);
  const { data: exp, loading: expLoading } = useDoc<any>(expRef);

  // Reviews do Organizador
  const reviewsQuery = useMemoFirebase(() => {
    if (!db || !id) return null;
    return query(collection(db, "experience_reviews"), where("experienceId", "==", id));
  }, [db, id]);
  const { data: rawReviews, loading: reviewsLoading } = useCollection<any>(reviewsQuery);

  const reviews = React.useMemo(() => {
    if (!rawReviews) return [];
    return [...rawReviews].sort((a, b) => {
      const tA = a.createdAt?.seconds || 0;
      const tB = b.createdAt?.seconds || 0;
      return tB - tA;
    });
  }, [rawReviews]);

  const [saving, setSaving] = React.useState(false);
  const [formData, setFormData] = React.useState<any>(null);
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null);
  const [galleryProgress, setGalleryProgress] = React.useState<{ [key: string]: number }>({});

  React.useEffect(() => {
    if (exp) {
      setFormData({
        title: exp.title || "",
        slug: exp.slug || "",
        category: exp.category || "",
        shortDescription: exp.shortDescription || "",
        description: exp.description || "",
        image: exp.image || "",
        gallery: exp.gallery || [],
        status: exp.status || "draft",
        // Novos campos reais
        duration: exp.duration || "",
        maxGroupSize: exp.maxGroupSize || null,
        isUnlimitedCapacity: exp.isUnlimitedCapacity || false,
        instantBooking: exp.instantBooking ?? true,
        digitalVoucher: exp.digitalVoucher ?? true,
        inclusions: exp.inclusions || [],
        exclusions: exp.exclusions || [],
        rules: exp.rules || [],
        steps: exp.steps || [],
        faqs: exp.faqs || [],
        // ---
        availability: exp.availability || {
          startDate: "",
          endDate: "",
          allowedDays: [0, 1, 2, 3, 4, 5, 6],
          allowHolidays: true
        },
        address: exp.address || {
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
        },
        additionalInfo: exp.additionalInfo || "",
        usagePolicy: exp.usagePolicy || ""
      });
    }
  }, [exp]);

  const handleImageUpload = async (file: File) => {
    if (!storage || !user || !id) return;
    setUploadProgress(0);
    const storageRef = ref(storage, `experiences/${id}/cover_${Date.now()}`);
    const uploadTask = uploadBytesResumable(storageRef, file, IMAGE_CACHE_METADATA);
    
    uploadTask.on('state_changed', 
      (snapshot) => setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
      () => { setUploadProgress(null); toast({ variant: "destructive", title: "Erro no upload" }); },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        setFormData(prev => ({ ...prev, image: downloadURL }));
        setUploadProgress(null);
        toast({ title: "Capa atualizada!" });
      }
    );
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !storage || !user || !id) return;
    
    if (formData.gallery.length + files.length > 5) {
      toast({ variant: "destructive", title: "Limite atingido", description: "Máximo de 5 fotos." });
      return;
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const uploadId = Math.random().toString(36).substring(7);
      const storageRef = ref(storage, `experiences/${id}/gallery_${Date.now()}_${i}`);
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || saving) return;

    setSaving(true);
    try {
      const res = await saveExperienceAction(id, formData);
      if (res.success) {
        toast({ title: "Alterações salvas!" });
      } else throw new Error(res.error);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao salvar", description: e.message });
    } finally {
      setSaving(false);
    }
  };

  if (expLoading || !formData) return <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-secondary" /></div>;

  const recStats = exp.recommendationStats || { sim: 0, talvez: 0, nao: 0 };
  const recPercent = exp.reviewCount > 0 ? Math.round((recStats.sim / exp.reviewCount) * 100) : 100;

  const avgCriteria = React.useMemo(() => {
    if (!reviews || reviews.length === 0) return null;
    const totals = { org: 0, service: 0, quality: 0, price: 0, environment: 0 };
    reviews.forEach((r: any) => {
      const dr = r.detailedRatings || {};
      totals.org += dr.org || 5;
      totals.service += dr.service || 5;
      totals.quality += dr.quality || 5;
      totals.price += dr.price || 5;
      totals.environment += dr.environment || 5;
    });
    const count = reviews.length;
    return {
      org: (totals.org / count).toFixed(1),
      service: (totals.service / count).toFixed(1),
      quality: (totals.quality / count).toFixed(1),
      price: (totals.price / count).toFixed(1),
      environment: (totals.environment / count).toFixed(1),
    };
  }, [reviews]);

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild><Link href={`/dashboard/organizacoes/${currentOrg?.username}/experiencias`}><ArrowLeft className="w-5 h-5" /></Link></Button>
          <div>
            <h1 className="text-3xl font-black italic uppercase tracking-tighter text-primary">Editar Experiência</h1>
            <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest">Gestão de Agenda e Marketplace</p>
          </div>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" asChild className="rounded-xl h-11 border-secondary text-secondary">
              <Link href={`/${currentOrg?.username}/experiencia/${formData.slug}`} target="_blank">Ver Pública</Link>
           </Button>
           <Button onClick={handleSave} disabled={saving} className="bg-secondary text-white font-black rounded-full px-8 h-11 shadow-lg gap-2 uppercase italic">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar Alterações
          </Button>
        </div>
      </div>

      <Tabs defaultValue="conteudo" className="space-y-8">
        <TabsList className="bg-muted/50 p-1 rounded-xl h-12 flex-wrap">
          <TabsTrigger value="conteudo" className="rounded-lg px-8 font-bold gap-2"><Layout className="w-4 h-4" /> Conteúdo</TabsTrigger>
          <TabsTrigger value="detalhes" className="rounded-lg px-8 font-bold gap-2"><Plus className="w-4 h-4" /> Detalhes</TabsTrigger>
          <TabsTrigger value="agenda" className="rounded-lg px-8 font-bold gap-2"><Calendar className="w-4 h-4" /> Disponibilidade</TabsTrigger>
          <TabsTrigger value="horarios" className="rounded-lg px-8 font-bold gap-2"><Clock className="w-4 h-4" /> Horários</TabsTrigger>
          <TabsTrigger value="reviews" className="rounded-lg px-8 font-bold gap-2"><Star className="w-4 h-4" /> Avaliações</TabsTrigger>
          <TabsTrigger value="local" className="rounded-lg px-8 font-bold gap-2"><MapPin className="w-4 h-4" /> Localização</TabsTrigger>
        </TabsList>

        <TabsContent value="conteudo" className="space-y-8 mt-0">
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
                    <SelectValue placeholder={categoriesLoading ? "Carregando..." : "Selecione"} />
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
        </TabsContent>

        <TabsContent value="detalhes" className="space-y-10 mt-0">
           {/* OPERACIONAL */}
           <Card className="border-none shadow-sm rounded-[2rem] bg-white p-8 space-y-8">
              <div className="flex items-center gap-3">
                 <div className="p-2 bg-secondary/10 rounded-lg text-secondary"><Zap className="w-5 h-5" /></div>
                 <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary">Informações Rápidas</h3>
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
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">Confirmação de Reserva</Label>
                    <Select value={formData.instantBooking ? "immediate" : "manual"} onValueChange={v => setFormData({...formData, instantBooking: v === 'immediate'})}>
                       <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                       <SelectContent className="rounded-xl">
                          <SelectItem value="immediate">Confirmação Imediata</SelectItem>
                          <SelectItem value="manual">Aprovação Manual</SelectItem>
                       </SelectContent>
                    </Select>
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">Tipo de Ingresso</Label>
                    <Select value={formData.digitalVoucher ? "qr" : "local"} onValueChange={v => setFormData({...formData, digitalVoucher: v === 'qr'})}>
                       <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                       <SelectContent className="rounded-xl">
                          <SelectItem value="qr">QR Code / Digital</SelectItem>
                          <SelectItem value="local">Retirada no Local</SelectItem>
                       </SelectContent>
                    </Select>
                 </div>
              </div>
           </Card>

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

           <Card className="border-none shadow-sm rounded-[2rem] bg-white p-8 space-y-10">
              <div className="space-y-4">
                 <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Timeline: Como Funciona? (Opcional)</Label>
                 <TimelineManager steps={formData.steps} onUpdate={steps => setFormData({...formData, steps: steps})} />
              </div>
              <Separator className="border-dashed" />
              <div className="space-y-4">
                 <Label className="text-[10px] font-black uppercase opacity-60 ml-1">FAQ: Dúvidas Frequentes (Opcional)</Label>
                 <FaqManager faqs={formData.faqs} onUpdate={faqs => setFormData({...formData, faqs: faqs})} />
              </div>
           </Card>
        </TabsContent>

        <TabsContent value="agenda" className="mt-0 space-y-8">
           <Card className="border-none shadow-sm rounded-[2rem] bg-white p-8 space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">Data de Início da Série</Label>
                    <Input type="date" value={formData.availability.startDate} onChange={e => setFormData({...formData, availability: {...formData.availability, startDate: e.target.value}})} className="rounded-xl h-11" />
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">Data de Término Final</Label>
                    <Input type="date" value={formData.availability.endDate} onChange={e => setFormData({...formData, availability: {...formData.availability, endDate: e.target.value}})} className="rounded-xl h-11" />
                 </div>
              </div>

              <div className="space-y-4">
                 <Label className="text-[10px] font-black uppercase opacity-60">Dias da Semana de Funcionamento</Label>
                 <div className="flex flex-wrap gap-2">
                    {WEEK_DAYS.map(day => (
                      <div key={day.id} className="flex items-center space-x-2 bg-muted/30 px-3 py-2 rounded-xl border">
                        <Checkbox 
                          id={`edit-day-${day.id}`} 
                          checked={formData.availability.allowedDays.includes(day.id)} 
                          onCheckedChange={(checked) => {
                            const days = checked 
                              ? [...formData.availability.allowedDays, day.id] 
                              : formData.availability.allowedDays.filter(d => d !== day.id);
                            setFormData({...formData, availability: {...formData.availability, allowedDays: days}});
                          }}
                        />
                        <label htmlFor={`edit-day-${day.id}`} className="text-[10px] font-black uppercase cursor-pointer">{day.label}</label>
                      </div>
                    ))}
                 </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-secondary/5 rounded-2xl border border-secondary/10">
                 <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-secondary" />
                    <div><p className="text-sm font-bold uppercase italic text-primary">Operar em Feriados?</p></div>
                 </div>
                 <Switch checked={formData.availability.allowHolidays} onCheckedChange={v => setFormData({...formData, availability: {...formData.availability, allowHolidays: v}})} />
              </div>
           </Card>
        </TabsContent>

        <TabsContent value="horarios" className="mt-0">
           <ExperienceSlotsAdmin experienceId={id} />
        </TabsContent>

        <TabsContent value="reviews" className="mt-0 space-y-8">
           <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card className="border-none shadow-sm bg-white p-6 flex flex-col items-center justify-center text-center gap-2">
                 <p className="text-[9px] font-black uppercase text-muted-foreground">Nota Média</p>
                 <div className="flex items-center gap-2">
                    <Star className="w-6 h-6 fill-orange-400 text-orange-400" />
                    <span className="text-3xl font-black italic tracking-tighter text-primary">{Number(exp.averageRating || 5.0).toFixed(1)}</span>
                 </div>
              </Card>
              <Card className="border-none shadow-sm bg-white p-6 flex flex-col items-center justify-center text-center gap-2">
                 <p className="text-[9px] font-black uppercase text-muted-foreground">Avaliações</p>
                 <div className="flex items-center gap-2">
                    <MessageSquare className="w-6 h-6 text-secondary" />
                    <span className="text-3xl font-black italic tracking-tighter text-primary">{exp.reviewCount || 0}</span>
                 </div>
              </Card>
              <Card className="border-none shadow-sm bg-green-50 p-6 flex flex-col items-center justify-center text-center gap-2">
                 <p className="text-[9px] font-black uppercase text-green-700">Recomendação</p>
                 <div className="flex items-center gap-2">
                    <ThumbsUp className="w-6 h-6 text-green-600 fill-current" />
                    <span className="text-3xl font-black italic tracking-tighter text-green-700">{recPercent}%</span>
                 </div>
              </Card>
              <Card className="border-none shadow-sm bg-primary text-white p-6 flex flex-col items-center justify-center text-center gap-2">
                 <p className="text-[9px] font-black uppercase opacity-60">Status NPS</p>
                 <div className="text-xl font-black uppercase italic tracking-widest">{recPercent > 80 ? 'Excelente' : recPercent > 50 ? 'Bom' : 'Atenção'}</div>
              </Card>
           </div>

           {avgCriteria && (
              <Card className="border-none shadow-sm rounded-[2rem] bg-white p-8">
                 <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                    <CriteriaBox label="Org." value={avgCriteria.org} />
                    <CriteriaBox label="Serviço" value={avgCriteria.service} />
                    <CriteriaBox label="Qualidade" value={avgCriteria.quality} />
                    <CriteriaBox label="Preço" value={avgCriteria.price} />
                    <CriteriaBox label="Ambiente" value={avgCriteria.environment} />
                 </div>
              </Card>
           )}

           <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
              <CardHeader className="bg-muted/30 border-b p-8 flex flex-row items-center justify-between">
                 <div>
                   <CardTitle className="text-lg font-black italic uppercase tracking-tighter flex items-center gap-2">
                      <History className="w-5 h-5 text-secondary" /> Feed de Comentários
                   </CardTitle>
                   <CardDescription className="font-bold text-secondary text-[10px] uppercase">Últimos comentários recebidos</CardDescription>
                 </div>
                 <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Buscar review..." 
                      value={search} 
                      onChange={e => setSearch(e.target.value)}
                      className="pl-10 h-10 rounded-xl text-xs"
                    />
                 </div>
              </CardHeader>
              <CardContent className="p-0">
                 <ScrollArea className="h-[600px]">
                    {reviewsLoading ? (
                       <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-secondary" /></div>
                    ) : reviews && reviews.length > 0 ? (
                       <div className="divide-y">
                          {reviews.map((review: any) => (
                            <div key={review.id} className="p-8 space-y-4 hover:bg-muted/5 transition-colors">
                               <div className="flex justify-between items-start">
                                  <div className="flex items-center gap-4">
                                     <Avatar className="h-10 w-10 border shadow-sm">
                                        <AvatarImage src={review.userAvatar} className="object-cover" />
                                        <AvatarFallback className="font-bold bg-muted">{review.userName?.charAt(0)}</AvatarFallback>
                                     </Avatar>
                                     <div>
                                        <div className="flex items-center gap-2">
                                           <h4 className="font-bold text-sm uppercase italic">{review.userName}</h4>
                                           <CheckCircle2 className="w-3.5 h-3.5 fill-blue-500 text-white" />
                                        </div>
                                        <p className="text-[9px] font-bold text-muted-foreground uppercase">Em {new Date(review.createdAt?.seconds * 1000 || review.createdAt).toLocaleDateString('pt-BR')}</p>
                                     </div>
                                  </div>
                                  <div className="flex gap-0.5">
                                     {Array.from({length: 5}).map((_, i) => (
                                       <Star key={i} className={cn("w-3 h-3", i < review.generalRating ? "fill-orange-400 text-orange-400" : "text-muted opacity-20")} />
                                     ))}
                                  </div>
                               </div>
                               <div className="space-y-2">
                                  <p className="text-sm font-black uppercase text-primary italic leading-tight">{review.title}</p>
                                  <p className="text-xs text-muted-foreground leading-relaxed">"{review.fullExperience}"</p>
                               </div>
                               <div className="flex flex-wrap gap-2">
                                  {review.badges?.map((b: string, i: number) => (
                                    <Badge key={i} variant="secondary" className="bg-secondary/5 text-secondary border-secondary/10 text-[7px] font-black uppercase h-5 px-2">{b}</Badge>
                                  ))}
                               </div>
                            </div>
                          ))}
                       </div>
                    ) : (
                       <div className="py-20 text-center opacity-30 italic flex flex-col items-center gap-4">
                          <FilterX className="w-10 h-10" />
                          <p className="text-xs font-black uppercase tracking-widest">Nenhum review encontrado.</p>
                       </div>
                    )}
                 </ScrollArea>
              </CardContent>
           </Card>
        </TabsContent>

        <TabsContent value="local" className="mt-0 space-y-8">
           <EventLocation address={formData.address} onChange={v => setFormData({...formData, address: v})} />
           <Card className="border-none shadow-sm rounded-[2rem] bg-white p-8 space-y-10">
              <div className="space-y-3">
                 <Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-2"><ShieldCheck className="w-3.5 h-3.5" /> Regras de Uso e Políticas (Markdown)</Label>
                 <Textarea value={formData.usagePolicy} onChange={e => setFormData({...formData, usagePolicy: e.target.value})} placeholder="Escreva as regras em markdown. Use **negrito**, listas e ++texto grande++." className="rounded-[1.5rem] h-48 p-6 leading-relaxed font-medium" />
              </div>
              <Separator className="border-dashed" />
              <div className="space-y-3">
                 <Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-2"><Info className="w-3.5 h-3.5" /> Informações Adicionais</Label>
                 <Textarea value={formData.additionalInfo} onChange={e => setFormData({...formData, additionalInfo: e.target.value})} placeholder="Outras informações importantes..." className="rounded-[1.5rem] h-32 p-6 leading-relaxed font-medium" />
              </div>
           </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CriteriaBox({ label, value }: { label: string, value: string }) {
  return (
    <div className="text-center space-y-1">
       <p className="text-[8px] font-black uppercase text-muted-foreground opacity-60 tracking-widest">{label}</p>
       <div className="flex items-center justify-center gap-1">
          <Star className="w-3 h-3 fill-orange-400 text-orange-400" />
          <span className="text-sm font-black text-primary">{value}</span>
       </div>
    </div>
  )
}

function ListManager({ title, icon: Icon, items, onUpdate, placeholder, color }: any) {
  const [input, setInput] = React.useState("");
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
          <Input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAdd())} placeholder={placeholder} className="rounded-xl h-11" />
          <Button type="button" onClick={handleAdd} size="icon" className="shrink-0 bg-primary text-white rounded-xl h-11 w-11"><Plus className="w-4 h-4" /></Button>
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
