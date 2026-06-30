
'use client';

import * as React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth, useUser, useFirestore, useDoc, useFirebaseApp } from '@/firebase';
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
  Layout
} from 'lucide-react';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
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

  const expRef = React.useMemo(() => (db && id) ? doc(db, "experiences", id) : null, [db, id]);
  const { data: exp, loading: expLoading } = useDoc<any>(expRef);

  const [saving, setSaving] = React.useState(false);
  const [formData, setFormData] = React.useState<any>(null);
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null);
  const [galleryProgress, setGalleryProgress] = React.useState<{ [key: number]: number }>({});

  React.useEffect(() => {
    if (exp) {
      setFormData({
        title: exp.title || "",
        slug: exp.slug || "",
        shortDescription: exp.shortDescription || "",
        description: exp.description || "",
        image: exp.image || "",
        gallery: exp.gallery || [],
        price: exp.price || 0,
        capacity: exp.capacity || 100,
        additionalInfo: exp.additionalInfo || "",
        usagePolicy: exp.usagePolicy || "",
        status: exp.status || "draft",
        address: exp.address || {
          venueName: "",
          addressLine1: "",
          city: "",
          stateRegion: "",
          country: "Brasil",
          countryCode: "BR",
          latitude: null,
          longitude: null
        }
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
        const url = await getDownloadURL(uploadTask.snapshot.ref);
        setFormData(prev => ({ ...prev, image: url }));
        setUploadProgress(null);
      }
    );
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !storage || !user || !id) return;
    
    const currentCount = formData.gallery?.length || 0;
    if (currentCount + files.length > 5) {
      toast({ variant: "destructive", title: "Limite atingido", description: "Máximo de 5 fotos na galeria." });
      return;
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const storageRef = ref(storage, `experiences/${id}/gallery_${Date.now()}_${i}`);
      const uploadTask = uploadBytesResumable(storageRef, file, IMAGE_CACHE_METADATA);

      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setGalleryProgress(prev => ({ ...prev, [i]: progress }));
        },
        null,
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          setFormData(prev => ({ ...prev, gallery: [...(prev.gallery || []), url] }));
          setGalleryProgress(prev => {
            const next = { ...prev };
            delete next[i];
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
            <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest">Gestão de Conteúdo e Disponibilidade</p>
          </div>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" asChild className="rounded-xl h-11 border-secondary text-secondary">
              <Link href={`/${currentOrg?.username}/experiencia/${formData.slug}`} target="_blank">Ver Pública</Link>
           </Button>
           <Button 
            onClick={handleSave} 
            disabled={saving} 
            className="bg-secondary text-white font-black rounded-full px-8 h-11 shadow-lg gap-2 uppercase italic"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar
          </Button>
        </div>
      </div>

      <Tabs defaultValue="conteudo" className="space-y-8">
        <TabsList className="bg-muted/50 p-1 rounded-xl h-12">
          <TabsTrigger value="conteudo" className="rounded-lg px-8 font-bold gap-2"><Layout className="w-4 h-4" /> Conteúdo</TabsTrigger>
          <TabsTrigger value="disponibilidade" className="rounded-lg px-8 font-bold gap-2"><Calendar className="w-4 h-4" /> Disponibilidade</TabsTrigger>
          <TabsTrigger value="localizacao" className="rounded-lg px-8 font-bold gap-2"><MapPin className="w-4 h-4" /> Localização</TabsTrigger>
        </TabsList>

        <TabsContent value="conteudo" className="space-y-8">
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
                    <Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-2">
                       <Coins className="w-3.5 h-3.5 text-secondary" /> Preço Base (BRL)
                    </Label>
                    <Input 
                       type="number" 
                       step="0.01"
                       value={formData.price} 
                       onChange={e => setFormData({...formData, price: parseFloat(e.target.value) || 0})}
                       className="h-11 rounded-xl font-bold"
                    />
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-2">
                       <Users className="w-3.5 h-3.5 text-secondary" /> Capacidade Base
                    </Label>
                    <Input 
                       type="number" 
                       value={formData.capacity} 
                       onChange={e => setFormData({...formData, capacity: parseInt(e.target.value) || 0})}
                       className="h-11 rounded-xl font-bold"
                    />
                 </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase opacity-60">Descrição Curta (Vitrine)</Label>
                <Input 
                  value={formData.shortDescription}
                  onChange={e => setFormData({...formData, shortDescription: e.target.value})}
                  className="rounded-xl h-11"
                />
              </div>

              <EventDescription 
                value={formData.description} 
                onChange={v => setFormData({...formData, description: v})} 
              />

              <div className="space-y-2 pt-4 border-t border-dashed">
                 <Label className="text-[10px] font-black uppercase opacity-60">Status Público</Label>
                 <Select value={formData.status} onValueChange={v => setFormData({...formData, status: v})}>
                    <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                       <SelectItem value="draft">Rascunho</SelectItem>
                       <SelectItem value="active">Ativa (Público)</SelectItem>
                       <SelectItem value="paused">Pausada</SelectItem>
                       <SelectItem value="closed">Encerrada</SelectItem>
                    </SelectContent>
                 </Select>
              </div>
           </Card>

           <Card className="border-none shadow-sm rounded-[2rem] bg-white p-8 space-y-6">
              <div className="flex items-center justify-between">
                 <Label className="text-[10px] font-black uppercase opacity-60">Galeria de Fotos (Máx 5)</Label>
                 <Badge variant="outline" className="text-[8px] font-black uppercase">{(formData.gallery || []).length}/5</Badge>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                 {formData.gallery?.map((url: string, i: number) => (
                   <div key={i} className="relative aspect-square rounded-2xl overflow-hidden group">
                      <img src={url} className="w-full h-full object-cover" />
                      <button 
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, gallery: prev.gallery.filter((_, idx) => idx !== i) }))}
                        className="absolute top-2 right-2 p-1.5 bg-destructive text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                         <X className="w-3.5 h-3.5" />
                      </button>
                   </div>
                 ))}
                 
                 {(formData.gallery?.length || 0) < 5 && (
                   <label className="aspect-square rounded-2xl border-2 border-dashed border-muted-foreground/20 flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition-all">
                      <Plus className="w-6 h-6 text-muted-foreground opacity-40" />
                      <span className="text-[8px] font-black uppercase mt-1">Adicionar</span>
                      <input type="file" multiple accept="image/*" className="hidden" onChange={handleGalleryUpload} />
                   </label>
                 )}
              </div>
           </Card>
        </TabsContent>

        <TabsContent value="disponibilidade" className="mt-0">
           <ExperienceSlotsAdmin experienceId={id} />
        </TabsContent>

        <TabsContent value="localizacao" className="space-y-8 mt-0">
           <EventLocation 
             address={formData.address} 
             onChange={v => setFormData({...formData, address: v})} 
           />

           <Card className="border-none shadow-sm rounded-[2rem] bg-white p-8 space-y-8">
              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Informações Adicionais / Regras</Label>
                 <Textarea 
                   value={formData.additionalInfo}
                   onChange={e => setFormData({...formData, additionalInfo: e.target.value})}
                   placeholder="Instruções para o dia, itens obrigatórios..."
                   className="min-h-[120px] rounded-xl resize-none leading-relaxed"
                 />
              </div>
              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Política de Uso / Cancelamento</Label>
                 <Textarea 
                   value={formData.usagePolicy}
                   onChange={e => setFormData({...formData, usagePolicy: e.target.value})}
                   placeholder="Regras de reembolso, comportamento..."
                   className="min-h-[120px] rounded-xl resize-none leading-relaxed"
                 />
              </div>
           </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
