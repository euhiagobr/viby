
'use client';

import * as React from 'react';
import { useFirestore, useDoc, useFirebaseApp, useAuth, useUser } from '@/firebase';
import { doc, setDoc, serverTimestamp, increment } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Loader2, 
  Save, 
  CreditCard, 
  Globe, 
  Mail, 
  Coins, 
  Layout, 
  Upload, 
  ImageIcon, 
  Lock,
  Camera, 
  Target, 
  RefreshCw,
  Zap,
  CheckCircle2,
  Trash2,
  Plus,
  Megaphone,
  Settings
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { IMAGE_CACHE_METADATA } from '@/lib/image-utils';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function AdminConfiguracoesPage() {
  const db = useFirestore();
  const app = useFirebaseApp();
  const auth = useAuth();
  const { user } = useUser(auth);
  
  const storage = React.useMemo(() => {
    if (!app) return null;
    return getStorage(app);
  }, [app]);

  const siteRef = React.useMemo(() => (db ? doc(db, 'settings', 'site') : null), [db]);
  const stripeRef = React.useMemo(() => (db ? doc(db, 'settings', 'stripe') : null), [db]);
  const emailRef = React.useMemo(() => (db ? doc(db, 'settings', 'email') : null), [db]);
  const feesRef = React.useMemo(() => (db ? doc(db, 'settings', 'fees') : null), [db]);

  const { data: siteSettings, loading: loadingSite } = useDoc<any>(siteRef);
  const { data: stripeKeys, loading: loadingStripe } = useDoc<any>(stripeRef);
  const { data: emailSettings, loading: loadingEmail } = useDoc<any>(emailRef);
  const { data: globalFees, loading: loadingFees } = useDoc<any>(feesRef);

  const [saving, setSaving] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState<{ [key: string]: number | null }>({});

  const [siteForm, setSiteForm] = React.useState({ 
    siteName: 'Viby', 
    logoUrl: '', 
    siteIconUrl: '', 
    headerImages: ['', '', '', '', ''] as string[] 
  });
  const [stripeForm, setStripeForm] = React.useState({ publishableKey: '', secretKey: '', feePercent: '3.99', feeFixed: '0.39', mode: 'test' });
  const [emailForm, setEmailForm] = React.useState({ smtpHost: 'smtp.gmail.com', smtpPort: '465', smtpUser: '', smtpPass: '' });
  const [feesForm, setFeesForm] = React.useState({ buyerMarkupPercent: '15', organizerBasePercent: '10', organizerMinFee: '3.99' });

  React.useEffect(() => {
    if (siteSettings) {
      const existingHeaders = siteSettings.headerImages || [];
      const normalizedHeaders = [...existingHeaders];
      while (normalizedHeaders.length < 5) normalizedHeaders.push('');

      setSiteForm({ 
        siteName: siteSettings.siteName || 'Viby', 
        logoUrl: siteSettings.logoUrl || '', 
        siteIconUrl: siteSettings.siteIconUrl || siteSettings.iconUrl || '',
        headerImages: normalizedHeaders.slice(0, 5)
      });
    }
  }, [siteSettings]);

  React.useEffect(() => {
    if (stripeKeys) setStripeForm({ 
      publishableKey: stripeKeys.publishableKey || '', 
      secretKey: stripeKeys.secretKey || '', 
      feePercent: stripeKeys.feePercent?.toString() || '3.99', 
      feeFixed: stripeKeys.feeFixed?.toString() || '0.39', 
      mode: stripeKeys.mode || 'test' 
    });
  }, [stripeKeys]);

  React.useEffect(() => {
    if (emailSettings) setEmailForm({ 
      smtpHost: emailSettings.smtpHost || 'smtp.gmail.com', 
      smtpPort: emailSettings.smtpPort?.toString() || '465', 
      smtpUser: emailSettings.smtpUser || '', 
      smtpPass: emailSettings.smtpPass || '' 
    });
  }, [emailSettings]);

  React.useEffect(() => {
    if (globalFees) setFeesForm({ 
      buyerMarkupPercent: globalFees.buyerMarkupPercent?.toString() || '15', 
      organizerBasePercent: globalFees.organizerBasePercent?.toString() || '10', 
      organizerMinFee: globalFees.organizerMinFee?.toString() || '3.99' 
    });
  }, [globalFees]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'logoUrl' | 'siteIconUrl') => {
    const file = e.target.files?.[0];
    if (!file || !storage || !user) return;

    setUploadProgress(prev => ({ ...prev, [type]: 0 }));

    try {
      const fileName = `admin/site/${type}_${Date.now()}`;
      const storageRef = ref(storage, fileName);
      const uploadTask = uploadBytesResumable(storageRef, file, {
        cacheControl: 'public,max-age=31536000,immutable',
        customMetadata: { uploadedBy: user.uid }
      });

      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(prev => ({ ...prev, [type]: progress }));
        },
        (error) => {
          console.error("[Config-Upload] Logo Fail:", error);
          setUploadProgress(prev => ({ ...prev, [type]: null }));
          toast({ variant: "destructive", title: "Erro de Permissão", description: "Verifique seu nível de acesso administrativo." });
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          setSiteForm(prev => ({ ...prev, [type]: downloadURL }));
          setUploadProgress(prev => ({ ...prev, [type]: null }));
          toast({ title: "Arquivo atualizado!" });
        }
      );
    } catch (err: any) {
      setUploadProgress(prev => ({ ...prev, [type]: null }));
      toast({ variant: "destructive", title: "Falha Crítica", description: err.message });
    }
  };

  const handleHeaderUpload = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    // Validação robusta de sessão e instância
    if (!file || !storage || !user || !auth.currentUser) {
      toast({ variant: "destructive", title: "Sessão inválida", description: "Aguarde a sincronização da sua identidade de administrador." });
      return;
    }

    const progressKey = `header_${index}`;
    setUploadProgress(prev => ({ ...prev, [progressKey]: 0 }));

    try {
      const fileName = `admin/site/headers/banner_${index}_${Date.now()}`;
      const storageRef = ref(storage, fileName);
      
      // Metadata é importante para auditoria no Storage
      const metadata = {
        cacheControl: 'public,max-age=31536000,immutable',
        customMetadata: {
          adminUid: user.uid,
          slot: index.toString()
        }
      };

      const uploadTask = uploadBytesResumable(storageRef, file, metadata);

      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(prev => ({ ...prev, [progressKey]: progress }));
        },
        (error) => {
          console.error("[Config-Upload] Header Fail:", error.code, error.message);
          setUploadProgress(prev => ({ ...prev, [progressKey]: null }));
          toast({ 
            variant: "destructive", 
            title: "Acesso Negado (403)", 
            description: "O Storage não reconheceu sua permissão de Admin. Tente recarregar a página." 
          });
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          setSiteForm(prev => {
            const newHeaders = [...prev.headerImages];
            newHeaders[index] = downloadURL;
            return { ...prev, headerImages: newHeaders };
          });
          setUploadProgress(prev => ({ ...prev, [progressKey]: null }));
          toast({ title: "Banner carregado!" });
        }
      );
    } catch (err: any) {
      setUploadProgress(prev => ({ ...prev, [progressKey]: null }));
      toast({ variant: "destructive", title: "Falha Técnica", description: err.message });
    }
  };

  const handleSave = async (coll: string, docId: string, data: any) => {
    if (!db || !user) return;
    setSaving(true);
    
    const updatePayload: any = { 
      ...data, 
      updatedAt: serverTimestamp(),
      updatedBy: user.uid
    };

    if (docId === 'fees' || docId === 'stripe') {
      Object.keys(data).forEach(key => {
        if (typeof data[key] === 'string' && !isNaN(parseFloat(data[key]))) {
          updatePayload[key] = parseFloat(data[key]);
        }
      });
    }

    if (docId === 'site') {
      updatePayload.imageVersion = increment(1);
      updatePayload.headerImages = data.headerImages.filter(Boolean);
    }

    try {
      await setDoc(doc(db, coll, docId), updatePayload, { merge: true });
      toast({ title: 'Configuração salva!' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: error.message });
    } finally {
      setSaving(false);
    }
  };

  const isLoading = loadingSite || loadingStripe || loadingEmail || loadingFees;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <Loader2 className="animate-spin text-secondary w-10 h-10" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
          <Globe className="w-8 h-8 text-secondary" /> Configurações Globais
        </h1>
        <p className="text-muted-foreground font-medium">Gestão de identidade, financeira e integrações da rede.</p>
      </div>

      <Tabs defaultValue="geral" className="space-y-6">
        <TabsList className="bg-muted/50 p-1 rounded-xl h-auto flex-wrap justify-start">
          <TabsTrigger value="geral" className="rounded-lg px-6 font-bold gap-2"><Layout className="w-4 h-4" /> Geral</TabsTrigger>
          <TabsTrigger value="pagamentos" className="rounded-lg px-6 font-bold gap-2"><CreditCard className="w-4 h-4" /> Pagamentos</TabsTrigger>
          <TabsTrigger value="taxas" className="rounded-lg px-6 font-bold gap-2"><Coins className="w-4 h-4" /> Taxas</TabsTrigger>
          <TabsTrigger value="email" className="rounded-lg px-6 font-bold gap-2"><Mail className="w-4 h-4" /> E-mail</TabsTrigger>
		      <TabsTrigger value="anuncios" className="rounded-lg px-6 font-bold gap-2"><Megaphone className="w-4 h-4" /> Anúncios</TabsTrigger>
		      <TabsTrigger value="google-ads" className="rounded-lg px-6 font-bold gap-2"><Settings className="w-4 h-4" /> Google Ads</TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="space-y-8">
          <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden bg-white max-w-4xl">
            <CardHeader className="bg-muted/30 p-8 border-b">
               <CardTitle className="text-xl font-black italic uppercase tracking-tighter">Identidade Visual</CardTitle>
               <CardDescription className="font-medium">Nome da rede, logotipos e banners rotativos da Home.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-10">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase opacity-60">Nome da Plataforma</Label>
                <Input value={siteForm.siteName} onChange={e => setSiteForm({...siteForm, siteName: e.target.value})} className="rounded-xl h-11" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                 <div className="space-y-4">
                    <Label className="text-[10px] font-black uppercase opacity-60">Logotipo Principal</Label>
                    <div className="relative h-24 bg-muted/20 rounded-2xl border-2 border-dashed border-border flex items-center justify-center overflow-hidden group">
                       {siteForm.logoUrl ? (
                         <img src={siteForm.logoUrl} className="max-h-full object-contain" alt="Logo" />
                       ) : <ImageIcon className="w-8 h-8 opacity-10" />}
                       <label htmlFor="logo-up" className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer text-white">
                          <Upload className="w-6 h-6" />
                       </label>
                       <input id="logo-up" type="file" className="hidden" accept="image/*" onChange={e => handleFileUpload(e, 'logoUrl')} />
                       {uploadProgress.logoUrl !== null && uploadProgress.logoUrl !== undefined && <Progress value={uploadProgress.logoUrl} className="absolute bottom-0 h-1" />}
                    </div>
                 </div>
                 <div className="space-y-4">
                    <Label className="text-[10px] font-black uppercase opacity-60">Ícone Global (Favicon)</Label>
                    <div className="relative h-24 bg-muted/20 rounded-2xl border-2 border-dashed border-border flex items-center justify-center overflow-hidden group">
                       {siteForm.siteIconUrl ? (
                         <img src={siteForm.siteIconUrl} className="h-12 w-12 object-contain" alt="Icon" />
                       ) : <Target className="w-8 h-8 opacity-10" />}
                       <label htmlFor="icon-up" className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer text-white">
                          <Upload className="w-6 h-6" />
                       </label>
                       <input id="icon-up" type="file" className="hidden" accept="image/*" onChange={e => handleFileUpload(e, 'siteIconUrl')} />
                       {uploadProgress.siteIconUrl !== null && uploadProgress.siteIconUrl !== undefined && <Progress value={uploadProgress.siteIconUrl} className="absolute bottom-0 h-1" />}
                    </div>
                 </div>
              </div>

              <Separator className="border-dashed" />

              <div className="space-y-6">
                 <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-black uppercase opacity-60">Banners do Carrossel (Até 5 Imagens)</Label>
                    <Badge variant="outline" className="text-[8px] font-black uppercase border-dashed">Alternância: 4s</Badge>
                 </div>
                 
                 <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
                    {Array.from({ length: 5 }).map((_, i) => {
                      const img = siteForm.headerImages[i];
                      const progressKey = `header_${i}`;
                      return (
                        <div key={i} className="relative aspect-[16/9] bg-muted/20 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center overflow-hidden group">
                           {img ? (
                             <>
                               <img src={img} className="w-full h-full object-cover" alt="" />
                               <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                  <label htmlFor={`header-up-${i}`} className="p-1 bg-white text-primary rounded-full cursor-pointer hover:bg-secondary hover:text-white transition-colors">
                                     <RefreshCw className="w-3.5 h-3.5" />
                                  </label>
                                  <button 
                                    type="button" 
                                    onClick={() => {
                                      const newHeaders = [...siteForm.headerImages];
                                      newHeaders[i] = "";
                                      setSiteForm({ ...siteForm, headerImages: newHeaders });
                                    }}
                                    className="p-1 bg-white text-destructive rounded-full hover:bg-destructive hover:text-white transition-colors"
                                  >
                                     <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                               </div>
                             </>
                           ) : (
                             <label htmlFor={`header-up-${i}`} className="cursor-pointer opacity-30 hover:opacity-100 transition-opacity flex flex-col items-center gap-1">
                                <Plus className="w-5 h-5" />
                                <span className="text-[8px] font-black uppercase">Slot {i+1}</span>
                             </label>
                           )}
                           <input id={`header-up-${i}`} type="file" className="hidden" accept="image/*" onChange={e => handleHeaderUpload(e, i)} />
                           {uploadProgress[progressKey] !== null && uploadProgress[progressKey] !== undefined && (
                             <Progress value={uploadProgress[progressKey]} className="absolute bottom-0 h-1" />
                           )}
                        </div>
                      );
                    })}
                 </div>
              </div>

              <Button onClick={() => handleSave('settings', 'site', siteForm)} disabled={saving} className="w-full h-14 bg-primary text-white font-black rounded-2xl shadow-xl uppercase italic text-lg transition-transform">
                {saving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />} Salvar Identidade
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pagamentos">
           <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden bg-white max-w-4xl">
              <CardHeader className="bg-muted/30 p-8 border-b">
                 <CardTitle className="text-xl font-black italic uppercase tracking-tighter">Gateway Stripe</CardTitle>
                 <CardDescription>Credenciais de conexão Connect.</CardDescription>
              </CardHeader>
              <CardContent className="p-8 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <Button variant={stripeForm.mode === 'test' ? 'secondary' : 'outline'} className="rounded-xl h-11 font-bold gap-2" onClick={() => setStripeForm({...stripeForm, mode: 'test'})}><RefreshCw className="w-4 h-4" /> Modo Teste</Button>
                   <Button variant={stripeForm.mode === 'live' ? 'secondary' : 'outline'} className="rounded-xl h-11 font-bold gap-2" onClick={() => setStripeForm({...stripeForm, mode: 'live'})}><Globe className="w-4 h-4" /> Modo Produção</Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-2"><RefreshCw className="w-3 h-3" /> Publishable Key</Label>
                      <Input value={stripeForm.publishableKey} onChange={e => setStripeForm({...stripeForm, publishableKey: e.target.value})} className="rounded-xl h-11 font-mono text-xs" />
                   </div>
                   <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-2"><Lock className="w-3 h-3" /> Secret Key</Label>
                      <Input type="password" value={stripeForm.secretKey} onChange={e => setStripeForm({...stripeForm, secretKey: e.target.value})} className="rounded-xl h-11 font-mono text-xs" />
                   </div>
                </div>
                <Button onClick={() => handleSave('settings', 'stripe', stripeForm)} disabled={saving} className="w-full h-14 bg-primary text-white font-black rounded-2xl shadow-xl uppercase italic">
                   Atualizar Pagamentos
                </Button>
              </CardContent>
           </Card>
        </TabsContent>

        <TabsContent value="taxas">
           <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden bg-white max-w-4xl">
              <CardHeader className="bg-muted/30 p-8 border-b">
                 <CardTitle className="text-xl font-black italic uppercase tracking-tighter">Regras Financeiras</CardTitle>
                 <CardDescription>Taxas padrão aplicadas a todas as vendas.</CardDescription>
              </CardHeader>
              <CardContent className="p-8 space-y-8">
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase opacity-60">Markup Comprador (%)</Label>
                       <Input value={feesForm.buyerMarkupPercent} onChange={e => setFeesForm({...feesForm, buyerMarkupPercent: e.target.value})} className="rounded-xl h-11" />
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase opacity-60">Comissão Produtor (%)</Label>
                       <Input value={feesForm.organizerBasePercent} onChange={e => setFeesForm({...feesForm, organizerBasePercent: e.target.value})} className="rounded-xl h-11" />
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase opacity-60">Valor Mínimo (R$)</Label>
                       <Input value={feesForm.organizerMinFee} onChange={e => setFeesForm({...feesForm, organizerMinFee: e.target.value})} className="rounded-xl h-11" />
                    </div>
                 </div>
                 <Button onClick={() => handleSave('settings', 'fees', feesForm)} disabled={saving} className="w-full h-14 bg-primary text-white font-black rounded-2xl shadow-xl uppercase italic">
                    Atualizar Taxas
                 </Button>
              </CardContent>
           </Card>
        </TabsContent>

        <TabsContent value="email">
           <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden bg-white max-w-4xl">
              <CardHeader className="bg-muted/30 p-8 border-b">
                 <CardTitle className="text-xl font-black italic uppercase tracking-tighter">Servidor de E-mail (SMTP)</CardTitle>
                 <CardDescription>Credenciais para envio de e-mails transacionais.</CardDescription>
              </CardHeader>
              <CardContent className="p-8 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase opacity-60">Host do Servidor</Label>
                      <Input value={emailForm.smtpHost} onChange={e => setEmailForm({...emailForm, smtpHost: e.target.value})} className="rounded-xl h-11" />
                   </div>
                   <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase opacity-60">Porta (ex: 465, 587)</Label>
                      <Input value={emailForm.smtpPort} onChange={e => setEmailForm({...emailForm, smtpPort: e.target.value})} className="rounded-xl h-11" />
                   </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase opacity-60">Usuário SMTP</Label>
                      <Input value={emailForm.smtpUser} onChange={e => setEmailForm({...emailForm, smtpUser: e.target.value})} className="rounded-xl h-11" />
                   </div>
                   <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase opacity-60">Senha SMTP</Label>
                      <Input type="password" value={emailForm.smtpPass} onChange={e => setEmailForm({...emailForm, smtpPass: e.target.value})} className="rounded-xl h-11" />
                   </div>
                </div>
                <Button onClick={() => handleSave('settings', 'email', emailForm)} disabled={saving} className="w-full h-14 bg-primary text-white font-black rounded-2xl shadow-xl uppercase italic">
                   Salvar Configuração de E-mail
                </Button>
              </CardContent>
           </Card>
        </TabsContent>

		<TabsContent value="anuncios">
			<Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden bg-white max-w-4xl">
				<CardHeader className="bg-muted/30 p-8 border-b">
					<CardTitle className="text-xl font-black italic uppercase tracking-tighter">Anúncios</CardTitle>
					<CardDescription>Configurações de anúncios da plataforma.</CardDescription>
				</CardHeader>
				<CardContent className="p-8 space-y-8">
					<p>Aqui você pode configurar as opções de anúncios.</p>
				</CardContent>
			</Card>
		</TabsContent>

		<TabsContent value="google-ads">
			<Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden bg-white max-w-4xl">
				<CardHeader className="bg-muted/30 p-8 border-b">
					<CardTitle className="text-xl font-black italic uppercase tracking-tighter">Google Ads</CardTitle>
					<CardDescription>Configurações de integração com o Google Ads.</CardDescription>
				</CardHeader>
				<CardContent className="p-8 space-y-8">
					<p>Aqui você pode configurar a integração com o Google Ads.</p>
				</CardContent>
			</Card>
		</TabsContent>

      </Tabs>
    </div>
  );
}
