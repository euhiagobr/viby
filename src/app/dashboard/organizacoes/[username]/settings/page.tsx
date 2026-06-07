'use client';

import * as React from 'react';
import { useCurrentOrganization } from '@/contexts/OrganizationContext';
import { useFirestore, useFirebaseApp, useAuth } from '@/firebase';
import { doc, updateDoc, serverTimestamp, deleteField } from 'firebase/firestore';
import { reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { 
  Settings, 
  Save, 
  Loader2, 
  Camera, 
  Upload, 
  Building2, 
  Globe, 
  Phone, 
  Mail, 
  Instagram, 
  Info,
  ShieldAlert,
  MapPin,
  Fingerprint,
  Trash2,
  EyeOff,
  RefreshCcw,
  AlertTriangle,
  Lock,
  Clock,
  User
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from '@/hooks/use-toast';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn, validateCPF, validateCNPJ } from '@/lib/utils';

export default function OrganizationSettingsPage() {
  const { currentOrg, userRole, refreshOrg } = useCurrentOrganization();
  const db = useFirestore();
  const auth = useAuth();
  const router = useRouter();
  const app = useFirebaseApp();
  const storage = React.useMemo(() => app ? getStorage(app) : null, [app]);

  const [saving, setSaving] = React.useState(false);
  const [formData, setFormData] = React.useState<any>(null);
  const [avatarProgress, setAvatarProgress] = React.useState<number | null>(null);
  const [bannerProgress, setBannerProgress] = React.useState<number | null>(null);

  const [isDeleteDialogOpen, setIsDeleteOpen] = React.useState(false);
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [isProcessingAction, setIsProcessingAction] = React.useState(false);

  React.useEffect(() => {
    if (currentOrg) {
      // Regra de migração silenciosa para tipoOrganizacao
      const initialType = currentOrg.tipoOrganizacao || (currentOrg.cnpj ? 'company' : 'individual');

      setFormData({
        tipoOrganizacao: initialType,
        name: currentOrg.name || "",
        username: currentOrg.username || "",
        bio: currentOrg.bio || "",
        avatar: currentOrg.avatar || "",
        banner: currentOrg.banner || "",
        phone: currentOrg.phone || "",
        contactEmail: currentOrg.contactEmail || "",
        website: currentOrg.website || "",
        instagram: currentOrg.instagram || "",
        cnpj: currentOrg.cnpj || "",
        cpf: currentOrg.cpf || "",
        razaoSocial: currentOrg.razaoSocial || currentOrg.legalName || "",
        nomeFantasia: currentOrg.nomeFantasia || currentOrg.name || "",
        representanteLegalCpf: currentOrg.representanteLegalCpf || "",
        cep: currentOrg.cep || "",
        street: currentOrg.street || "",
        number: currentOrg.number || "",
        complement: currentOrg.complement || "",
        neighborhood: currentOrg.neighborhood || "",
        city: currentOrg.city || "",
        state: currentOrg.state || "",
        country: currentOrg.country || "Brasil",
        showPhone: currentOrg.showPhone ?? true,
        showEmail: currentOrg.showEmail ?? true,
        showWebsite: currentOrg.showWebsite ?? true,
        showInstagram: currentOrg.showInstagram ?? true,
        showAddress: currentOrg.showAddress ?? true,
        showNeighborhood: currentOrg.showNeighborhood ?? true,
        showState: currentOrg.showState ?? true,
      });
    }
  }, [currentOrg]);

  const handleCepBlur = async () => {
    if (!formData?.cep) return;
    const cleanCep = formData.cep.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();
      if (!data.erro) {
        setFormData((prev: any) => ({
          ...prev,
          street: data.logradouro || prev.street,
          neighborhood: data.bairro || prev.neighborhood,
          city: data.localidade || prev.city,
          state: data.uf || prev.state
        }));
      }
    } catch (e) {}
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'banner') => {
    const file = e.target.files?.[0];
    if (!file || !storage || !currentOrg) return;

    const setProgress = type === 'avatar' ? setAvatarProgress : setBannerProgress;
    setProgress(0);

    try {
      const fileName = `organizations/${currentOrg.id}/${type}_${Date.now()}`;
      const storageRef = ref(storage, fileName);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed', 
        (snapshot) => setProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
        () => { setProgress(null); toast({ variant: "destructive", title: "Erro no upload" }); },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          setFormData((prev: any) => ({ ...prev, [type]: downloadURL }));
          setProgress(null);
          toast({ title: `${type === 'avatar' ? 'Logo' : 'Capa'} atualizada!` });
        }
      );
    } catch (err) { setProgress(null); }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !currentOrg) return;

    // Validações Fiscais
    if (formData.tipoOrganizacao === 'individual') {
      if (!validateCPF(formData.cpf)) {
        toast({ variant: "destructive", title: "CPF Inválido" });
        return;
      }
    } else {
      if (!validateCNPJ(formData.cnpj)) {
        toast({ variant: "destructive", title: "CNPJ Inválido" });
        return;
      }
      if (!validateCPF(formData.representanteLegalCpf)) {
        toast({ variant: "destructive", title: "CPF do Representante Inválido" });
        return;
      }
    }

    setSaving(true);
    try {
      const { username, ...updateData } = formData;

      await updateDoc(doc(db, 'organizations', currentOrg.id), {
        ...updateData,
        updatedAt: serverTimestamp(),
      });

      await refreshOrg();
      toast({ title: "Configurações salvas!" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao salvar", description: error.message });
    } finally {
      setSaving(false);
    }
  };

  if (!formData) return null;

  const isIndividual = formData.tipoOrganizacao === 'individual';

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
          <Settings className="w-8 h-8 text-secondary" /> Configurações de Marca
        </h1>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        <Card className="border-none shadow-sm rounded-[2rem]">
          <CardHeader className="bg-muted/30">
            <CardTitle className="text-lg flex items-center gap-2">
               <Fingerprint className="w-5 h-5 text-secondary" /> Tipo de Conta
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8">
             <div className="grid grid-cols-2 gap-4">
                <div className={cn(
                  "flex items-center gap-3 p-4 rounded-xl border-2 transition-all",
                  isIndividual ? "border-secondary bg-secondary/5" : "border-muted bg-muted/20 opacity-50"
                )}>
                   <User className="w-5 h-5" />
                   <span className="font-bold uppercase text-xs">Pessoa Física</span>
                </div>
                <div className={cn(
                  "flex items-center gap-3 p-4 rounded-xl border-2 transition-all",
                  !isIndividual ? "border-secondary bg-secondary/5" : "border-muted bg-muted/20 opacity-50"
                )}>
                   <Building2 className="w-5 h-5" />
                   <span className="font-bold uppercase text-xs">Pessoa Jurídica</span>
                </div>
             </div>
             <p className="text-[9px] font-bold text-muted-foreground uppercase mt-3 italic">O tipo de conta não pode ser alterado após a criação para manter a integridade fiscal no Stripe.</p>
          </CardContent>
        </Card>

        {/* Informações Básicas */}
        <Card className="border-none shadow-sm rounded-[2rem]">
           <CardHeader><CardTitle className="text-lg">Informações do Perfil</CardTitle></CardHeader>
           <CardContent className="space-y-6">
              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase opacity-60">
                    {isIndividual ? "Nome Completo" : "Nome Fantasia"}
                 </Label>
                 <Input 
                   value={formData.name}
                   onChange={e => setFormData({...formData, name: e.target.value})}
                   required
                   className="rounded-xl h-11"
                 />
              </div>
              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase opacity-60">Bio / Descrição</Label>
                 <Textarea 
                   value={formData.bio}
                   onChange={e => setFormData({...formData, bio: e.target.value})}
                   className="min-h-[100px] resize-none rounded-xl"
                 />
              </div>
           </CardContent>
        </Card>

        {/* Dados Fiscais */}
        <Card className="border-none shadow-sm rounded-[2rem]">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Fingerprint className="w-5 h-5 text-secondary" /> Dados Fiscais
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
             {isIndividual ? (
               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase opacity-60">CPF (Titular)</Label>
                  <Input 
                    value={formData.cpf}
                    onChange={e => {
                      const numbers = e.target.value.replace(/\D/g, "");
                      setFormData(prev => ({ ...prev, cpf: numbers.substring(0, 11) }))
                    }}
                    placeholder="000.000.000-00" 
                    className="rounded-xl h-11 font-mono"
                    required
                  />
               </div>
             ) : (
               <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase opacity-60">Razão Social</Label>
                      <Input 
                        value={formData.razaoSocial}
                        onChange={e => setFormData(prev => ({ ...prev, razaoSocial: e.target.value }))}
                        placeholder="Nome oficial da empresa" 
                        className="rounded-xl h-11"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase opacity-60">CNPJ</Label>
                      <Input 
                        value={formData.cnpj}
                        onChange={e => {
                          const numbers = e.target.value.replace(/\D/g, "");
                          setFormData(prev => ({ ...prev, cnpj: numbers.substring(0, 14) }))
                        }}
                        placeholder="00.000.000/0000-00" 
                        className="rounded-xl h-11 font-mono"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">CPF do Representante Legal</Label>
                    <Input 
                      value={formData.representanteLegalCpf}
                      onChange={e => {
                        const numbers = e.target.value.replace(/\D/g, "");
                        setFormData(prev => ({ ...prev, representanteLegalCpf: numbers.substring(0, 11) }))
                      }}
                      placeholder="000.000.000-00" 
                      className="rounded-xl h-11 font-mono"
                      required
                    />
                  </div>
               </div>
             )}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3 pt-6">
           <Button type="submit" className="bg-secondary text-white font-black h-14 rounded-2xl px-12 shadow-xl shadow-secondary/20 uppercase italic" disabled={saving}>
              {saving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
              Salvar Alterações
           </Button>
        </div>
      </form>
    </div>
  );
}
