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
  Camera, 
  Target, 
  RefreshCw,
  Megaphone,
  Zap,
  CalendarDays,
  Info,
  AlertTriangle
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { IMAGE_CACHE_METADATA } from '@/lib/image-utils';

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
  const adsRef = React.useMemo(() => (db ? doc(db, 'settings', 'ads') : null), [db]);
  const googleAdsRef = React.useMemo(() => (db ? doc(db, 'system_settings', 'google_ads') : null), [db]);
  const eventTypesRef = React.useMemo(() => (db ? doc(db, 'settings', 'event_types') : null), [db]);

  const { data: siteSettings, loading: loadingSite } = useDoc<any>(siteRef);
  const { data: stripeKeys, loading: loadingStripe } = useDoc<any>(stripeRef);
  const { data: emailSettings, loading: loadingEmail } = useDoc<any>(emailRef);
  const { data: globalFees, loading: loadingFees } = useDoc<any>(feesRef);
  const { data: adsSettings, loading: loadingAdsSettings } = useDoc<any>(adsRef);
  const { data: googleAds, loading: loadingGoogle } = useDoc<any>(googleAdsRef);
  const { data: eventTypesSettings, loading: loadingEventTypes } = useDoc<any>(eventTypesRef);

  const [saving, setSaving] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState<{ [key: string]: number | null }>({});

  const [siteForm, setSiteForm] = React.useState({ siteName: 'Viby', logoUrl: '', iconUrl: '', siteIconUrl: '' });
  const [stripeForm, setStripeForm] = React.useState({ publishableKey: '', secretKey: '', feePercent: '3.99', feeFixed: '0.39', mode: 'test' });
  const [emailForm, setEmailForm] = React.useState({ smtpHost: 'smtp.gmail.com', smtpPort: '465', smtpUser: '', smtpPass: '' });
  const [feesForm, setFeesForm] = React.useState({ buyerMarkupPercent: '15', organizerBasePercent: '10', organizerMinFee: '3.99' });
  const [adsForm, setAdsForm] = React.useState({ minRechargeValue: '30.00', cpcValue: '0.50', cpmValue: '10.00' });
  const [googleAdsForm, setGoogleAdsForm] = React.useState({ enabled: false, publisherId: '', adsenseCode: '', autoAds: true, testMode: false });
  const [eventTypesForm, setEventTypesForm] = React.useState({
    divulgacao: { enabled: true, message: "" },
    interno: { enabled: true, message: "" },
    externo: { enabled: true, message: "" }
  });

  React.useEffect(() => {
    if (siteSettings) setSiteForm({ 
      siteName: siteSettings.siteName || 'Viby', 
      logoUrl: siteSettings.logoUrl || '', 
      iconUrl: siteSettings.iconUrl || '',
      siteIconUrl: siteSettings.siteIconUrl || siteSettings.iconUrl || ''
    });
    if (stripeKeys) setStripeForm({ publishableKey: stripeKeys.publishableKey || '', secretKey: stripeKeys.secretKey || '', feePercent: stripeKeys.feePercent?.toString() || '3.99', feeFixed: stripeKeys.feeFixed?.toString() || '0.39', mode: stripeKeys.mode || 'test' });
    if (emailSettings) setEmailForm({ smtpHost: emailSettings.smtpHost || 'smtp.gmail.com', smtpPort: emailSettings.smtpPort?.toString() || '465', smtpUser: emailSettings.smtpUser || '', smtpPass: emailSettings.smtpPass || '' });
    if (globalFees) setFeesForm({ buyerMarkupPercent: globalFees.buyerMarkupPercent?.toString() || '15', organizerBasePercent: globalFees.organizerBasePercent?.toString() || '10', organizerMinFee: globalFees.organizerMinFee?.toString() || '3.99' });
    if (adsSettings) setAdsForm({ minRechargeValue: adsSettings.minRechargeValue?.toString() || '30.00', cpcValue: adsSettings.cpcValue?.toString() || '0.50', cpmValue: adsSettings.cpmValue?.toString() || '10.00' });
    if (googleAds) setGoogleAdsForm({ enabled: googleAds.enabled ?? false, publisherId: googleAds.publisherId || '', adsenseCode: googleAds.adsenseCode || '', autoAds: googleAds.autoAds ?? true, testMode: googleAds.testMode ?? false });
    if (eventTypesSettings) setEventTypesForm({
      divulgacao: eventTypesSettings.divulgacao || { enabled: true, message: "" },
      interno: eventTypesSettings.interno || { enabled: true, message: "" },
      externo: eventTypesSettings.externo || { enabled: true, message: "" }
    });
  }, [siteSettings, stripeKeys, emailSettings, globalFees, adsSettings, googleAds, eventTypesSettings]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'logoUrl' | 'siteIconUrl') => {
    const file = e.target.files?.[0];
    if (!file || !storage || !user) return;

    setUploadProgress(prev => ({ ...prev, [type]: 0 }));

    try {
      const fileName = `admin/site/${type}_${Date.now()}`;
      const storageRef = ref(storage, fileName);
      const uploadTask = uploadBytesResumable(storageRef, file, IMAGE_CACHE_METADATA);

      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(prev => ({ ...prev, [type]: progress }));
        },
        (error) => {
          setUploadProgress(prev => ({ ...prev, [type]: null }));
          toast({ variant: "destructive", title: "Erro no upload", description: error.message });
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          setSiteForm(prev => ({ ...prev, [type]: downloadURL, iconUrl: type === 'siteIconUrl' ? downloadURL : prev.iconUrl }));
          setUploadProgress(prev => ({ ...prev, [type]: null }));
          toast({ title: "Upload concluído!", description: `${type === 'logoUrl' ? 'Logo' : 'Ícone'} atualizado.` });
        }
      );
    } catch (err) {
      setUploadProgress(prev => ({ ...prev, [type]: null }));
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

    if (docId === 'fees' || docId === 'ads' || docId === 'stripe') {
      Object.keys(data).forEach(key => {
        if (typeof data[key] === 'string' && !isNaN(parseFloat(data[key]))) {
          updatePayload[key] = parseFloat(data[key]);
        }
      });
    }

    if (docId === 'site') {
      updatePayload.imageVersion = increment(1);
    }

    try {
      await setDoc(doc(db, coll, docId), updatePayload, { merge: true });
      toast({ title: 'Configuração salva!', description: `Os dados de "${docId}" foram atualizados.` });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: error.message });
    } finally {
      setSaving(false);
    }
  };

  if (loadingSite || loadingStripe || loadingEmail || loadingFees || loadingAdsSettings || loadingGoogle || loadingEventTypes) {
    return <div className="flex justify-center items-center h-[60vh]"><Loader2 className="animate-spin text-secondary" /></div>;
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
          <Globe className="w-8 h-8 text-secondary" /> Configurações
        </h1>
        <p className="text-muted-foreground font-medium">Gestão global de parâmetros, financeiros e segurança.</p>
      </div>

      <Tabs defaultValue="geral" className="space-y-6">
        <TabsList className="bg-muted/50 p-1 rounded-xl h-12 flex-wrap">
          <TabsTrigger value="geral" className="rounded-lg px-6 font-bold gap-2"><Layout className="w-4 h-4" /> Geral</TabsTrigger>
          <TabsTrigger value="eventos" className="rounded-lg px-6 font-bold gap-2"><CalendarDays className="w-4 h-4" /> Eventos</TabsTrigger>
          <TabsTrigger value="pagamentos" className="rounded-lg px-6 font-bold gap-2"><CreditCard className="w-4 h-4" /> Pagamentos</TabsTrigger>
          <TabsTrigger value="email" className="rounded-lg px-6 font-bold gap-2"><Mail className="w-4 h-4" /> E-mail</TabsTrigger>
          <TabsTrigger value="taxas" className="rounded-lg px-6 font-bold gap-2"><Coins className="w-4 h-4" /> Taxas</TabsTrigger>
          <TabsTrigger value="ads" className="rounded-lg px-6 font-bold gap-2"><Megaphone className="w-4 h-4" /> Anúncios</TabsTrigger>
          <TabsTrigger value="google-ads" className="rounded-lg px-6 font-bold gap-2"><Target className="w-4 h-4" /> Google Ads</TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="animate-in fade-in slide-in-from-top-2 duration-300">
          <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden bg-white max-w-4xl">
            <CardHeader className="bg-muted/30 p-8 border-b">
               <CardTitle className="text-xl font-black italic uppercase tracking-tighter">Identidade da Plataforma</CardTitle>
               <CardDescription>Gerencie o nome, logo e o favicon oficial do site.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase opacity-60">Nome da Plataforma</Label>
                <Input value={siteForm.siteName} onChange={e => setSiteForm({...siteForm, siteName: e.target.value})} className="rounded-xl h-11" placeholder="Ex: Viby.Club" />
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
                       {uploadProgress.logoUrl !== null && <Progress value={uploadProgress.logoUrl} className="absolute bottom-0 h-1" />}
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
                       {uploadProgress.siteIconUrl !== null && <Progress value={uploadProgress.siteIconUrl} className="absolute bottom-0 h-1" />}
                    </div>
                 </div>
              </div>

              <Button onClick={() => handleSave('settings', 'site', siteForm)} disabled={saving} className="w-full h-14 bg-primary text-white font-black rounded-2xl shadow-xl uppercase italic text-lg transition-transform">
                {saving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />} Salvar Identidade
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="eventos" className="animate-in fade-in slide-in-from-top-2 duration-300">
          <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden bg-white max-w-4xl">
            <CardHeader className="bg-muted/30 p-8 border-b">
               <CardTitle className="text-xl font-black italic uppercase tracking-tighter">Controle de Tipos de Evento</CardTitle>
               <CardDescription>Habilite ou desabilite modalidades de eventos e adicione avisos aos produtores.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-10">
               <div className="space-y-8">
                  <EventTypeControl 
                    title="Apenas Divulgação" 
                    desc="Eventos sem link de compra, apenas para visibilidade."
                    config={eventTypesForm.divulgacao}
                    onChange={(v) => setEventTypesForm({...eventTypesForm, divulgacao: v})}
                  />
                  <Separator className="border-dashed" />
                  <EventTypeControl 
                    title="Vendas na Viby (Interno)" 
                    desc="Processamento de pagamentos nativo pela plataforma."
                    config={eventTypesForm.interno}
                    onChange={(v) => setEventTypesForm({...eventTypesForm, interno: v})}
                  />
                  <Separator className="border-dashed" />
                  <EventTypeControl 
                    title="Vendas Externas" 
                    desc="Permite que o organizador insira um link de terceiros."
                    config={eventTypesForm.externo}
                    onChange={(v) => setEventTypesForm({...eventTypesForm, externo: v})}
                  />
               </div>

               <Button 
                onClick={() => handleSave('settings', 'event_types', eventTypesForm)} 
                disabled={saving} 
                className="w-full h-14 bg-primary text-white font-black rounded-2xl shadow-xl uppercase italic text-lg"
               >
                 {saving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />} Salvar Regras de Evento
               </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pagamentos" className="animate-in fade-in slide-in-from-top-2 duration-300">
          <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden bg-white max-w-2xl">
            <CardHeader className="bg-muted/30 p-8 border-b">
               <CardTitle className="text-xl font-black italic uppercase tracking-tighter">Gateway Stripe</CardTitle>
               <CardDescription>Conecte as chaves da API para habilitar transações reais.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-2">
                 <Button variant={stripeForm.mode === 'test' ? 'secondary' : 'outline'} className="rounded-xl h-11 font-bold gap-2" onClick={() => setStripeForm({...stripeForm, mode: 'test'})}><RefreshCw className="w-4 h-4" /> Modo Teste</Button>
                 <Button variant={stripeForm.mode === 'live' ? 'secondary' : 'outline'} className="rounded-xl h-11 font-bold gap-2" onClick={() => setStripeForm({...stripeForm, mode: 'live'})}><Globe className="w-4 h-4" /> Modo Produção</Button>
              </div>
              <div className="space-y-4">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">Publishable Key</Label>
                    <Input value={stripeForm.publishableKey} onChange={e => setStripeForm({...stripeForm, publishableKey: e.target.value})} className="rounded-xl h-11 font-mono text-xs" placeholder="pk_..." />
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">Secret Key</Label>
                    <Input type="password" value={stripeForm.secretKey} onChange={e => setStripeForm({...stripeForm, secretKey: e.target.value})} className="rounded-xl h-11 font-mono text-xs" placeholder="sk_..." />
                 </div>
              </div>
              <Button onClick={() => handleSave('settings', 'stripe', stripeForm)} disabled={saving} className="w-full h-12 bg-primary text-white font-black rounded-xl uppercase italic">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} Atualizar Stripe
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email" className="animate-in fade-in slide-in-from-top-2 duration-300">
           <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden bg-white max-w-2xl">
              <CardHeader className="bg-muted/30 p-8 border-b">
                 <CardTitle className="text-xl font-black italic uppercase tracking-tighter">Servidor SMTP</CardTitle>
                 <CardDescription>Configurações para disparos de e-mails transacionais.</CardDescription>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Host SMTP</Label><Input value={emailForm.smtpHost} onChange={e => setEmailForm({...emailForm, smtpHost: e.target.value})} className="rounded-xl h-11" /></div>
                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Porta</Label><Input value={emailForm.smtpPort} onChange={e => setEmailForm({...emailForm, smtpPort: e.target.value})} className="rounded-xl h-11" /></div>
                 </div>
                 <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Usuário / E-mail</Label><Input value={emailForm.smtpUser} onChange={e => setEmailForm({...emailForm, smtpUser: e.target.value})} className="rounded-xl h-11" /></div>
                 <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Senha / App Key</Label><Input type="password" value={emailForm.smtpPass} onChange={e => setEmailForm({...emailForm, smtpPass: e.target.value})} className="rounded-xl h-11" /></div>
                 <Button onClick={() => handleSave('settings', 'email', emailForm)} disabled={saving} className="w-full h-12 bg-primary text-white font-black rounded-xl uppercase italic">
                   {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} Salvar SMTP
                 </Button>
              </CardContent>
           </Card>
        </TabsContent>

        <TabsContent value="taxas" className="animate-in fade-in slide-in-from-top-2 duration-300">
           <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden bg-white max-w-2xl">
              <CardHeader className="bg-muted/30 p-8 border-b">
                 <CardTitle className="text-xl font-black italic uppercase tracking-tighter">Taxas Globais</CardTitle>
                 <CardDescription>Parâmetros financeiros padrão da plataforma.</CardDescription>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">Taxa do Usuário (Markup %)</Label>
                    <div className="relative">
                      <Input value={feesForm.buyerMarkupPercent} onChange={e => setFeesForm({...feesForm, buyerMarkupPercent: e.target.value})} className="rounded-xl h-11 pr-10 font-bold" />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black opacity-30">%</span>
                    </div>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase opacity-60">Comissão Produtor (%)</Label>
                       <Input value={feesForm.organizerBasePercent} onChange={e => setFeesForm({...feesForm, organizerBasePercent: e.target.value})} className="rounded-xl h-11" />
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase opacity-60">Valor Mínimo (R$)</Label>
                       <Input value={feesForm.organizerMinFee} onChange={e => setFeesForm({...feesForm, organizerMinFee: e.target.value})} className="rounded-xl h-11" />
                    </div>
                 </div>
                 <Button onClick={() => handleSave('settings', 'fees', feesForm)} disabled={saving} className="w-full h-12 bg-primary text-white font-black rounded-xl uppercase italic">
                   {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} Salvar Taxas
                 </Button>
              </CardContent>
           </Card>
        </TabsContent>

        <TabsContent value="ads" className="animate-in fade-in slide-in-from-top-2 duration-300">
           <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden bg-white max-w-2xl">
              <CardHeader className="bg-muted/30 p-8 border-b">
                 <CardTitle className="text-xl font-black italic uppercase tracking-tighter">Viby Ads Settings</CardTitle>
                 <CardDescription>Parâmetros operacionais para anúncios e saldo Ads.</CardDescription>
              </CardHeader>
              <CardContent className="p-8 space-y-8">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-60 flex items-center gap-2"><Zap className="w-4 h-4 text-secondary" /> Valor Mínimo para Recarga (R$)</Label>
                    <div className="relative">
                       <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold opacity-30">R$</span>
                       <Input 
                         type="number" step="0.01" 
                         value={adsForm.minRechargeValue} 
                         onChange={e => setAdsForm({...adsForm, minRechargeValue: e.target.value})} 
                         className="rounded-xl h-12 pl-10 font-black text-secondary" 
                       />
                    </div>
                    <p className="text-[8px] font-bold text-muted-foreground uppercase mt-1">Define o valor base mínimo permitido no carrinho de recarga.</p>
                 </div>

                 <Separator className="border-dashed" />

                 <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase opacity-60">CPC Base (R$)</Label>
                       <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold opacity-30">R$</span>
                          <Input 
                            type="number" step="0.01" 
                            value={adsForm.cpcValue} 
                            onChange={e => setAdsForm({...adsForm, cpcValue: e.target.value})} 
                            className="rounded-xl h-11 pl-10 font-bold" 
                          />
                       </div>
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase opacity-60">CPM Base (R$ / 1k)</Label>
                       <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold opacity-30">R$</span>
                          <Input 
                            type="number" step="0.01" 
                            value={adsForm.cpmValue} 
                            onChange={e => setAdsForm({...adsForm, cpmValue: e.target.value})} 
                            className="rounded-xl h-11 pl-10 font-bold" 
                          />
                       </div>
                    </div>
                 </div>

                 <Button onClick={() => handleSave('settings', 'ads', adsForm)} disabled={saving} className="w-full h-12 bg-primary text-white font-black rounded-xl uppercase italic">
                   {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} Salvar Configurações Ads
                 </Button>
              </CardContent>
           </Card>
        </TabsContent>

        <TabsContent value="google-ads" className="animate-in fade-in slide-in-from-top-2 duration-300">
           <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden bg-white max-w-2xl">
              <CardHeader className="bg-muted/30 p-8 border-b">
                 <div className="flex justify-between items-start">
                    <div className="space-y-1">
                       <CardTitle className="text-xl font-black italic uppercase tracking-tighter">Google AdSense</CardTitle>
                       <CardDescription>Monetização híbrida com anúncios externos.</CardDescription>
                    </div>
                    <Switch 
                       checked={googleAdsForm.enabled} 
                       onCheckedChange={(v) => setGoogleAdsForm({...googleAdsForm, enabled: v})} 
                    />
                 </div>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">Publisher ID</Label>
                    <Input 
                      placeholder="pub-XXXXXXXXXXXXXXXX" 
                      value={googleAdsForm.publisherId} 
                      onChange={e => setGoogleAdsForm({...googleAdsForm, publisherId: e.target.value})}
                      className="rounded-xl h-11 font-mono" 
                    />
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">Código Global AdSense (Script)</Label>
                    <Textarea 
                      placeholder="<script async src='...'></script>" 
                      value={googleAdsForm.adsenseCode} 
                      onChange={e => setGoogleAdsForm({...googleAdsForm, adsenseCode: e.target.value})}
                      className="rounded-xl min-h-[120px] font-mono text-xs" 
                    />
                 </div>
                 <Button onClick={() => handleSave('system_settings', 'google_ads', googleAdsForm)} disabled={saving} className="w-full h-12 bg-primary text-white font-black rounded-xl uppercase italic">
                   {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} Salvar Google Ads
                 </Button>
              </CardContent>
           </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EventTypeControl({ title, desc, config, onChange }: { title: string, desc: string, config: any, onChange: (v: any) => void }) {
  return (
    <div className="space-y-4">
       <div className="flex items-center justify-between">
          <div className="space-y-1">
             <h4 className="font-bold text-sm text-primary uppercase">{title}</h4>
             <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight">{desc}</p>
          </div>
          <div className="flex items-center gap-3">
             <span className="text-[8px] font-black uppercase opacity-40">{config.enabled ? 'Ativo' : 'Inativo'}</span>
             <Switch checked={config.enabled} onCheckedChange={v => onChange({...config, enabled: v})} />
          </div>
       </div>
       <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase opacity-40 ml-1">Mensagem de Aviso (Opcional)</Label>
          <Input 
            value={config.message} 
            onChange={e => onChange({...config, message: e.target.value})} 
            placeholder="Ex: Funcionalidade em manutenção até 20/05"
            className="rounded-xl h-10 text-xs border-dashed"
          />
       </div>
    </div>
  );
}
