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
  Clock
} from 'lucide-react';
import { doc, serverTimestamp, updateDoc, query, collection, where } from 'firebase/firestore';
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

const WEEK_DAYS = [
  { id: 0, label: "Dom" },
  { id: 1, label: "Seg" },
  { id: 2, label: "Ter" },
  { id: 3, label: "Qua" },
  { id: 4, label: "Qui" },
  { id: 5, label: "Sex" },
  { id: 6, label: "Sáb" }
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

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
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
            Salvar
          </Button>
        </div>
      </div>

      <Tabs defaultValue="conteudo" className="space-y-8">
        <TabsList className="bg-muted/50 p-1 rounded-xl h-12 flex-wrap">
          <TabsTrigger value="conteudo" className="rounded-lg px-8 font-bold gap-2"><Layout className="w-4 h-4" /> Conteúdo</TabsTrigger>
          <TabsTrigger value="agenda" className="rounded-lg px-8 font-bold gap-2"><Calendar className="w-4 h-4" /> Agenda</TabsTrigger>
          <TabsTrigger value="horarios" className="rounded-lg px-8 font-bold gap-2"><Clock className="w-4 h-4" /> Horários</TabsTrigger>
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
                 <Label className="text-[10px] font-black uppercase opacity-60">Dias da Semana Permitidos</Label>
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
                    <div><p className="text-sm font-bold uppercase italic text-primary">Permitir Feriados?</p></div>
                 </div>
                 <Switch checked={formData.availability.allowHolidays} onCheckedChange={v => setFormData({...formData, availability: {...formData.availability, allowHolidays: v}})} />
              </div>
           </Card>

           <div className="p-4 bg-muted/30 rounded-xl flex gap-3">
            <Info className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
            <p className="text-[10px] text-muted-foreground font-medium leading-relaxed uppercase">
              Configure os dias de operação nesta aba. Os horários e preços específicos são definidos na aba <strong>Horários</strong>.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="horarios" className="mt-0">
           <ExperienceSlotsAdmin experienceId={id} />
        </TabsContent>

        <TabsContent value="local" className="mt-0 space-y-8">
           <EventLocation address={formData.address} onChange={v => setFormData({...formData, address: v})} />
           <Card className="border-none shadow-sm rounded-[2rem] bg-white p-8 space-y-8">
              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase opacity-60">Informações Adicionais</Label>
                 <Textarea value={formData.additionalInfo} onChange={e => setFormData({...formData, additionalInfo: e.target.value})} className="rounded-xl h-24" />
              </div>
              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase opacity-60">Política de Cancelamento</Label>
                 <Textarea value={formData.usagePolicy} onChange={e => setFormData({...formData, usagePolicy: e.target.value})} className="rounded-xl h-24" />
              </div>
           </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
