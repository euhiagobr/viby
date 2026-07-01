
'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { 
  Star, 
  Loader2, 
  Send, 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft, 
  Camera, 
  Video, 
  X,
  Plus,
  Heart,
  Zap,
  Info,
  Building2,
  Users,
  Target
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { submitExperienceReviewAction } from '@/app/actions/experiences';
import { useAuth, useUser, useFirebaseApp } from '@/firebase';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';

interface ReviewModalProps {
  registration: any;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const RECOMMEND_TARGETS = [
  { id: 'casais', label: 'Casais' },
  { id: 'familia', label: 'Família' },
  { id: 'amigos', label: 'Amigos' },
  { id: 'criancas', label: 'Crianças' },
  { id: 'sozinho', label: 'Sozinho' },
  { id: 'empresas', label: 'Empresas' },
  { id: 'turistas', label: 'Turistas' },
  { id: 'moradores', label: 'Moradores locais' },
];

export function ReviewModal({ registration, isOpen, onOpenChange }: ReviewModalProps) {
  const auth = useAuth();
  const { user, profile } = useUser(auth);
  const app = useFirebaseApp();
  const storage = React.useMemo(() => app ? getStorage(app) : null, [app]);

  const [step, setStep] = React.useState(1);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null);

  const [form, setForm] = React.useState({
    generalRating: 5,
    detailedRatings: {
      org: 5,
      service: 5,
      quality: 5,
      price: 5,
      environment: 5,
    },
    recommend: "sim",
    match: "sim",
    return: "sim",
    targets: [] as string[],
    title: "",
    likedMost: "",
    canImprove: "",
    fullExperience: "",
    photos: [] as string[],
    video: "",
  });

  const handleNext = () => setStep(prev => prev + 1);
  const handleBack = () => setStep(prev => prev - 1);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'photo' | 'video') => {
    const file = e.target.files?.[0];
    if (!file || !storage || !user) return;

    if (type === 'photo' && form.photos.length >= 10) {
      toast({ variant: "destructive", title: "Limite atingido", description: "Máximo de 10 fotos." });
      return;
    }

    setUploadProgress(0);
    try {
      const path = `reviews/${registration.id}/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, path);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed', 
        (snap) => setUploadProgress((snap.bytesTransferred / snap.totalBytes) * 100),
        () => { setUploadProgress(null); toast({ variant: "destructive", title: "Erro no upload" }); },
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          if (type === 'photo') setForm(prev => ({ ...prev, photos: [...prev.photos, url] }));
          else setForm(prev => ({ ...prev, video: url }));
          setUploadProgress(null);
        }
      );
    } catch (err) { setUploadProgress(null); }
  };

  const handleSubmit = async () => {
    if (isSubmitting || !user) return;
    if (form.fullExperience.length < 80) {
      toast({ variant: "destructive", title: "Relato muito curto", description: "Conte um pouco mais sobre sua experiência (mín. 80 caracteres)." });
      setStep(5);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await submitExperienceReviewAction({
        registrationId: registration.id,
        experienceId: registration.eventId,
        userId: user.uid,
        userName: profile?.name || user.displayName || "Membro Viby",
        userAvatar: profile?.avatar || user.photoURL || "",
        ...form
      });

      if (res.success) {
        toast({ title: "Avaliação publicada!", description: "Obrigado por ajudar a comunidade Viby." });
        onOpenChange(false);
      } else throw new Error(res.error);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao publicar", description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl bg-white flex flex-col h-[90vh]">
        <DialogHeader className="p-8 border-b bg-muted/30 shrink-0">
          <div className="flex justify-between items-center">
            <div className="space-y-1">
              <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-primary">Sua Experiência</DialogTitle>
              <DialogDescription className="font-bold text-secondary uppercase text-[10px] tracking-widest">{registration?.eventTitle}</DialogDescription>
            </div>
            <Badge variant="outline" className="h-6 px-3 rounded-full font-black uppercase text-[10px]">Passo {step} de 6</Badge>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-8">
           {step === 1 && (
             <div className="space-y-10 py-10 animate-in slide-in-from-right-4">
                <div className="text-center space-y-4">
                   <h3 className="text-3xl font-black uppercase italic tracking-tighter text-primary leading-none">Como foi sua experiência geral?</h3>
                   <p className="text-muted-foreground font-medium uppercase text-xs">Sua satisfação nos ajuda a manter a qualidade Viby.</p>
                </div>
                <div className="flex justify-center gap-4">
                   {[1, 2, 3, 4, 5].map((star) => (
                     <button
                       key={star}
                       onClick={() => { setForm({...form, generalRating: star}); handleNext(); }}
                       className="transition-transform hover:scale-110 active:scale-90"
                     >
                       <Star className={cn("w-16 h-16 transition-colors", form.generalRating >= star ? "fill-orange-400 text-orange-400" : "text-muted opacity-20")} />
                     </button>
                   ))}
                </div>
             </div>
           )}

           {step === 2 && (
             <div className="space-y-8 animate-in slide-in-from-right-4">
                <div className="space-y-2">
                   <h3 className="text-xl font-black uppercase italic text-primary">Avaliação Detalhada</h3>
                   <p className="text-[10px] font-bold text-muted-foreground uppercase">Atribua notas para cada critério da vivência.</p>
                </div>
                <div className="space-y-6">
                   <RatingRow label="Organização" desc="Tudo aconteceu conforme esperado?" value={form.detailedRatings.org} onChange={v => setForm({...form, detailedRatings: {...form.detailedRatings, org: v}})} />
                   <RatingRow label="Atendimento" desc="Como foi o tratamento da equipe?" value={form.detailedRatings.service} onChange={v => setForm({...form, detailedRatings: {...form.detailedRatings, service: v}})} />
                   <RatingRow label="Qualidade" desc="A entrega correspondeu ao prometido?" value={form.detailedRatings.quality} onChange={v => setForm({...form, detailedRatings: {...form.detailedRatings, quality: v}})} />
                   <RatingRow label="Custo-benefício" desc="O preço valeu a experiência?" value={form.detailedRatings.price} onChange={v => setForm({...form, detailedRatings: {...form.detailedRatings, price: v}})} />
                   <RatingRow label="Ambiente" desc="O local era agradável e adequado?" value={form.detailedRatings.environment} onChange={v => setForm({...form, detailedRatings: {...form.detailedRatings, environment: v}})} />
                </div>
             </div>
           )}

           {step === 3 && (
             <div className="space-y-10 animate-in slide-in-from-right-4">
                <div className="space-y-2">
                   <h3 className="text-xl font-black uppercase italic text-primary">Destaques Finais</h3>
                   <p className="text-[10px] font-bold text-muted-foreground uppercase">Informações extras ajudam novos visitantes.</p>
                </div>
                <div className="space-y-8">
                   <ChoiceRow label="Você recomendaria esta experiência?" value={form.recommend} onChange={v => setForm({...form, recommend: v})} />
                   <ChoiceRow label="A descrição correspondia ao que encontrou?" value={form.match} onChange={v => setForm({...form, match: v})} options={['Sim', 'Parcialmente', 'Não']} values={['sim', 'parcial', 'nao']} />
                   <ChoiceRow label="Você voltaria?" value={form.return} onChange={v => setForm({...form, return: v})} />
                </div>
             </div>
           )}

           {step === 4 && (
             <div className="space-y-8 animate-in slide-in-from-right-4">
                <div className="space-y-2">
                   <h3 className="text-xl font-black uppercase italic text-primary">Para quem você recomendaria?</h3>
                   <p className="text-[10px] font-bold text-muted-foreground uppercase">Selecione todos os perfis que combinam com este rolê.</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                   {RECOMMEND_TARGETS.map((target) => (
                     <button
                       key={target.id}
                       onClick={() => {
                         const n = form.targets.includes(target.id) ? form.targets.filter(t => t !== target.id) : [...form.targets, target.id];
                         setForm({...form, targets: n});
                       }}
                       className={cn(
                         "p-4 rounded-2xl border-2 flex items-center justify-between transition-all",
                         form.targets.includes(target.id) ? "border-secondary bg-secondary/5 text-primary" : "border-muted bg-white text-muted-foreground hover:bg-muted/30"
                       )}
                     >
                       <span className="text-[10px] font-black uppercase tracking-widest">{target.label}</span>
                       {form.targets.includes(target.id) && <CheckCircle2 className="w-4 h-4 text-secondary" />}
                     </button>
                   ))}
                </div>
             </div>
           )}

           {step === 5 && (
             <div className="space-y-6 animate-in slide-in-from-right-4">
                <div className="space-y-2">
                   <h3 className="text-xl font-black uppercase italic text-primary">Conte sua experiência</h3>
                   <p className="text-[10px] font-bold text-muted-foreground uppercase">Compartilhe os detalhes com a comunidade.</p>
                </div>
                <div className="space-y-4">
                   <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Título do Review (Opcional)</Label>
                      <Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="Ex: Uma noite incrível" className="rounded-xl h-11" />
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                         <Label className="text-[10px] font-black uppercase opacity-60 ml-1">O que mais gostou?</Label>
                         <Textarea value={form.likedMost} onChange={e => setForm({...form, likedMost: e.target.value})} className="rounded-xl resize-none h-24" />
                      </div>
                      <div className="space-y-2">
                         <Label className="text-[10px] font-black uppercase opacity-60 ml-1">O que poderia melhorar?</Label>
                         <Textarea value={form.canImprove} onChange={e => setForm({...form, canImprove: e.target.value})} className="rounded-xl resize-none h-24" />
                      </div>
                   </div>
                   <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Relato Completo (Mín. 80 caracteres)</Label>
                      <Textarea 
                        value={form.fullExperience} 
                        onChange={e => setForm({...form, fullExperience: e.target.value})} 
                        className={cn("rounded-2xl min-h-[150px] p-6 leading-relaxed", form.fullExperience.length < 80 && "border-orange-200 bg-orange-50/10")}
                        placeholder="Descreva sua experiência do início ao fim..."
                      />
                      <div className="flex justify-end"><span className={cn("text-[9px] font-black uppercase", form.fullExperience.length >= 80 ? "text-green-600" : "text-muted-foreground")}>{form.fullExperience.length}/80 caracteres</span></div>
                   </div>
                </div>
             </div>
           )}

           {step === 6 && (
             <div className="space-y-10 animate-in slide-in-from-right-4">
                <div className="space-y-2">
                   <h3 className="text-xl font-black uppercase italic text-primary">Fotos e Vídeos</h3>
                   <p className="text-[10px] font-bold text-muted-foreground uppercase">Dê vida à sua avaliação com imagens reais.</p>
                </div>
                
                <div className="space-y-6">
                   <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {form.photos.map((url, i) => (
                        <div key={i} className="relative aspect-square rounded-2xl overflow-hidden border shadow-sm group">
                           <img src={url} className="w-full h-full object-cover" />
                           <button onClick={() => setForm({...form, photos: form.photos.filter((_, idx) => idx !== i)})} className="absolute top-2 right-2 p-1 bg-destructive text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3" /></button>
                        </div>
                      ))}
                      {form.photos.length < 10 && (
                        <label className="aspect-square rounded-2xl border-2 border-dashed border-muted-foreground/20 flex flex-col items-center justify-center cursor-pointer hover:bg-muted transition-all text-muted-foreground">
                           <Camera className="w-8 h-8 mb-1 opacity-20" />
                           <span className="text-[9px] font-black uppercase">Foto</span>
                           <input type="file" className="hidden" accept="image/*" onChange={e => handleFileUpload(e, 'photo')} />
                        </label>
                      )}
                   </div>

                   <Separator className="border-dashed" />

                   <div className="space-y-3">
                      <Label className="text-[10px] font-black uppercase opacity-60">Vídeo Curto (Máx 30s)</Label>
                      {form.video ? (
                        <div className="relative aspect-video rounded-3xl overflow-hidden border bg-black group">
                           <video src={form.video} className="w-full h-full object-contain" controls />
                           <button onClick={() => setForm({...form, video: ""})} className="absolute top-4 right-4 p-2 bg-destructive text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-4 h-4" /></button>
                        </div>
                      ) : (
                        <label className="h-32 rounded-3xl border-2 border-dashed border-muted-foreground/20 flex flex-col items-center justify-center cursor-pointer hover:bg-muted transition-all text-muted-foreground">
                           <Video className="w-8 h-8 mb-1 opacity-20" />
                           <span className="text-[10px] font-black uppercase">Adicionar Vídeo</span>
                           <input type="file" className="hidden" accept="video/*" onChange={e => handleFileUpload(e, 'video')} />
                        </label>
                      )}
                   </div>
                </div>

                {uploadProgress !== null && (
                   <div className="space-y-2">
                      <Progress value={uploadProgress} className="h-1" />
                      <p className="text-[9px] font-black uppercase text-secondary text-center">Enviando mídia: {Math.round(uploadProgress)}%</p>
                   </div>
                )}
             </div>
           )}
        </div>

        <DialogFooter className="p-8 bg-muted/10 border-t shrink-0 flex flex-row justify-between gap-3">
           <Button variant="ghost" onClick={handleBack} disabled={step === 1 || isSubmitting} className="rounded-xl font-black uppercase text-[10px] h-12 px-6">
              <ChevronLeft className="w-4 h-4 mr-1" /> Voltar
           </Button>
           {step < 6 ? (
             <Button onClick={handleNext} className="rounded-xl font-black bg-primary text-white h-12 px-10 uppercase italic gap-2 shadow-lg">
                Prosseguir <ChevronRight className="w-4 h-4" />
             </Button>
           ) : (
             <Button onClick={handleSubmit} disabled={isSubmitting || uploadProgress !== null} className="rounded-xl font-black bg-secondary text-white h-12 px-12 shadow-xl shadow-secondary/20 uppercase italic gap-2">
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Publicar Avaliação
             </Button>
           )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RatingRow({ label, desc, value, onChange }: any) {
  return (
    <div className="flex items-center justify-between gap-4 p-4 bg-muted/20 rounded-2xl border border-border/50">
       <div className="flex-1 min-w-0">
          <p className="text-xs font-black uppercase italic text-primary leading-tight">{label}</p>
          <p className="text-[9px] font-medium text-muted-foreground uppercase">{desc}</p>
       </div>
       <div className="flex gap-1 shrink-0">
          {[1, 2, 3, 4, 5].map(v => (
            <button key={v} onClick={() => onChange(v)} className="transition-transform active:scale-90">
               <Star className={cn("w-5 h-5", value >= v ? "fill-orange-400 text-orange-400" : "text-muted opacity-20")} />
            </button>
          ))}
       </div>
    </div>
  )
}

function ChoiceRow({ label, value, onChange, options = ['Sim', 'Talvez', 'Não'], values = ['sim', 'talvez', 'nao'] }: any) {
   return (
      <div className="space-y-4">
         <Label className="text-[10px] font-black uppercase tracking-widest opacity-60 ml-1">{label}</Label>
         <div className="grid grid-cols-3 gap-2">
            {options.map((opt, i) => (
              <button
                key={opt}
                type="button"
                onClick={() => onChange(values[i])}
                className={cn(
                  "h-10 rounded-xl text-[9px] font-black uppercase italic transition-all border-2",
                  value === values[i] ? "bg-primary text-white border-primary shadow-md" : "bg-white border-muted text-muted-foreground hover:bg-muted/30"
                )}
              >
                {opt}
              </button>
            ))}
         </div>
      </div>
   )
}
