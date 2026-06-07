'use client';

import * as React from 'react';
import { useCurrentOrganization } from '@/contexts/OrganizationContext';
import { useFirestore, useFirebaseApp, useAuth } from '@/firebase';
import { doc, updateDoc, serverTimestamp, deleteField } from 'firebase/firestore';
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
  User
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { cn, validateCPF, validateCNPJ } from '@/lib/utils';

export default function OrganizationSettingsPage() {
  const { currentOrg, userRole, refreshOrg } = useCurrentOrganization();
  const db = useFirestore();
  const auth = useAuth();
  const app = useFirebaseApp();
  const storage = React.useMemo(() => app ? getStorage(app) : null, [app]);

  const [saving, setSaving] = React.useState(false);
  const [formData, setFormData] = React.useState<any>(null);
  const [avatarProgress, setAvatarProgress] = React.useState<number | null>(null);
  const [bannerProgress, setBannerProgress] = React.useState<number | null>(null);

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
  const isOwnerOrAdmin = ['owner', 'admin'].includes(userRole || '');

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
          <Settings className="w-8 h-8 text-secondary" /> Configurações de Marca
        </h1>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        {/* TIPO DE CONTA (IMUTÁVEL APÓS CRIAÇÃO NO STRIPE) */}
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
          </CardContent>
        </Card>

        {/* IDENTIDADE VISUAL (PRESERVADA) */}
        <Card className="border-none shadow-sm overflow-hidden rounded-[2.5rem]">
          <CardHeader className="bg-muted/30">
            <CardTitle className="text-lg flex items-center gap-2"><Camera className="w-5 h-5 text-secondary" /> Identidade Visual</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
             <div className="relative">
                <div 
                  className="h-48 bg-muted border-b border-border group cursor-pointer relative overflow-hidden"
                  onClick={() => document.getElementById('edit-org-banner')?.click()}
                >
                  {formData.banner ? <img src={formData.banner} className="w-full h-full object-cover" /> : null}
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Camera className="text-white w-8 h-8" />
                  </div>
                  {bannerProgress !== null && <Progress value={bannerProgress} className="absolute bottom-0 h-1" />}
                  <input id="edit-org-banner" type="file" className="hidden" onChange={e => handleImageUpload(e, 'banner')} />
                </div>
                <div className="absolute -bottom-10 left-8">
                   <div className="relative group">
                      <Avatar className="h-28 w-28 border-4 border-background shadow-xl">
                         <AvatarImage src={formData.avatar} className="object-cover" />
                         <AvatarFallback className="bg-muted"><Building2 className="w-10 h-10 opacity-20" /></AvatarFallback>
                      </Avatar>
                      <label htmlFor="edit-org-avatar" className="absolute inset-0 flex items-center justify-center bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                        <Camera className="w-6 h-6" />
                      </label>
                      <input id="edit-org-avatar" type="file" className="hidden" onChange={e => handleImageUpload(e, 'avatar')} />
                      {avatarProgress !== null && <Progress value={avatarProgress} className="absolute -bottom-2 h-1" />}
                   </div>
                </div>
             </div>
             <div className="h-12" />
          </CardContent>
        </Card>

        {/* Informações Básicas (PRESERVADAS) */}
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

        {/* NOVOS CAMPOS FISCAIS */}
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

        {/* Endereço (PRESERVADO) */}
        <Card className="border-none shadow-sm rounded-[2rem]">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><MapPin className="w-5 h-5 text-secondary" /> Endereço Sede</CardTitle>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase opacity-60">CEP</Label>
                <Input value={formData.cep} onChange={e => setFormData({...formData, cep: e.target.value})} onBlur={handleCepBlur} required className="rounded-xl h-11" />
              </div>
              <div className="md:col-span-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] font-black uppercase opacity-60">Rua / Logradouro</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] font-bold uppercase opacity-40">{formData.showAddress ? 'Público' : 'Oculto'}</span>
                    <Switch checked={formData.showAddress} onCheckedChange={c => setFormData({...formData, showAddress: c})} />
                  </div>
                </div>
                <Input value={formData.street} onChange={e => setFormData({...formData, street: e.target.value})} required className="rounded-xl h-11" />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Nº</Label><Input value={formData.number} onChange={e => setFormData({...formData, number: e.target.value})} required className="rounded-xl h-11" /></div>
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Complemento</Label><Input value={formData.complement} onChange={e => setFormData({...formData, complement: e.target.value})} className="rounded-xl h-11" /></div>
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Bairro</Label><Input value={formData.neighborhood} onChange={e => setFormData({...formData, neighborhood: e.target.value})} required className="rounded-xl h-11" /></div>
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Cidade / UF</Label><div className="flex gap-2"><Input value={formData.city} readOnly className="rounded-xl h-11 bg-muted/30" /><Input value={formData.state} readOnly className="rounded-xl h-11 bg-muted/30 w-16" /></div></div>
            </div>
          </CardContent>
        </Card>

        {/* Contato (PRESERVADO) */}
        <Card className="border-none shadow-sm rounded-[2rem]">
           <CardHeader><CardTitle className="text-lg">Presença Digital e Contato</CardTitle></CardHeader>
           <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="space-y-3">
                    <div className="flex items-center justify-between"><Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-2"><Phone className="w-3 h-3" /> WhatsApp</Label><Switch checked={formData.showPhone} onCheckedChange={c => setFormData({...formData, showPhone: c})} /></div>
                    <Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="rounded-xl h-11" />
                 </div>
                 <div className="space-y-3">
                    <div className="flex items-center justify-between"><Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-2"><Mail className="w-3 h-3" /> E-mail</Label><Switch checked={formData.showEmail} onCheckedChange={c => setFormData({...formData, showEmail: c})} /></div>
                    <Input value={formData.contactEmail} onChange={e => setFormData({...formData, contactEmail: e.target.value})} className="rounded-xl h-11" />
                 </div>
                 <div className="space-y-3">
                    <div className="flex items-center justify-between"><Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-2"><Globe className="w-3 h-3" /> Site</Label><Switch checked={formData.showWebsite} onCheckedChange={c => setFormData({...formData, showWebsite: c})} /></div>
                    <Input value={formData.website} onChange={e => setFormData({...formData, website: e.target.value})} className="rounded-xl h-11" />
                 </div>
                 <div className="space-y-3">
                    <div className="flex items-center justify-between"><Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-2"><Instagram className="w-3 h-3" /> Instagram</Label><Switch checked={formData.showInstagram} onCheckedChange={c => setFormData({...formData, showInstagram: c})} /></div>
                    <Input value={formData.instagram} onChange={e => setFormData({...formData, instagram: e.target.value})} className="rounded-xl h-11" />
                 </div>
              </div>
           </CardContent>
        </Card>

        <div className="flex justify-end gap-3 pt-6">
           <Button type="submit" className="bg-secondary text-white font-black h-14 rounded-2xl px-12 shadow-xl shadow-secondary/20 uppercase italic" disabled={saving || !isOwnerOrAdmin}>
              {saving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
              Salvar Alterações
           </Button>
        </div>
      </form>
    </div>
  );
}
