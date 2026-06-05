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
  Clock
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
      setFormData({
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
        legalName: currentOrg.legalName || "",
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

    setSaving(true);
    try {
      // Nota: Alteração de username removida deste fluxo por segurança.
      // Apenas administradores globais podem realizar esta ação via Painel Admin.
      const { username, ...updateData } = formData;

      await updateDoc(doc(db, 'organizations', currentOrg.id), {
        ...updateData,
        status: 'Ativo',
        deletionScheduledAt: deleteField(),
        updatedAt: serverTimestamp(),
      });

      await refreshOrg();
      toast({ title: "Configurações salvas!", description: "Os dados foram atualizados com sucesso." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao salvar", description: error.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!db || !currentOrg) return;
    setIsProcessingAction(true);
    try {
      await updateDoc(doc(db, 'organizations', currentOrg.id), {
        status: 'Desativado',
        updatedAt: serverTimestamp()
      });
      await refreshOrg();
      toast({ title: "Página desativada", description: "Sua marca e todos os seus eventos foram ocultados." });
    } catch (e) {
      toast({ variant: "destructive", title: "Erro na desativação" });
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleScheduleDeletion = async () => {
    if (!db || !currentOrg || !auth?.currentUser || !confirmPassword) return;
    
    setIsProcessingAction(true);
    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email!, confirmPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);

      const deletionDate = new Date();
      deletionDate.setDate(deletionDate.getDate() + 30);

      await updateDoc(doc(db, 'organizations', currentOrg.id), {
        status: 'Exclusão Programada',
        deletionScheduledAt: deletionDate.toISOString(),
        updatedAt: serverTimestamp()
      });

      await refreshOrg();
      toast({ title: "Exclusão Agendada", description: "A marca será removida em 30 dias. A página e eventos já estão ocultos." });
      setIsDeleteOpen(false);
      setConfirmPassword("");
    } catch (e: any) {
      toast({ variant: "destructive", title: "Senha incorreta", description: "Verifique seus dados de acesso." });
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleCancelDeletion = async () => {
    if (!db || !currentOrg) return;
    setIsProcessingAction(true);
    try {
      await updateDoc(doc(db, 'organizations', currentOrg.id), {
        status: 'Ativo',
        deletionScheduledAt: deleteField(),
        updatedAt: serverTimestamp()
      });
      await refreshOrg();
      toast({ title: "Exclusão cancelada!", description: "Sua marca e eventos voltaram ao ar normalmente." });
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao cancelar" });
    } finally {
      setIsProcessingAction(false);
    }
  };

  const canEditSettings = ['owner', 'admin'].includes(userRole || '');

  if (!canEditSettings) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <ShieldAlert className="w-16 h-16 text-muted-foreground opacity-20" />
        <h2 className="text-xl font-bold italic uppercase tracking-tighter">Acesso Restrito</h2>
        <p className="text-muted-foreground font-medium max-sm">Você não tem permissão para editar as configurações desta marca.</p>
        <Button asChild variant="outline" className="rounded-full mt-4"><Link href={`/dashboard/organizacoes/${currentOrg?.username}`}>Voltar ao Início</Link></Button>
      </div>
    );
  }

  if (!formData) return null;

  const isDeleting = currentOrg?.status === 'Exclusão Programada';
  const isDeactivated = currentOrg?.status === 'Desativado';

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
            <Settings className="w-8 h-8 text-secondary" />
            Configurações de Marca
          </h1>
          <p className="text-muted-foreground font-medium">Personalize a presença da sua organização na plataforma.</p>
        </div>
        
        <Button variant="ghost" size="sm" asChild className="rounded-full font-bold gap-2">
          <Link href={`/${currentOrg?.username}`} target="_blank">Ver Perfil Público <Globe className="w-4 h-4" /></Link>
        </Button>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        <Card className="border-none shadow-sm overflow-hidden rounded-[2rem]">
          <CardHeader className="bg-muted/30">
            <CardTitle className="text-lg flex items-center gap-2"><Camera className="w-5 h-5 text-secondary" /> Identidade Visual</CardTitle>
            <CardDescription>Fotos que representam a marca.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
             <div className="relative">
                <div 
                  className="h-48 bg-muted border-b border-border group cursor-pointer relative overflow-hidden"
                  onClick={() => document.getElementById('edit-org-banner')?.click()}
                >
                  {formData.banner ? <img src={formData.banner} className="w-full h-full object-cover" alt="Banner" /> : null}
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Camera className="text-white w-8 h-8" />
                  </div>
                  {bannerProgress !== null && <Progress value={bannerProgress} className="absolute bottom-0 h-1" />}
                  <input id="edit-org-banner" type="file" className="hidden" onChange={e => handleImageUpload(e, 'banner')} />
                </div>
                <div className="absolute -bottom-10 left-8">
                   <div className="relative group">
                      <Avatar className="h-28 w-28 border-4 border-background shadow-xl rounded-full">
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

        <Card className="border-none shadow-sm rounded-[2rem]">
           <CardHeader><CardTitle className="text-lg">Informações da Marca</CardTitle></CardHeader>
           <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase opacity-60">Nome de Exibição</Label>
                   <Input 
                     value={formData.name}
                     onChange={e => setFormData({...formData, name: e.target.value})}
                     required
                     className="rounded-xl h-11"
                   />
                </div>
                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase opacity-60">Username exclusivo (@)</Label>
                   <div className="relative">
                      <Input 
                        value={formData.username}
                        readOnly
                        className="rounded-xl h-11 bg-muted/50 border-none cursor-not-allowed pr-10 font-bold"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                         <Lock className="w-4 h-4 text-muted-foreground opacity-50" />
                      </div>
                   </div>
                   <p className="text-[8px] font-bold text-muted-foreground uppercase mt-1">Alteração de username permitida apenas via suporte ou painel global.</p>
                </div>
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

        <Card className="border-none shadow-sm rounded-[2rem]">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Fingerprint className="w-5 h-5 text-secondary" /> Dados Fiscais
            </CardTitle>
            <CardDescription>O CNPJ e Razão Social são obrigatórios para emissão de notas e recebimentos.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase opacity-60">Razão Social</Label>
                <Input 
                  value={formData.legalName}
                  onChange={e => setFormData({...formData, legalName: e.target.value})}
                  required
                  className="rounded-xl h-11"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase opacity-60">CNPJ</Label>
                <Input 
                  value={formData.cnpj}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, "");
                    setFormData({...formData, cnpj: val.substring(0, 14)});
                  }}
                  required
                  placeholder="00.000.000/0000-00"
                  className="rounded-xl h-11"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-[2rem]">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="w-5 h-5 text-secondary" /> Endereço e Localização
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">CEP</Label>
                <Input 
                  value={formData.cep}
                  onChange={e => setFormData({...formData, cep: e.target.value})}
                  onBlur={handleCepBlur}
                  required
                  className="rounded-xl h-11"
                />
              </div>
              <div className="md:col-span-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] font-black uppercase opacity-60">Logradouro / Rua</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] font-bold uppercase opacity-40">{formData.showAddress ? 'Público' : 'Oculto'}</span>
                    <Switch 
                      checked={formData.showAddress} 
                      onCheckedChange={checked => setFormData({...formData, showAddress: checked})} 
                    />
                  </div>
                </div>
                <Input 
                  value={formData.street}
                  onChange={e => setFormData({...formData, street: e.target.value})}
                  required
                  className="rounded-xl h-11"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase opacity-60">Número</Label>
                <Input 
                  value={formData.number}
                  onChange={e => setFormData({...formData, number: e.target.value})}
                  required
                  className="rounded-xl h-11"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase opacity-60">Complemento</Label>
                <Input 
                  value={formData.complement}
                  onChange={e => setFormData({...formData, complement: e.target.value})}
                  className="rounded-xl h-11"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] font-black uppercase opacity-60">Bairro</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] font-bold uppercase opacity-40">{formData.showNeighborhood ? 'Público' : 'Oculto'}</span>
                    <Switch 
                      checked={formData.showNeighborhood} 
                      onCheckedChange={checked => setFormData({...formData, showNeighborhood: checked})} 
                    />
                  </div>
                </div>
                <Input 
                  value={formData.neighborhood}
                  onChange={e => setFormData({...formData, neighborhood: e.target.value})}
                  required
                  className="rounded-xl h-11"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] font-black uppercase opacity-60">Cidade / UF</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] font-bold uppercase opacity-40">{formData.showState ? 'Público' : 'Oculto'}</span>
                    <Switch 
                      checked={formData.showState} 
                      onCheckedChange={checked => setFormData({...formData, showState: checked})} 
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Input value={formData.city} readOnly className="rounded-xl h-11 bg-muted/30" />
                  <Input value={formData.state} readOnly className="rounded-xl h-11 bg-muted/30 w-16" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-[2rem]">
           <CardHeader><CardTitle className="text-lg">Contato & Presença Digital</CardTitle></CardHeader>
           <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 {[
                   { id: 'phone', label: 'Telefone/WhatsApp', icon: Phone, show: 'showPhone' },
                   { id: 'contactEmail', label: 'E-mail de Contato', icon: Mail, show: 'showEmail' },
                   { id: 'website', label: 'Site Oficial', icon: Globe, show: 'showWebsite' },
                   { id: 'instagram', label: 'Instagram', icon: Instagram, show: 'showInstagram' },
                 ].map((field) => (
                   <div key={field.id} className="space-y-3">
                      <div className="flex items-center justify-between">
                         <Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-2">
                           <field.icon className="w-3 h-3" /> {field.label}
                         </Label>
                         <div className="flex items-center gap-2">
                            <span className="text-[8px] font-bold uppercase opacity-40">{formData[field.show] ? 'Público' : 'Oculto'}</span>
                            <Switch 
                              checked={formData[field.show]} 
                              onCheckedChange={checked => setFormData({...formData, [field.show]: checked})} 
                            />
                         </div>
                      </div>
                      <Input 
                        value={formData[field.id]}
                        onChange={e => setFormData({...formData, [field.id]: e.target.value})}
                        className="rounded-xl h-11"
                      />
                   </div>
                 ))}
              </div>
           </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
           <Button type="button" variant="ghost" asChild className="rounded-xl px-8 font-bold">
              <Link href={`/dashboard/organizacoes/${currentOrg.username}`}>Cancelar</Link>
           </Button>
           <Button 
             type="submit" 
             className="bg-secondary text-white font-black h-14 rounded-2xl px-12 shadow-xl shadow-secondary/20 uppercase italic transition-all hover:scale-102"
             disabled={saving}
           >
              {saving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
              {isDeleting || isDeactivated ? "Reativar & Salvar" : "Salvar Alterações"}
           </Button>
        </div>
      </form>

      <Card className="border-none shadow-sm rounded-[2rem] border-t-8 border-destructive/20 bg-white overflow-hidden">
        <CardHeader className="bg-destructive/5">
           <CardTitle className="text-lg flex items-center gap-2 text-destructive"><ShieldAlert className="w-5 h-5" /> Zona de Perigo</CardTitle>
           <CardDescription>Ações irreversíveis ou que afetam a visibilidade da marca.</CardDescription>
        </CardHeader>
        <CardContent className="p-8 space-y-8">
           {isDeleting ? (
             <div className="flex flex-col md:flex-row items-center justify-between gap-6 p-6 bg-orange-50 rounded-[1.5rem] border-2 border-dashed border-orange-200">
                <div className="flex items-center gap-4">
                   <div className="p-3 bg-orange-100 rounded-full text-orange-600"><Clock className="w-6 h-6 animate-pulse" /></div>
                   <div className="space-y-1">
                      <p className="font-black uppercase text-xs text-orange-800 italic">Exclusão Programada</p>
                      <p className="text-[10px] text-orange-700 font-medium">Sua marca será apagada permanentemente em <strong>{new Date(currentOrg.deletionScheduledAt).toLocaleDateString('pt-BR')}</strong>.</p>
                   </div>
                </div>
                <Button 
                  onClick={handleCancelDeletion} 
                  disabled={isProcessingAction}
                  className="bg-orange-600 text-white font-black rounded-xl h-11 px-8 shadow-lg uppercase text-[10px] italic"
                >
                   {isProcessingAction ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <RefreshCcw className="w-3 h-3 mr-2" />}
                   Cancelar Exclusão
                </Button>
             </div>
           ) : (
             <>
               <div className="flex flex-col md:flex-row items-center justify-between gap-6 border-b pb-8">
                  <div className="space-y-1 flex-1">
                     <p className="font-bold text-sm">Desativar Página</p>
                     <p className="text-[11px] text-muted-foreground">Oculta sua marca e suspende todos os eventos e vendas.</p>
                  </div>
                  <Button 
                    variant={isDeactivated ? "secondary" : "outline"} 
                    onClick={isDeactivated ? handleSave : handleDeactivate}
                    disabled={isProcessingAction}
                    className="rounded-xl h-11 px-8 font-bold uppercase text-[10px]"
                  >
                     {isProcessingAction ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : isDeactivated ? <RefreshCcw className="w-3 h-3 mr-2" /> : <EyeOff className="w-3 h-3 mr-2" />}
                     {isDeactivated ? "Ativar Página" : "Desativar Página"}
                  </Button>
               </div>

               <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="space-y-1 flex-1">
                     <p className="font-bold text-sm text-destructive">Excluir Organização</p>
                     <p className="text-[11px] text-muted-foreground">Remove permanentemente todos os eventos e dados da marca após 30 dias.</p>
                  </div>
                  <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteOpen}>
                    <DialogTrigger asChild>
                      <Button variant="destructive" className="rounded-xl h-11 px-8 font-black uppercase text-[10px] italic shadow-lg shadow-destructive/20">
                         <Trash2 className="w-3 h-3 mr-2" /> Excluir Marca
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="rounded-[2.5rem] max-w-sm">
                       <DialogHeader>
                          <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-2 text-destructive">
                             <AlertTriangle className="w-8 h-8" />
                          </div>
                          <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-center">Confirmar Exclusão</DialogTitle>
                          <DialogDescription className="text-center font-medium">
                             A página e eventos ficarão ocultos por 30 dias. Para confirmar, insira sua senha de acesso.
                          </DialogDescription>
                       </DialogHeader>
                       <div className="space-y-6 py-4">
                          <div className="space-y-2">
                             <Label className="text-[10px] font-black uppercase tracking-widest opacity-60 flex items-center gap-2"><Lock className="w-3 h-3" /> Sua Senha</Label>
                             <Input 
                                type="password" 
                                placeholder="••••••••" 
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                className="h-12 rounded-xl"
                             />
                          </div>
                       </div>
                       <DialogFooter>
                          <Button onClick={handleScheduleDeletion} disabled={isProcessingAction || !confirmPassword} className="w-full bg-destructive text-white font-black h-14 rounded-2xl shadow-xl uppercase italic">
                             {isProcessingAction ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : "Agendar Exclusão"}
                          </Button>
                       </DialogFooter>
                    </DialogContent>
                  </Dialog>
               </div>
             </>
           )}
        </CardContent>
      </Card>
    </div>
  );
}
