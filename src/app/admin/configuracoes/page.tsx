'use client';

import * as React from 'react';
import { useFirestore, useDoc, useFirebaseApp, useAuth, useUser } from '@/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
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
  Eye, 
  EyeOff, 
  Info,
  Globe,
  Zap,
  ShieldCheck,
  Mail,
  Coins,
  ShieldAlert,
  Megaphone,
  Layout,
  Upload,
  ImageIcon,
  Camera
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import Image from 'next/image';

export default function AdminConfiguracoesPage() {
  const db = useFirestore();
  const app = useFirebaseApp();
  const auth = useAuth();
  const { user } = useUser(auth);
  
  const storage = React.useMemo(() => {
    if (!app) return null;
    return getStorage(app);
  }, [app]);

  // Queries
  const siteRef = React.useMemo(() => (db ? doc(db, 'settings', 'site') : null), [db]);
  const stripeRef = React.useMemo(() => (db ? doc(db, 'settings', 'stripe') : null), [db]);
  const emailRef = React.useMemo(() => (db ? doc(db, 'settings', 'email') : null), [db]);
  const feesRef = React.useMemo(() => (db ? doc(db, 'settings', 'fees') : null), [db]);
  const adsSettingsRef = React.useMemo(() => (db ? doc(db, 'settings', 'ads') : null), [db]);
  const blockedRef = React.useMemo(() => (db ? doc(db, 'settings', 'blocked_usernames') : null), [db]);
  const promosRef = React.useMemo(() => (db ? doc(db, 'settings', 'promotions') : null), [db]);

  const { data: siteSettings, loading: loadingSite } = useDoc<any>(siteRef);
  const { data: stripeKeys, loading: loadingStripe } = useDoc<any>(stripeRef);
  const { data: emailSettings, loading: loadingEmail } = useDoc<any>(emailRef);
  const { data: globalFees, loading: loadingFees } = useDoc<any>(feesRef);
  const { data: adsSettings, loading: loadingAds } = useDoc<any>(adsSettingsRef);
  const { data: blockedUsernames, loading: loadingBlocked } = useDoc<any>(blockedRef);
  const { data: promotions, loading: loadingPromos } = useDoc<any>(promosRef);

  const [saving, setSaving] = React.useState(false);
  const [showSecret, setShowSecret] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState<{ [key: string]: number | null }>({});

  // Form States
  const [siteForm, setSiteForm] = React.useState({ siteName: 'Viby', logoUrl: '', iconUrl: '' });
  const [stripeForm, setStripeForm] = React.useState({ publishableKey: '', secretKey: '', feePercent: '3.99', feeFixed: '0.39', mode: 'test' });
  const [emailForm, setEmailForm] = React.useState({ smtpHost: 'smtp.gmail.com', smtpPort: '465', smtpUser: '', smtpPass: '' });
  const [feesForm, setFeesForm] = React.useState({ buyerMarkupPercent: '15', organizerBasePercent: '10', organizerMinFee: '3.99' });
  const [adsForm, setAdsForm] = React.useState({ cpcValue: '0.50', cpmValue: '10.00' });
  const [promosForm, setPromosForm] = React.useState({ organizerPromoActive: false, organizerPromoPercent: "5", buyerPromoActive: false, buyerPromoPercent: "10" });
  const [blockedList, setBlockedList] = React.useState("");

  React.useEffect(() => {
    if (siteSettings) setSiteForm({ siteName: siteSettings.siteName || 'Viby', logoUrl: siteSettings.logoUrl || '', iconUrl: siteSettings.iconUrl || '' });
    if (stripeKeys) setStripeForm({ publishableKey: stripeKeys.publishableKey || '', secretKey: stripeKeys.secretKey || '', feePercent: stripeKeys.feePercent?.toString() || '3.99', feeFixed: stripeKeys.feeFixed?.toString() || '0.39', mode: stripeKeys.mode || 'test' });
    if (emailSettings) setEmailForm({ smtpHost: emailSettings.smtpHost || 'smtp.gmail.com', smtpPort: emailSettings.smtpPort?.toString() || '465', smtpUser: emailSettings.smtpUser || '', smtpPass: emailSettings.smtpPass || '' });
    if (globalFees) setFeesForm({ buyerMarkupPercent: globalFees.buyerMarkupPercent?.toString() || '15', organizerBasePercent: globalFees.organizerBasePercent?.toString() || '10', organizerMinFee: globalFees.organizerMinFee?.toString() || '3.99' });
    if (adsSettings) setAdsForm({ cpcValue: adsSettings.cpcValue?.toString() || '0.50', cpmValue: adsSettings.cpmValue?.toString() || '10.00' });
    if (promotions) setPromosForm({ organizerPromoActive: promotions.organizerPromoActive ?? false, organizerPromoPercent: promotions.organizerPromoPercent?.toString() ?? "5", buyerPromoActive: promotions.buyerPromoActive ?? false, buyerPromoPercent: promotions.buyerPromoPercent?.toString() ?? "10" });
    if (blockedUsernames?.list) setBlockedList(blockedUsernames.list.join(", "));
  }, [siteSettings, stripeKeys, emailSettings, globalFees, adsSettings, blockedUsernames, promotions]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'logoUrl' | 'iconUrl') => {
    const file = e.target.files?.[0];
    if (!file || !storage || !user) return;

    setUploadProgress(prev => ({ ...prev, [type]: 0 }));

    try {
      const fileName = `admin/site/${type}_${Date.now()}`;
      const storageRef = ref(storage, fileName);
      const uploadTask = uploadBytesResumable(storageRef, file);

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
          setSiteForm(prev => ({ ...prev, [type]: downloadURL }));
          setUploadProgress(prev => ({ ...prev, [type]: null }));
          toast({ title: "Upload concluído!", description: `${type === 'logoUrl' ? 'Logo' : 'Ícone'} atualizado.` });
        }
      );
    } catch (err) {
      setUploadProgress(prev => ({ ...prev, [type]: null }));
    }
  };

  const handleSave = async (docId: string, data: any) => {
    if (!db) return;
    setSaving(true);
    
    const { id, createdAt, ...cleanData } = data;

    try {
      await setDoc(doc(db, 'settings', docId), { 
        ...cleanData, 
        updatedAt: serverTimestamp() 
      }, { merge: true });
      
      toast({ title: 'Configuração salva!', description: `Os dados de "${docId}" foram atualizados.` });
    } catch (error: any) {
      console.error(`[Admin Config Save Error] ${docId}:`, error);
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: error.message });
    } finally {
      setSaving(false);
    }
  };

  if (loadingSite || loadingStripe || loadingEmail || loadingFees || loadingAds || loadingBlocked || loadingPromos) {
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
          <TabsTrigger value="pagamentos" className="rounded-lg px-6 font-bold gap-2"><CreditCard className="w-4 h-4" /> Pagamentos</TabsTrigger>
          <TabsTrigger value="email" className="rounded-lg px-6 font-bold gap-2"><Mail className="w-4 h-4" /> E-mail</TabsTrigger>
          <TabsTrigger value="taxas" className="rounded-lg px-6 font-bold gap-2"><Coins className="w-4 h-4" /> Taxas</TabsTrigger>
          <TabsTrigger value="ads" className="rounded-lg px-6 font-bold gap-2"><Megaphone className="w-4 h-4" /> Anúncios</TabsTrigger>
          <TabsTrigger value="seguranca" className="rounded-lg px-6 font-bold gap-2"><ShieldAlert className="w-4 h-4" /> Segurança</TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="animate-in fade-in slide-in-from-top-2 duration-300">
          <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden bg-white max-w-4xl">
            <CardHeader className="bg-muted/30 p-8 border-b">
               <CardTitle className="text-xl font-black italic uppercase tracking-tighter">Identidade da Plataforma</CardTitle>
               <CardDescription>Gerencie o nome, logo e ícone principal do site.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase opacity-60">Nome da Plataforma</Label>
                <Input value={siteForm.siteName} onChange={e => setSiteForm({...siteForm, siteName: e.target.value})} className="rounded-xl h-11" placeholder="Ex: Viby.Club" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* UPLOAD DE LOGO */}
                <div className="space-y-4">
                  <Label className="text-[10px] font-black uppercase opacity-60">Logo Principal (Horizontal)</Label>
                  <div 
                    className={cn(
                      "relative h-32 rounded-2xl border-2 border-dashed border-border bg-muted/20 flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all hover:bg-muted/30",
                      siteForm.logoUrl && "border-secondary/20 bg-white"
                    )}
                    onClick={() => document.getElementById('logo-upload')?.click()}
                  >
                    {siteForm.logoUrl ? (
                      <div className="relative w-full h-full p-4 flex items-center justify-center">
                        <img src={siteForm.logoUrl} className="max-w-full max-h-full object-contain" alt="Logo Preview" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                           <Camera className="text-white w-6 h-6" />
                        </div>
                      </div>
                    ) : (
                      <div className="text-center opacity-40">
                        <ImageIcon className="w-8 h-8 mx-auto mb-2" />
                        <p className="text-[8px] font-black uppercase">Clique para carregar Logo</p>
                      </div>
                    )}
                    {uploadProgress['logoUrl'] !== undefined && uploadProgress['logoUrl'] !== null && (
                      <Progress value={uploadProgress['logoUrl']} className="absolute bottom-0 left-0 right-0 h-1 rounded-none" />
                    )}
                    <input id="logo-upload" type="file" className="hidden" accept="image/*" onChange={e => handleFileUpload(e, 'logoUrl')} />
                  </div>
                  <Input 
                    value={siteForm.logoUrl} 
                    onChange={e => setSiteForm({...siteForm, logoUrl: e.target.value})} 
                    className="rounded-xl h-9 text-[10px] font-mono" 
                    placeholder="URL da Logo" 
                  />
                </div>

                {/* UPLOAD DE ÍCONE */}
                <div className="space-y-4">
                  <Label className="text-[10px] font-black uppercase opacity-60">Ícone / Favicon (Quadrado)</Label>
                  <div 
                    className={cn(
                      "relative h-32 w-32 mx-auto rounded-2xl border-2 border-dashed border-border bg-muted/20 flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all hover:bg-muted/30",
                      siteForm.iconUrl && "border-secondary/20 bg-white"
                    )}
                    onClick={() => document.getElementById('icon-upload')?.click()}
                  >
                    {siteForm.iconUrl ? (
                      <div className="relative w-full h-full p-4 flex items-center justify-center">
                        <img src={siteForm.iconUrl} className="w-16 h-16 object-contain" alt="Icon Preview" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                           <Camera className="text-white w-5 h-5" />
                        </div>
                      </div>
                    ) : (
                      <div className="text-center opacity-40">
                        <Layout className="w-6 h-6 mx-auto mb-2" />
                        <p className="text-[8px] font-black uppercase text-center px-2">Carregar Ícone</p>
                      </div>
                    )}
                    {uploadProgress['iconUrl'] !== undefined && uploadProgress['iconUrl'] !== null && (
                      <Progress value={uploadProgress['iconUrl']} className="absolute bottom-0 left-0 right-0 h-1 rounded-none" />
                    )}
                    <input id="icon-upload" type="file" className="hidden" accept="image/*" onChange={e => handleFileUpload(e, 'iconUrl')} />
                  </div>
                  <Input 
                    value={siteForm.iconUrl} 
                    onChange={e => setSiteForm({...siteForm, iconUrl: e.target.value})} 
                    className="rounded-xl h-9 text-[10px] font-mono" 
                    placeholder="URL do Ícone" 
                  />
                </div>
              </div>

              <Button onClick={() => handleSave('site', siteForm)} disabled={saving} className="w-full h-14 bg-primary text-white font-black rounded-2xl shadow-xl uppercase italic text-lg hover:scale-[1.01] transition-transform">
                {saving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />} Salvar Identidade
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pagamentos" className="animate-in fade-in slide-in-from-top-2 duration-300">
          <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden bg-white max-w-2xl">
            <CardHeader className="bg-muted/30 p-8 border-b">
               <CardTitle className="text-xl font-black italic uppercase tracking-tighter">Gateway Stripe</CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-2">
                 <Button variant={stripeForm.mode === 'test' ? 'secondary' : 'outline'} className="rounded-xl h-11 font-bold gap-2" onClick={() => setStripeForm({...stripeForm, mode: 'test'})}><Zap className="w-4 h-4" /> Modo Teste</Button>
                 <Button variant={stripeForm.mode === 'live' ? 'secondary' : 'outline'} className="rounded-xl h-11 font-bold gap-2" onClick={() => setStripeForm({...stripeForm, mode: 'live'})}><Globe className="w-4 h-4" /> Modo Produção</Button>
              </div>
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Publishable Key</Label><Input value={stripeForm.publishableKey} onChange={e => setStripeForm({...stripeForm, publishableKey: e.target.value})} className="font-mono text-xs rounded-xl h-11" /></div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase opacity-60">Secret Key</Label>
                <div className="relative">
                  <Input type={showSecret ? "text" : "password"} value={stripeForm.secretKey} onChange={e => setStripeForm({...stripeForm, secretKey: e.target.value})} className="font-mono text-xs rounded-xl h-11 pr-10" />
                  <Button type="button" variant="ghost" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => setShowSecret(!showSecret)}>{showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</Button>
                </div>
              </div>
              <Separator className="border-dashed" />
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Taxa Gateway (%)</Label><Input type="number" step="0.01" value={stripeForm.feePercent} onChange={e => setStripeForm({...stripeForm, feePercent: e.target.value})} className="rounded-xl h-11" /></div>
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Taxa Fixa (R$)</Label><Input type="number" step="0.01" value={stripeForm.feeFixed} onChange={e => setStripeForm({...stripeForm, feeFixed: e.target.value})} className="rounded-xl h-11" /></div>
              </div>
              <Button onClick={() => handleSave('stripe', stripeForm)} disabled={saving} className="w-full h-12 bg-primary text-white font-black rounded-xl uppercase italic mt-4">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} Atualizar Stripe
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email" className="animate-in fade-in slide-in-from-top-2 duration-300">
          <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden bg-white max-w-2xl">
            <CardHeader className="bg-muted/30 p-8 border-b">
               <CardTitle className="text-xl font-black italic uppercase tracking-tighter">Servidor SMTP</CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <div className="md:col-span-2 space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Host SMTP</Label><Input value={emailForm.smtpHost} onChange={e => setEmailForm({...emailForm, smtpHost: e.target.value})} className="rounded-xl h-11" /></div>
                 <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Porta</Label><Input value={emailForm.smtpPort} onChange={e => setEmailForm({...emailForm, smtpPort: e.target.value})} className="rounded-xl h-11" /></div>
              </div>
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Usuário / E-mail</Label><Input value={emailForm.smtpUser} onChange={e => setEmailForm({...emailForm, smtpUser: e.target.value})} className="rounded-xl h-11" /></div>
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Senha de App</Label><Input type="password" value={emailForm.smtpPass} onChange={e => setEmailForm({...emailForm, smtpPass: e.target.value})} className="rounded-xl h-11" /></div>
              <Button onClick={() => handleSave('email', emailForm)} disabled={saving} className="w-full h-12 bg-primary text-white font-black rounded-xl uppercase italic">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} Salvar E-mail
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="taxas" className="animate-in fade-in slide-in-from-top-2 duration-300">
           <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden bg-white max-w-2xl">
              <CardHeader className="bg-muted/30 p-8 border-b">
                 <CardTitle className="text-xl font-black italic uppercase tracking-tighter">Regras Financeiras</CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                 <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Markup Comprador (%)</Label><Input type="number" value={feesForm.buyerMarkupPercent} onChange={e => setFeesForm({...feesForm, buyerMarkupPercent: e.target.value})} className="rounded-xl h-11" /></div>
                 <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Comissão Produtor (%)</Label><Input type="number" value={feesForm.organizerBasePercent} onChange={e => setFeesForm({...feesForm, organizerBasePercent: e.target.value})} className="rounded-xl h-11" /></div>
                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Taxa Mínima (R$)</Label><Input type="number" value={feesForm.organizerMinFee} onChange={e => setFeesForm({...feesForm, organizerMinFee: e.target.value})} className="rounded-xl h-11" /></div>
                 </div>
                 <Button onClick={() => handleSave('fees', feesForm)} disabled={saving} className="w-full h-12 bg-primary text-white font-black rounded-xl uppercase italic">
                   {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} Salvar Taxas
                 </Button>
              </CardContent>
           </Card>
        </TabsContent>

        <TabsContent value="ads" className="animate-in fade-in slide-in-from-top-2 duration-300">
           <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden bg-white max-w-2xl">
              <CardHeader className="bg-muted/30 p-8 border-b">
                 <CardTitle className="text-xl font-black italic uppercase tracking-tighter">Parâmetros de Anúncios</CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                 <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Valor CPC (Clique)</Label><Input type="number" step="0.01" value={adsForm.cpcValue} onChange={e => setAdsForm({...adsForm, cpcValue: e.target.value})} className="rounded-xl h-11" /></div>
                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Valor CPM (Mil Views)</Label><Input type="number" step="0.01" value={adsForm.cpmValue} onChange={e => setAdsForm({...adsForm, cpmValue: e.target.value})} className="rounded-xl h-11" /></div>
                 </div>
                 <Button onClick={() => handleSave('ads', { cpcValue: parseFloat(adsForm.cpcValue), cpmValue: parseFloat(adsForm.cpmValue) })} disabled={saving} className="w-full h-12 bg-primary text-white font-black rounded-xl uppercase italic">
                   {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} Salvar Ads
                 </Button>
              </CardContent>
           </Card>
        </TabsContent>

        <TabsContent value="seguranca" className="animate-in fade-in slide-in-from-top-2 duration-300">
           <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden bg-white max-w-2xl">
              <CardHeader className="bg-muted/30 p-8 border-b">
                 <CardTitle className="text-xl font-black italic uppercase tracking-tighter">Blacklist de Usernames</CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">Nomes Bloqueados (vírgula)</Label>
                    <Textarea value={blockedList} onChange={e => setBlockedList(e.target.value)} className="min-h-[150px] rounded-2xl resize-none" />
                 </div>
                 <Button onClick={() => handleSave('blocked_usernames', { list: blockedList.split(",").map(s => s.trim().toLowerCase()).filter(Boolean) })} disabled={saving} className="w-full h-12 bg-primary text-white font-black rounded-xl uppercase italic">
                   {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} Atualizar Blacklist
                 </Button>
              </CardContent>
           </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
