'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  ShieldAlert, 
  UserCheck, 
  Trash2, 
  Loader2, 
  CheckCircle2, 
  AlertTriangle,
  Upload,
  Info,
  X,
  FileText,
  ShieldCheck,
  Building2
} from 'lucide-react';
import { useAuth, useUser, useFirestore, useCollection, useMemoFirebase, useFirebaseApp } from '@/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { toast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { 
  submitOwnershipRequestAction, 
  submitReportAction, 
  submitRemovalRequestAction 
} from '@/app/actions/event-actions';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface EventActionModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  event: any;
}

type Step = 'options' | 'ownership' | 'report' | 'removal' | 'success';

export function EventActionModal({ isOpen, onOpenChange, event }: EventActionModalProps) {
  const auth = useAuth();
  const db = useFirestore();
  const app = useFirebaseApp();
  const { user } = useUser(auth);
  const router = useRouter();
  const storage = React.useMemo(() => (app ? getStorage(app) : null), [app]);

  const [step, setStep] = React.useState<Step>('options');
  const [loading, setLoading] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null);
  const [proofUrls, setProofUrls] = React.useState<string[]>([]);
  const [selectedOrgId, setSelectedOrgId] = React.useState<string>("");

  // Queries para buscar todas as organizações do usuário
  const orgsQuery = useMemoFirebase(() => 
    (db && user) ? query(collection(db, "organizations"), where("ownerId", "==", user.uid)) : null, 
    [db, user?.uid]
  );
  const { data: orgs } = useCollection<any>(orgsQuery);

  const resetForm = () => {
    setStep('options');
    setLoading(false);
    setProofUrls([]);
    setUploadProgress(null);
    setSelectedOrgId("");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !storage || !user) return;

    setUploadProgress(0);
    try {
      const fileName = `verification/${user.uid}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
      const storageRef = ref(storage, fileName);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed', 
        (snapshot) => setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
        () => { toast({ variant: "destructive", title: "Erro no upload" }); setUploadProgress(null); },
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          setProofUrls(prev => [...prev, url]);
          setUploadProgress(null);
          toast({ title: "Documento anexado!" });
        }
      );
    } catch (err) { setUploadProgress(null); }
  };

  const onOwnershipClick = () => {
    if (!user) {
      router.push('/login');
      onOpenChange(false);
      return;
    }
    if (!orgs || orgs.length === 0) {
      toast({ 
        variant: "destructive", 
        title: "Acesso Negado", 
        description: "Você precisa ter uma página de organização criada para solicitar a propriedade de um evento." 
      });
      return;
    }
    
    // Se tiver apenas uma, pré-seleciona
    if (orgs.length === 1) {
      setSelectedOrgId(orgs[0].id);
    }
    
    setStep('ownership');
  };

  const handleOwnershipSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || !selectedOrgId) return;
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    
    const res = await submitOwnershipRequestAction({
      eventId: event.id,
      eventTitle: event.title,
      requesterUid: user.uid,
      orgId: selectedOrgId,
      justification: formData.get('justification') as string
    });

    if (res.success) setStep('success');
    else toast({ variant: "destructive", title: "Erro", description: res.error });
    setLoading(false);
  };

  const handleReportSubmit = async (e: React.FormEvent<HTMLDivElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget as any);

    const res = await submitReportAction({
      eventId: event.id,
      eventTitle: event.title,
      reporterUid: user?.uid || null,
      reporterName: formData.get('name') as string,
      reporterEmail: formData.get('email') as string,
      reporterPhone: formData.get('phone') as string,
      reason: formData.get('reason') as string
    });

    if (res.success) setStep('success');
    else toast({ variant: "destructive", title: "Erro", description: res.error });
    setLoading(false);
  };

  const handleRemovalSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    const formData = new FormData(e.currentTarget);

    const res = await submitRemovalRequestAction({
      eventId: event.id,
      eventTitle: event.title,
      requesterUid: user.uid,
      fullName: formData.get('fullName') as string,
      taxId: formData.get('taxId') as string,
      legalName: formData.get('legalName') as string,
      email: formData.get('email') as string,
      phone: formData.get('phone') as string,
      justification: formData.get('justification') as string,
      proofUrls
    });

    if (res.success) setStep('success');
    else toast({ variant: "destructive", title: "Erro", description: res.error });
    setLoading(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { onOpenChange(open); if (!open) resetForm(); }}>
      <DialogContent className="max-w-md rounded-[2.5rem] border-none shadow-2xl overflow-hidden p-0">
        <DialogHeader className="p-8 border-b bg-muted/30">
          <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-primary">Ações do Evento</DialogTitle>
          <DialogDescription className="font-bold text-secondary uppercase text-[10px] tracking-widest">Escolha como deseja proceder</DialogDescription>
        </DialogHeader>

        {step === 'options' && (
          <div className="p-8 space-y-4">
            <ActionButton 
              icon={UserCheck} 
              title="Sou proprietário" 
              desc="Solicitar gestão deste evento para sua marca." 
              onClick={onOwnershipClick}
            />
            <ActionButton 
              icon={ShieldAlert} 
              title="Denunciar evento" 
              desc="Comunicar irregularidades ou conteúdo impróprio." 
              onClick={() => setStep('report')}
            />
            <ActionButton 
              icon={Trash2} 
              title="Solicitar remoção" 
              desc="Protocolar pedido formal de exclusão deste card." 
              onClick={() => user ? setStep('removal') : router.push('/login')}
              destructive
            />
          </div>
        )}

        {step === 'ownership' && (
          <form onSubmit={handleOwnershipSubmit} className="p-8 space-y-6">
            <div className="space-y-4">
               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Vincular a qual organização?</Label>
                  <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                     <SelectTrigger className="h-12 rounded-xl border-dashed border-secondary/30">
                        <SelectValue placeholder="Selecione sua marca" />
                     </SelectTrigger>
                     <SelectContent className="rounded-xl">
                        {orgs?.map((org) => (
                           <SelectItem key={org.id} value={org.id} className="cursor-pointer">
                              <div className="flex items-center gap-2">
                                 <Building2 className="w-3 h-3 text-secondary" />
                                 <span className="font-bold">{org.name}</span>
                              </div>
                           </SelectItem>
                        ))}
                     </SelectContent>
                  </Select>
               </div>

               <div className="p-4 bg-secondary/5 rounded-2xl border border-secondary/10 flex items-start gap-3">
                  <Info className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
                  <p className="text-[10px] text-secondary font-bold uppercase leading-relaxed italic">
                    Sua solicitação enviará um pedido de transferência para a moderação da Viby.
                  </p>
               </div>
               
               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Justificativa (Opcional)</Label>
                  <Textarea name="justification" className="rounded-xl h-24 resize-none border-dashed" placeholder="Conte-nos por que este evento deve pertencer à sua marca." />
               </div>
            </div>

            <Button type="submit" disabled={loading || !selectedOrgId} className="w-full h-14 bg-secondary text-white font-black rounded-2xl shadow-xl uppercase italic">
              {loading ? <Loader2 className="animate-spin" /> : "Enviar Solicitação"}
            </Button>
          </form>
        )}

        {step === 'report' && (
          <div onSubmit={handleReportSubmit} className="p-8 space-y-4">
            <form onSubmit={handleReportSubmit as any}>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase opacity-60">Seu Nome</Label>
                <Input name="name" required className="rounded-xl h-11" defaultValue={user?.displayName || ""} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase opacity-60">E-mail</Label>
                  <Input name="email" type="email" required className="rounded-xl h-11" defaultValue={user?.email || ""} />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase opacity-60">Telefone</Label>
                  <Input name="phone" required className="rounded-xl h-11" placeholder="(00) 00000-0000" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase opacity-60">Motivo da Denúncia</Label>
                <Textarea name="reason" required className="rounded-xl h-24 resize-none" placeholder="Descreva o problema observado..." />
              </div>
              <Button type="submit" disabled={loading} className="w-full h-14 bg-primary text-white font-black rounded-2xl uppercase italic mt-4">
                {loading ? <Loader2 className="animate-spin" /> : "Enviar Denúncia"}
              </Button>
            </form>
          </div>
        )}

        {step === 'removal' && (
          <ScrollArea className="max-h-[60vh]">
            <form onSubmit={handleRemovalSubmit} className="p-8 space-y-6">
               <div className="p-4 bg-orange-50 rounded-2xl border-2 border-dashed border-orange-200 flex items-start gap-4">
                  <AlertTriangle className="w-6 h-6 text-orange-600 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-orange-700 font-bold uppercase leading-relaxed">
                    Esta é uma solicitação formal de remoção por direitos de propriedade ou imagem.
                  </p>
               </div>
               <div className="space-y-4">
                  <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Nome Completo do Responsável</Label><Input name="fullName" required className="rounded-xl h-11" /></div>
                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">CPF ou CNPJ</Label><Input name="taxId" required className="rounded-xl h-11 font-mono" /></div>
                     <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Telefone</Label><Input name="phone" required className="rounded-xl h-11" /></div>
                  </div>
                  <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">E-mail para Contato Jurídico</Label><Input name="email" type="email" required className="rounded-xl h-11" defaultValue={user?.email || ""} /></div>
                  <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Razão Social (Se Empresa)</Label><Input name="legalName" className="rounded-xl h-11" /></div>
                  <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Justificativa Formal</Label><Textarea name="justification" required className="rounded-xl h-24 resize-none" placeholder="Base legal ou motivo da remoção..." /></div>
                  
                  <div className="space-y-3">
                     <Label className="text-[10px] font-black uppercase opacity-60">Comprovação de Propriedade (Anexar Arquivos)</Label>
                     <div className={cn(
                       "relative h-24 rounded-2xl border-2 border-dashed border-border bg-muted/20 flex flex-col items-center justify-center cursor-pointer hover:bg-muted/40 transition-all",
                       proofUrls.length > 0 && "border-secondary"
                     )} onClick={() => document.getElementById('removal-proof-up')?.click()}>
                        <Upload className="w-6 h-6 mb-1 opacity-30" />
                        <p className="text-[8px] font-black uppercase">Clique para subir PDF ou Foto</p>
                        <input id="removal-proof-up" type="file" className="hidden" onChange={handleFileUpload} />
                        {uploadProgress !== null && <Progress value={uploadProgress} className="absolute bottom-0 h-1" />}
                     </div>
                     <div className="flex flex-wrap gap-2">
                        {proofUrls.map((url, i) => (
                          <Badge key={i} variant="secondary" className="gap-1.5 h-6 rounded-lg font-bold text-[8px] uppercase">
                             <FileText className="w-2.5 h-2.5" /> Doc #{i+1}
                             <X className="w-2.5 h-2.5 cursor-pointer" onClick={() => setProofUrls(prev => prev.filter((_, idx) => idx !== i))} />
                          </Badge>
                        ))}
                     </div>
                  </div>
               </div>
               <Button type="submit" disabled={loading || proofUrls.length === 0} className="w-full h-14 bg-destructive text-white font-black rounded-2xl shadow-xl uppercase italic">
                 {loading ? <Loader2 className="animate-spin" /> : "Protocolar Remoção"}
               </Button>
            </form>
          </ScrollArea>
        )}

        {step === 'success' && (
          <div className="p-12 text-center space-y-6 animate-in zoom-in-95 duration-500">
             <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto text-white shadow-xl">
                <CheckCircle2 className="w-10 h-10" />
             </div>
             <div className="space-y-2">
                <h3 className="text-2xl font-black uppercase italic tracking-tighter text-primary">Solicitação Recebida</h3>
                <p className="text-sm font-medium text-muted-foreground leading-relaxed">Sua solicitação agora está <strong>em análise</strong> pela equipe Viby.</p>
             </div>
             <div className="p-4 bg-muted/50 rounded-2xl border border-dashed text-[10px] font-black uppercase opacity-60">
                Prazo estimado de análise: 48h úteis
             </div>
             <Button onClick={() => onOpenChange(false)} className="w-full h-12 bg-primary text-white font-black rounded-xl uppercase italic">Fechar</Button>
          </div>
        )}

        <div className="p-4 bg-muted/30 border-t flex items-center justify-center gap-2">
           <ShieldCheck className="w-4 h-4 text-secondary opacity-40" />
           <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Sistema de Segurança Viby • Ações Auditadas</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ActionButton({ icon: Icon, title, desc, onClick, destructive }: any) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full p-5 rounded-3xl border-2 flex items-start gap-4 text-left transition-all hover:scale-[1.02] group",
        destructive ? "border-red-100 hover:border-destructive hover:bg-destructive/5" : "border-border hover:border-secondary hover:bg-secondary/5"
      )}
    >
      <div className={cn(
        "p-3 rounded-2xl transition-colors shrink-0",
        destructive ? "bg-red-50 text-red-600 group-hover:bg-destructive group-hover:text-white" : "bg-muted text-secondary group-hover:bg-secondary group-hover:text-white"
      )}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="space-y-0.5 min-w-0">
        <h4 className={cn("font-black text-sm uppercase italic tracking-tight", destructive ? "text-red-700" : "text-primary")}>{title}</h4>
        <p className="text-[10px] font-medium text-muted-foreground leading-relaxed uppercase">{desc}</p>
      </div>
    </button>
  );
}
