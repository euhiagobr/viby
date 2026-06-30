
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useUser, useFirestore, useFirebaseApp } from '@/firebase';
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
  Info,
  ShieldCheck,
  Check,
  ChevronRight,
  MapPin,
  Camera,
  Upload,
  Plus,
  Trash2,
  Coins,
  Users,
  X,
  ImageIcon
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

const DEFAULT_EVENT_IMAGE = "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2FlogoUrl_1780427858048?alt=media&token=5bf01a27-8521-4a59-a78b-70c888aa0417";

export default function NovaExperienciaPage() {
  const router = useRouter();
  const auth = useAuth();
  const { user } = useUser(auth);
  const { currentOrg } = useCurrentOrganization();
  const db = useFirestore();
  const app = useFirebaseApp();
  const storage = React.useMemo(() => (app ? getStorage(app) : null), [app]);

  const [loading, setLoading] = React.useState(true);
  const [publishing, setPublishing] = React.useState(false);
  const [draftId, setDraftId] = React.useState<string | null>(null);
  const [step, setStep] = React.useState(1);
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null);
  const [galleryProgress, setGalleryProgress] = React.useState<{ [key: string]: number }>({});

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
          address: res.address || prev.address
        }));
      }
      setLoading(false);
    };

    init();
  }, [user, currentOrg]);

  const [formData, setFormData] = React.useState({
    title: "",
    slug: "",
    shortDescription: "",
    description: "",
    image: "",
    gallery: [] as string[],
    price: 0,
    capacity: 100,
    additionalInfo: "",
    usagePolicy: "",
    status: "draft",
    address: {
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

  const handleImageUpload = async (file: File) => {
    if (!storage || !user || !draftId) return;
    setUploadProgress(0);
    try {
      const storageRef = ref(storage, `experiences/${draftId}/cover_${Date.now()}`);
      const uploadTask = uploadBytesResumable(storageRef, file, IMAGE_CACHE_METADATA);
      
      uploadTask.on('state_changed', 
        (snapshot) => setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
        (error) => {
          setUploadProgress(null);
          toast({ 
            variant: "destructive", 
            title: "Erro no upload da capa", 
            description: `Falha: ${error.code}` 
          });
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          setFormData(prev => ({ ...prev, image: downloadURL }));
          setUploadProgress(null);
          toast({ title: "Capa carregada!" });
        }
      );
    } catch (e: any) {
      setUploadProgress(null);
      toast({ variant: "destructive", title: "Erro técnico no upload" });
    }
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !storage || !user || !draftId) return;
    
    const currentCount = formData.gallery.length;
    const uploadingCount = Object.keys(galleryProgress).length;

    if (currentCount + uploadingCount + files.length > 5) {
      toast({ variant: "destructive", title: "Limite atingido", description: "Máximo de 5 fotos na galeria." });
      return;
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const uploadId = Math.random().toString(36).substring(7);
      
      try {
        const storageRef = ref(storage, `experiences/${draftId}/gallery_${Date.now()}_${i}`);
        const uploadTask = uploadBytesResumable(storageRef, file, IMAGE_CACHE_METADATA);

        uploadTask.on('state_changed', 
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setGalleryProgress(prev => ({ ...prev, [uploadId]: progress }));
          },
          (error) => {
            setGalleryProgress(prev => {
              const next = { ...prev };
              delete next[uploadId];
              return next;
            });
            toast({ 
              variant: "destructive", 
              title: "Erro no upload", 
              description: `Falha ao subir ${file.name}: ${error.code}` 
            });
          },
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
      } catch (err) {
        toast({ variant: "destructive", title: "Falha ao iniciar upload de arquivo." });
      }
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftId || !currentOrg || publishing) return;

    if (!formData.image) {
      toast({ variant: "destructive", title: "Capa obrigatória", description: "Carregue uma imagem de capa para publicar." });
      return;
    }

    if (!formData.address.latitude || !formData.address.longitude) {
      toast({ variant: "destructive", title: "Localização obrigatória", description: "Selecione o endereço completo no mapa." });
      return;
    }

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

  const totalUploading = Object.keys(galleryProgress).length;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild><Link href={`/dashboard/organizacoes/${currentOrg?.username}/experiencias`}><ArrowLeft className="w-5 h-5" /></Link></Button>
          <div>
            <h1 className="text-3xl font-black italic uppercase tracking-tighter text-primary">Nova Experiência</h1>
            <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest">Etapa 2: Conteúdo e Localização</p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 mb-8">
        <div className={cn("h-1.5 flex-1 rounded-full transition-all", step >= 1 ? "bg-secondary" : "bg-muted")} />
        <div className={cn("h-1.5 flex-1 rounded-full transition-all", step >= 2 ? "bg-secondary" : "bg-muted")} />
      </div>

      {step === 1 ? (
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
                    <Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-2">
                       <Coins className="w-3.5 h-3.5 text-secondary" /> Valor Base (BRL)
                    </Label>
                    <Input 
                       type="number" 
                       step="0.01"
                       value={formData.price} 
                       onChange={e => setFormData({...formData, price: parseFloat(e.target.value) || 0})}
                       className="h-12 rounded-xl font-black text-primary text-lg"
                    />
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-2">
                       <Users className="w-3.5 h-3.5 text-secondary" /> Capacidade / Estoque
                    </Label>
                    <Input 
                       type="number" 
                       value={formData.capacity} 
                       onChange={e => setFormData({...formData, capacity: parseInt(e.target.value) || 0})}
                       className="h-12 rounded-xl font-bold"
                    />
                 </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase opacity-60">Descrição Curta (Vitrine)</Label>
                <Input 
                  value={formData.shortDescription}
                  onChange={e => setFormData({...formData, shortDescription: e.target.value})}
                  maxLength={120}
                  className="rounded-xl h-11"
                />
              </div>

              <EventDescription 
                value={formData.description} 
                onChange={v => setFormData({...formData, description: v})} 
              />
           </Card>

           <Card className="border-none shadow-sm rounded-[2rem] bg-white p-8 space-y-6">
              <div className="flex items-center justify-between">
                 <div className="space-y-0.5">
                    <Label className="text-[10px] font-black uppercase opacity-60">Galeria de Fotos (Opcional)</Label>
                    <p className="text-[9px] font-medium text-muted-foreground uppercase">Adicione até 5 fotos para detalhar a vivência.</p>
                 </div>
                 <Badge variant="outline" className="text-[8px] font-black uppercase">{(formData.gallery.length + totalUploading)}/5</Badge>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                 {formData.gallery.map((url, i) => (
                   <div key={i} className="relative aspect-square rounded-2xl overflow-hidden group border">
                      <img src={url} className="w-full h-full object-cover" alt="Galeria" />
                      <button 
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, gallery: prev.gallery.filter((_, idx) => idx !== i) }))}
                        className="absolute top-2 right-2 p-1.5 bg-destructive text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                      >
                         <X className="w-3.5 h-3.5" />
                      </button>
                   </div>
                 ))}
                 
                 {Object.entries(galleryProgress).map(([id, progress]) => (
                   <div key={id} className="relative aspect-square rounded-2xl bg-muted flex flex-col items-center justify-center gap-2 border border-dashed animate-pulse">
                      <Loader2 className="w-5 h-5 animate-spin text-secondary" />
                      <span className="text-[8px] font-black uppercase text-secondary">Subindo...</span>
                      <Progress value={progress} className="absolute bottom-0 left-0 right-0 h-1 rounded-none" />
                   </div>
                 ))}

                 {(formData.gallery.length + totalUploading) < 5 && (
                   <label className="aspect-square rounded-2xl border-2 border-dashed border-muted-foreground/20 flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition-all hover:border-secondary/40 group">
                      <Plus className="w-6 h-6 text-muted-foreground opacity-40 group-hover:text-secondary group-hover:opacity-100" />
                      <span className="text-[8px] font-black uppercase mt-1">Adicionar</span>
                      <input type="file" multiple accept="image/*" className="hidden" onChange={handleGalleryUpload} disabled={totalUploading > 0} />
                   </label>
                 )}
              </div>
           </Card>

           <Button onClick={() => setStep(2)} className="w-full h-16 bg-primary text-white font-black rounded-2xl uppercase italic text-lg gap-2 shadow-xl shadow-primary/20">
              Configurar Localização <ChevronRight className="w-5 h-5" />
           </Button>
        </div>
      ) : (
        <div className="space-y-8 animate-in slide-in-from-right-4">
           <div className="space-y-6">
              <div className="flex items-center gap-3 px-2">
                 <div className="p-2 bg-secondary/10 rounded-lg text-secondary"><MapPin className="w-5 h-5" /></div>
                 <h2 className="text-xl font-black uppercase italic tracking-tighter text-primary">Onde acontece?</h2>
              </div>
              <EventLocation 
                address={formData.address} 
                onChange={v => setFormData({...formData, address: v})} 
              />
           </div>

           <Card className="border-none shadow-sm rounded-[2rem] bg-white p-8 space-y-8">
              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Informações Adicionais / Regras</Label>
                 <Textarea 
                   value={formData.additionalInfo}
                   onChange={e => setFormData({...formData, additionalInfo: e.target.value})}
                   placeholder="Instruções para o dia, itens obrigatórios..."
                   className="min-h-[120px] rounded-xl resize-none"
                 />
              </div>
              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Política de Uso / Cancelamento</Label>
                 <Textarea 
                   value={formData.usagePolicy}
                   onChange={e => setFormData({...formData, usagePolicy: e.target.value})}
                   placeholder="Regras de reembolso, comportamento..."
                   className="min-h-[120px] rounded-xl resize-none"
                 />
              </div>
           </Card>

           <div className="flex gap-4">
              <Button variant="ghost" onClick={() => setStep(1)} className="h-16 px-8 rounded-2xl font-bold uppercase text-xs">Voltar</Button>
              <Button 
                 onClick={handlePublish} 
                 disabled={publishing || totalUploading > 0} 
                 className="flex-1 h-16 bg-secondary text-white font-black rounded-2xl shadow-xl uppercase italic text-lg gap-2"
              >
                 {publishing ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : <ShieldCheck className="w-6 h-6" />}
                 Publicar Experiência
              </Button>
           </div>
        </div>
      )}
    </div>
  );
}
