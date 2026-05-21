'use client';

import * as React from 'react';
import { useCurrentOrganization } from '@/contexts/OrganizationContext';
import { useFirestore, useFirebaseApp } from '@/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
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
  Building2, 
  Globe, 
  Phone, 
  Mail, 
  Instagram, 
  Info
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import Link from 'next/link';

export default function OrganizationSettingsPage() {
  const { currentOrg, userRole, refreshOrg } = useCurrentOrganization();
  const db = useFirestore();
  const app = useFirebaseApp();
  const storage = React.useMemo(() => app ? getStorage(app, "gs://viby") : null, [app]);

  const [saving, setSaving] = React.useState(false);
  const [formData, setFormData] = React.useState<any>(null);
  const [avatarProgress, setAvatarProgress] = React.useState<number | null>(null);
  const [bannerProgress, setBannerProgress] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (currentOrg) {
      setFormData({
        name: currentOrg.name || "",
        bio: currentOrg.bio || "",
        avatar: currentOrg.avatar || "",
        banner: currentOrg.banner || "",
        phone: currentOrg.phone || "",
        contactEmail: currentOrg.contactEmail || "",
        website: currentOrg.website || "",
        instagram: currentOrg.instagram || "",
        showPhone: currentOrg.showPhone ?? true,
        showEmail: currentOrg.showEmail ?? true,
        showWebsite: currentOrg.showWebsite ?? true,
        showInstagram: currentOrg.showInstagram ?? true,
      });
    }
  }, [currentOrg]);

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
      await updateDoc(doc(db, 'organizations', currentOrg.id), {
        ...formData,
        updatedAt: serverTimestamp(),
      });
      await refreshOrg();
      toast({ title: "Configurações salvas!", description: "Os dados da marca foram atualizados com sucesso." });
    } catch (error) {
      toast({ variant: "destructive", title: "Erro ao salvar" });
    } finally {
      setSaving(false);
    }
  };

  if (!formData) return null;

  const isOwnerOrAdmin = ['owner', 'admin'].includes(userRole || '');

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
        <Card className="border-none shadow-sm overflow-hidden rounded-[2.5rem]">
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

        <Card className="border-none shadow-sm rounded-[2rem]">
           <CardHeader><CardTitle className="text-lg">Informações da Marca</CardTitle></CardHeader>
           <CardContent className="space-y-6">
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
             className="bg-secondary text-white font-black h-14 rounded-2xl px-12 shadow-xl shadow-secondary/20 uppercase italic transition-all hover:scale-[1.02]"
             disabled={saving || !isOwnerOrAdmin}
           >
              {saving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
              Salvar Alterações
           </Button>
        </div>
      </form>

      <div className="p-6 bg-muted/30 rounded-3xl flex items-start gap-4">
         <Info className="w-6 h-6 text-primary shrink-0 opacity-20" />
         <p className="text-[10px] text-muted-foreground leading-relaxed font-medium uppercase">
            A mudança de username (URL) da organização não está disponível nesta tela por motivos de SEO e integridade de links. Para solicitar alteração da sua URL personalizada (viby.club/nome), entre em contato com o suporte.
         </p>
      </div>
    </div>
  );
}
