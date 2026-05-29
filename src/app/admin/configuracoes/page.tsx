'use client';

import * as React from 'react';
import { useFirestore, useDoc, useFirebaseApp } from '@/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Loader2, 
  Save, 
  Layout, 
  ImageIcon, 
  Upload, 
  CreditCard, 
  ShieldCheck,
  Eye,
  EyeOff,
  Key,
  Info,
  Mail,
  Coins,
  TrendingUp,
  MousePointer2,
  Lock,
  X,
  Map as MapIcon,
  Percent,
  Receipt,
  Building2,
  User,
  ArrowRight,
  Zap,
  Globe,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { cn } from '@/lib/utils';

export default function AdminConfiguracoesPage() {
  const db = useFirestore();
  const app = useFirebaseApp();
  
  const settingsRef = React.useMemo(() => (db ? doc(db, 'settings', 'site') : null), [db]);
  const stripeRef = React.useMemo(() => (db ? doc(db, 'settings', 'stripe') : null), [db]);
  const emailRef = React.useMemo(() => (db ? doc(db, 'settings', 'email') : null), [db]);
  const adsRef = React.useMemo(() => (db ? doc(db, 'settings', 'ads') : null), [db]);
  const mapsRef = React.useMemo(() => (db ? doc(db, 'settings', 'maps') : null), [db]);
  const blockedRef = React.useMemo(() => (db ? doc(db, 'settings', 'blocked_usernames') : null), [db]);
  const feesRef = React.useMemo(() => (db ? doc(db, 'settings', 'fees') : null), [db]);

  const { data: settings, loading: loadingSettings } = useDoc<any>(settingsRef);
  const { data: stripeKeys, loading: loadingStripe } = useDoc<any>(stripeRef);
  const { data: emailSettings, loading: loadingEmail } = useDoc<any>(emailRef);
  const { data: adsSettings, loading: loadingAds } = useDoc<any>(adsRef);
  const { data: mapsSettings, loading: loadingMaps } = useDoc<any>(mapsRef);
  const { data: blockedData, loading: loadingBlocked } = useDoc<any>(blockedRef);
  const { data: feesSettings, loading: loadingFees } = useDoc<any>(feesRef);

  const [saving, setSaving] = React.useState(false);
  const [logoUploadProgress, setLogoUploadProgress] = React.useState<number | null>(null);
  const [iconUploadProgress, setIconUploadProgress] = React.useState<number | null>(null);
  
  const [logoUrl, setLogoUrl] = React.useState('');
  const [iconUrl, setIconUrl] = React.useState('');
  const [siteName, setSiteName] = React.useState('');
  const [stripePublishableKey, setStripePublishableKey] = React.useState('');
  const [stripeSecretKey, setStripeSecretKey] = React.useState('');
  const [stripeFeePercent, setStripeFeePercent] = React.useState('3.99');
  const [stripeFeeFixed, setStripeFeeFixed] = React.useState('0.39');
  const [stripeMode, setStripeMode] = React.useState<'test' | 'live'>('test');
  const [showSecret, setShowSecret] = React.useState(false);
  const [smtpUser, setSmtpUser] = React.useState('');
  const [smtpPass, setSmtpPass] = React.useState('');
  const [showEmailPass, setShowEmailPass] = React.useState(false);
  const [cpcValue, setCpcValue] = React.useState('');
  const [cpmValue, setCpmValue] = React.useState('');
  const [googleMapsApiKey, setGoogleMapsApiKey] = React.useState('');

  const [buyerFeePercent, setBuyerFeePercent] = React.useState('15');
  const [organizerFeePercent, setOrganizerFeePercent] = React.useState('10');
  const [organizerMinFee, setOrganizerMinFee] = React.useState('9.99');

  const [blockedInput, setBlockedInput] = React.useState('');
  const [blockedList, setBlockedList] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (settings) {
      setLogoUrl(settings.logoUrl || '');
      setIconUrl(settings.iconUrl || '');
      setSiteName(settings.siteName || '');
    }
  }, [settings]);

  React.useEffect(() => {
    if (stripeKeys) {
      setStripePublishableKey(stripeKeys.publishableKey || '');
      setStripeSecretKey(stripeKeys.secretKey || '');
      setStripeFeePercent(stripeKeys.feePercent?.toString() || '3.99');
      setStripeFeeFixed(stripeKeys.feeFixed?.toString() || '0.39');
      setStripeMode(stripeKeys.mode || 'test');
    }
  }, [stripeKeys]);

  React.useEffect(() => {
    if (emailSettings) {
      setSmtpUser(emailSettings.smtpUser || '');
      setSmtpPass(emailSettings.smtpPass || '');
    }
  }, [emailSettings]);

  React.useEffect(() => {
    if (adsSettings) {
      setCpcValue(adsSettings.cpcValue?.toString() || '');
      setCpmValue(adsSettings.cpmValue?.toString() || '');
    }
  }, [adsSettings]);

  React.useEffect(() => {
    if (mapsSettings) {
      setGoogleMapsApiKey(mapsSettings.apiKey || '');
    }
  }, [mapsSettings]);

  React.useEffect(() => {
    if (blockedData) {
      setBlockedList(blockedData.list || []);
    }
  }, [blockedData]);

  React.useEffect(() => {
    if (feesSettings) {
      setBuyerFeePercent(feesSettings.buyerFeePercent?.toString() || '15');
      setOrganizerFeePercent(feesSettings.organizerFeePercent?.toString() || '10');
      setOrganizerMinFee(feesSettings.organizerMinFee?.toString() || '9.99');
    }
  }, [feesSettings]);

  const storage = React.useMemo(() => {
    if (!app) return null;
    return getStorage(app);
  }, [app]);

  const handleFileUpload = async (file: File, type: 'logo' | 'icon') => {
    if (!storage) return;
    const setProgress = type === 'logo' ? setLogoUploadProgress : setIconUploadProgress;
    const setUrl = type === 'logo' ? setLogoUrl : setIconUrl;
    setProgress(0);
    try {
      const fileName = `${type}_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
      const storageRef = ref(storage, `site_assets/${fileName}`);
      const uploadTask = uploadBytesResumable(storageRef, file);
      uploadTask.on('state_changed', (snapshot) => setProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100), (error) => {
        setProgress(null);
        toast({ variant: 'destructive', title: 'Erro no upload', description: error.message });
      }, async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        setUrl(downloadURL);
        setProgress(null);
        toast({ title: 'Upload concluído!' });
      });
    } catch (err) { setProgress(null); }
  };

  const handleSaveBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db) return;
    setSaving(true);
    const settingsData = { siteName: siteName || 'Viby', logoUrl, iconUrl, updatedAt: serverTimestamp() };
    setDoc(doc(db, 'settings', 'site'), settingsData, { merge: true })
      .then(() => toast({ title: 'Marca atualizada!' }))
      .catch(async (error) => { errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'settings/site', operation: 'write', requestResourceData: settingsData })); })
      .finally(() => setSaving(false));
  };

  const handleSaveStripe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db) return;
    setSaving(true);
    const stripeData = { 
      publishableKey: stripePublishableKey.trim(), 
      secretKey: stripeSecretKey.trim(),
      feePercent: parseFloat(stripeFeePercent) || 0,
      feeFixed: parseFloat(stripeFeeFixed) || 0,
      mode: stripeMode,
      updatedAt: serverTimestamp() 
    };
    setDoc(doc(db, 'settings', 'stripe'), stripeData, { merge: true })
      .then(() => toast({ title: 'Chaves do Stripe salvas!', description: 'A integração foi atualizada dinamicamente.' }))
      .catch(async (error) => { errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'settings/stripe', operation: 'write', requestResourceData: stripeData })); })
      .finally(() => setSaving(false));
  };

  const handleSaveEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db) return;
    setSaving(true);
    const emailData = { smtpUser: smtpUser.trim(), smtpPass: smtpPass.trim(), updatedAt: serverTimestamp() };
    setDoc(doc(db, 'settings', 'email'), emailData, { merge: true })
      .then(() => toast({ title: 'Configurações de E-mail salvas!' }))
      .catch(async (error) => { errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'settings/email', operation: 'write', requestResourceData: emailData })); })
      .finally(() => setSaving(false));
  };

  const handleSaveAds = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db) return;
    setSaving(true);
    const adsData = { cpcValue: parseFloat(cpcValue) || 0, cpmValue: parseFloat(cpmValue) || 0, updatedAt: serverTimestamp() };
    setDoc(doc(db, 'settings', 'ads'), adsData, { merge: true })
      .then(() => toast({ title: 'Valores de Publicidade salvos!' }))
      .catch(async (error) => { errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'settings/ads', operation: 'write', requestResourceData: adsData })); })
      .finally(() => setSaving(false));
  };

  const handleSaveMaps = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db) return;
    setSaving(true);
    const mapsData = { apiKey: googleMapsApiKey.trim(), updatedAt: serverTimestamp() };
    setDoc(doc(db, 'settings', 'maps'), mapsData, { merge: true })
      .then(() => toast({ title: 'Chave do Google Maps salva!' }))
      .catch(async (error) => { errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'settings/maps', operation: 'write', requestResourceData: mapsData })); })
      .finally(() => setSaving(false));
  };

  const handleSaveFees = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db) return;
    setSaving(true);
    const feesData = { 
      buyerFeePercent: parseFloat(buyerFeePercent) || 0, 
      organizerFeePercent: parseFloat(organizerFeePercent) || 0,
      organizerMinFee: parseFloat(organizerMinFee) || 0,
      updatedAt: serverTimestamp() 
    };
    setDoc(doc(db, 'settings', 'fees'), feesData, { merge: true })
      .then(() => toast({ title: 'Taxas globais salvas!' }))
      .catch(async (error) => { errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'settings/fees', operation: 'write', requestResourceData: feesData })); })
      .finally(() => setSaving(false));
  };

  const handleAddBlocked = () => {
    const names = blockedInput.split(',').map(n => n.trim().toLowerCase()).filter(n => n.length > 0);
    if (names.length === 0) return;
    const newList = Array.from(new Set([...blockedList, ...names])).sort();
    setBlockedList(newList);
    setBlockedInput('');
  };

  const removeBlocked = (name: string) => {
    setBlockedList(prev => prev.filter(n => n !== name));
  };

  const handleSaveBlocked = async () => {
    if (!db) return;
    setSaving(true);
    const data = { list: blockedList, updatedAt: serverTimestamp() };
    setDoc(doc(db, 'settings', 'blocked_usernames'), data)
      .then(() => toast({ title: 'Lista de Usernames Reservados salva!' }))
      .catch(async (error) => { errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'settings/blocked_usernames', operation: 'write', requestResourceData: data })); })
      .finally(() => setSaving(false));
  };

  if (loadingSettings || loadingStripe || loadingEmail || loadingAds || loadingBlocked || loadingMaps || loadingFees) {
    return <div className="flex justify-center items-center h-[60vh]"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>;
  }

  const isStripeConfigured = !!stripePublishableKey && !!stripeSecretKey;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-primary">Configurações do Sistema</h1>
        <p className="text-muted-foreground">Gerencie a identidade visual, integrações, taxas e segurança da plataforma.</p>
      </div>

      <Tabs defaultValue="brand" className="space-y-6">
        <TabsList className="bg-muted/50 p-1 rounded-xl flex-wrap h-auto">
          <TabsTrigger value="brand" className="gap-2 rounded-lg font-bold"><Layout className="w-4 h-4" /> Marca</TabsTrigger>
          <TabsTrigger value="usernames" className="gap-2 rounded-lg font-bold"><Lock className="w-4 h-4" /> Usernames</TabsTrigger>
          <TabsTrigger value="fees" className="gap-2 rounded-lg font-bold"><Percent className="w-4 h-4" /> Taxas</TabsTrigger>
          <TabsTrigger value="payments" className="gap-2 rounded-lg font-bold"><CreditCard className="w-4 h-4" /> Pagamentos</TabsTrigger>
          <TabsTrigger value="email" className="gap-2 rounded-lg font-bold"><Mail className="w-4 h-4" /> E-mail</TabsTrigger>
          <TabsTrigger value="maps" className="gap-2 rounded-lg font-bold"><MapIcon className="w-4 h-4" /> Maps</TabsTrigger>
          <TabsTrigger value="values" className="gap-2 rounded-lg font-bold"><Coins className="w-4 h-4" /> Publicidade</TabsTrigger>
        </TabsList>

        <TabsContent value="brand">
          <form onSubmit={handleSaveBrand} className="space-y-6 max-w-2xl">
            <Card className="border-none shadow-sm rounded-2xl overflow-hidden">
              <CardHeader>
                <CardTitle className="text-xl">Identidade Visual</CardTitle>
                <CardDescription>Personalize o nome e as imagens do Viby Club.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="siteName">Nome do Site</Label>
                  <Input id="siteName" value={siteName} onChange={(e) => setSiteName(e.target.value)} placeholder="Viby" className="rounded-xl h-12" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <Label>Logotipo</Label>
                    <div className="relative aspect-square rounded-2xl bg-muted border-2 border-dashed border-border flex flex-col items-center justify-center overflow-hidden group cursor-pointer" onClick={() => document.getElementById('logo-upload')?.click()}>
                      {logoUrl ? <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-4" /> : <Upload className="w-8 h-8 text-muted-foreground opacity-20" />}
                      <input id="logo-upload" type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'logo')} />
                    </div>
                    {logoUploadProgress !== null && <Progress value={logoUploadProgress} className="h-1" />}
                  </div>
                  <div className="space-y-4">
                    <Label>Ícone</Label>
                    <div className="relative aspect-square rounded-2xl bg-muted border-2 border-dashed border-border flex flex-col items-center justify-center overflow-hidden group cursor-pointer" onClick={() => document.getElementById('icon-upload')?.click()}>
                      {iconUrl ? <img src={iconUrl} alt="Icon" className="w-16 h-16 object-contain" /> : <ImageIcon className="w-8 h-8 text-muted-foreground opacity-20" />}
                      <input id="icon-upload" type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'icon')} />
                    </div>
                    {iconUploadProgress !== null && <Progress value={iconUploadProgress} className="h-1" />}
                  </div>
                </div>
              </CardContent>
            </Card>
            <Button type="submit" disabled={saving} className="w-full bg-primary text-white font-bold h-14 rounded-2xl">
              {saving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
              Salvar Alterações de Marca
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="usernames">
          <div className="space-y-6 max-w-2xl">
            <Card className="border-none shadow-sm rounded-2xl overflow-hidden">
              <CardHeader>
                <CardTitle className="text-xl">Usernames Reservados</CardTitle>
                <CardDescription>Estes nomes não poderão ser usados por novos usuários ou organizações.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Adicionar Nomes (separados por vírgula)</Label>
                  <div className="flex gap-2">
                    <Input 
                      value={blockedInput} 
                      onChange={(e) => setBlockedInput(e.target.value)} 
                      placeholder="cocacola, nike, apple, etc..." 
                      className="rounded-xl h-12"
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddBlocked())}
                    />
                    <Button type="button" onClick={handleAddBlocked} variant="secondary" className="h-12 rounded-xl font-bold">Adicionar</Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 min-h-[100px] p-4 bg-muted/20 rounded-2xl border border-dashed border-border">
                  {blockedList.length > 0 ? (
                    blockedList.map((name) => (
                      <Badge key={name} className="gap-1.5 py-1.5 px-3 rounded-full bg-secondary text-white font-bold uppercase text-[10px]">
                        {name}
                        <X className="w-3 h-3 cursor-pointer hover:text-white/70" onClick={() => removeBlocked(name)} />
                      </Badge>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground italic flex items-center justify-center w-full">Nenhum nome reservado ainda.</p>
                  )}
                </div>
              </CardContent>
            </Card>
            <Button onClick={handleSaveBlocked} disabled={saving} className="w-full bg-secondary text-white font-black h-14 rounded-2xl shadow-lg shadow-secondary/20">
              {saving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
              Salvar Usernames Reservados
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="fees">
          <form onSubmit={handleSaveFees} className="space-y-6 max-w-2xl">
            <Card className="border-none shadow-sm rounded-2xl overflow-hidden">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-secondary/10 rounded-lg"><Receipt className="w-5 h-5 text-secondary" /></div>
                  <div>
                    <CardTitle className="text-xl">Taxas da Plataforma</CardTitle>
                    <CardDescription>Defina as taxas aplicadas em cada transação de ingressos.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* TAXA DO COMPRADOR */}
                <div className="space-y-4">
                   <div className="flex items-center gap-2 text-primary font-black uppercase text-[10px] tracking-widest"><User className="w-4 h-4" /> Taxas do Comprador</div>
                   <div className="space-y-2">
                     <Label className="flex items-center gap-2"><Percent className="w-3.5 h-3.5 text-muted-foreground" /> Taxa Administrativa (%)</Label>
                     <div className="relative">
                       <Input type="number" step="0.1" value={buyerFeePercent} onChange={(e) => setBuyerFeePercent(e.target.value)} placeholder="15" className="rounded-xl pr-9 h-12 font-bold" />
                       <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">%</span>
                     </div>
                     <p className="text-[10px] text-muted-foreground italic">Taxa somada ao valor do ingresso e paga pelo cliente final.</p>
                   </div>
                </div>

                <Separator />

                {/* TAXA DO ORGANIZADOR */}
                <div className="space-y-4">
                   <div className="flex items-center gap-2 text-secondary font-black uppercase text-[10px] tracking-widest"><Building2 className="w-4 h-4" /> Taxas do Organizador</div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2"><Percent className="w-3.5 h-3.5 text-muted-foreground" /> Porcentagem (%)</Label>
                        <div className="relative">
                          <Input type="number" step="0.1" value={organizerFeePercent} onChange={(e) => setOrganizerFeePercent(e.target.value)} placeholder="10" className="rounded-xl pr-9 h-12 font-bold" />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">%</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2"><Coins className="w-3.5 h-3.5 text-muted-foreground" /> Valor Mínimo (R$)</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">R$</span>
                          <Input type="number" step="0.01" value={organizerMinFee} onChange={(e) => setOrganizerMinFee(e.target.value)} placeholder="9.99" className="rounded-xl pl-9 h-12 font-bold" />
                        </div>
                      </div>
                   </div>
                   <p className="text-[10px] text-muted-foreground italic">Custo descontado do produtor. Será aplicado o maior valor entre os dois acima.</p>
                </div>
              </CardContent>
            </Card>
            <Button type="submit" disabled={saving} className="w-full bg-secondary text-white font-black h-14 rounded-2xl shadow-lg">
              {saving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
              Salvar Configurações de Taxas
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="payments">
          <form onSubmit={handleSaveStripe} className="space-y-6 max-w-2xl">
            <Card className="border-none shadow-sm rounded-2xl overflow-hidden">
              <CardHeader className="bg-muted/30 p-8 border-b">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><CreditCard className="w-6 h-6" /></div>
                    <div>
                      <CardTitle className="text-xl font-black uppercase italic tracking-tighter">Gateway Stripe</CardTitle>
                      <CardDescription className="font-medium">Chaves dinâmicas da plataforma.</CardDescription>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                     <Badge className={cn(
                       "uppercase font-black text-[9px] h-6 px-3",
                       isStripeConfigured ? "bg-green-500 text-white" : "bg-red-500 text-white"
                     )}>
                        {isStripeConfigured ? 'Conectado' : 'Não Configurado'}
                     </Badge>
                     <Badge variant="outline" className={cn(
                       "uppercase font-black text-[8px] h-5 px-2",
                       stripeMode === 'live' ? "border-green-500 text-green-600" : "border-orange-500 text-orange-600"
                     )}>
                        Ambiente: {stripeMode === 'live' ? 'Produção' : 'Teste'}
                     </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                <div className="space-y-4">
                   <Label className="text-[10px] font-black uppercase opacity-60">Ambiente da Plataforma</Label>
                   <div className="grid grid-cols-2 gap-2">
                      <Button 
                        type="button" 
                        variant={stripeMode === 'test' ? 'secondary' : 'outline'} 
                        className="rounded-xl h-11 font-bold gap-2"
                        onClick={() => setStripeMode('test')}
                      >
                         <Zap className="w-4 h-4" /> Modo Teste (SandBox)
                      </Button>
                      <Button 
                        type="button" 
                        variant={stripeMode === 'live' ? 'secondary' : 'outline'} 
                        className="rounded-xl h-11 font-bold gap-2"
                        onClick={() => setStripeMode('live')}
                      >
                         <Globe className="w-4 h-4" /> Modo Live (Real)
                      </Button>
                   </div>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><Key className="w-3.5 h-3.5 text-muted-foreground" /> Stripe Publishable Key</Label>
                  <Input value={stripePublishableKey} onChange={(e) => setStripePublishableKey(e.target.value)} placeholder="pk_test_..." className="rounded-xl font-mono text-xs h-12" />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><ShieldCheck className="w-3.5 h-3.5 text-blue-600" /> Stripe Secret Key</Label>
                  <div className="relative">
                    <Input type={showSecret ? "text" : "password"} value={stripeSecretKey} onChange={(e) => setStripeSecretKey(e.target.value)} placeholder="sk_test_..." className="rounded-xl font-mono text-xs h-12 pr-12" />
                    <Button type="button" variant="ghost" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => setShowSecret(!showSecret)}>
                      {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                <div className="p-4 bg-blue-50 rounded-2xl border-2 border-dashed border-blue-200 flex gap-4">
                   <Info className="w-6 h-6 text-blue-600 shrink-0 mt-1" />
                   <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase text-blue-800 italic">Nota de Segurança</p>
                      <p className="text-[10px] text-blue-700 font-medium leading-relaxed uppercase">
                         Ao salvar, as chaves são atualizadas no banco de dados e entram em vigor para o próximo checkout imediatamente. A Secret Key é mantida apenas no lado do servidor.
                      </p>
                   </div>
                </div>

                <Separator className="border-dashed" />

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 font-bold">Taxa Stripe (%)</Label>
                    <div className="relative">
                      <Input type="number" step="0.01" value={stripeFeePercent} onChange={(e) => setStripeFeePercent(e.target.value)} className="rounded-xl h-12 pr-9" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">%</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 font-bold">Taxa Fixa Stripe (R$)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">R$</span>
                      <Input type="number" step="0.01" value={stripeFeeFixed} onChange={(e) => setStripeFeeFixed(e.target.value)} className="rounded-xl h-12 pl-9" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Button type="submit" disabled={saving} className="w-full bg-secondary text-white font-black h-16 rounded-[2rem] shadow-xl uppercase italic text-lg hover:scale-[1.01] transition-transform">
              {saving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
              Salvar Configuração Dinâmica
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="email">
          <form onSubmit={handleSaveEmail} className="space-y-6 max-w-2xl">
            <Card className="border-none shadow-sm rounded-2xl overflow-hidden">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-50 rounded-lg"><Mail className="w-5 h-5 text-purple-600" /></div>
                  <div>
                    <CardTitle className="text-xl">Configuração de E-mail</CardTitle>
                    <CardDescription>Configure o Google Workspace para envio de ingressos.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-muted-foreground" /> E-mail do Remetente</Label>
                  <Input value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} placeholder="contato@suaempresa.com.br" className="rounded-xl h-12" />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><Key className="w-3.5 h-3.5 text-purple-600" /> Senha de App (Google)</Label>
                  <div className="relative">
                    <Input type={showEmailPass ? "text" : "password"} value={smtpPass} onChange={(e) => setSmtpPass(e.target.value)} placeholder="abcd efgh ijkl mnop" className="rounded-xl font-mono text-xs h-12 pr-12" />
                    <Button type="button" variant="ghost" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => setShowEmailPass(!showEmailPass)}>
                      {showEmailPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Button type="submit" disabled={saving} className="w-full bg-primary text-white font-black h-14 rounded-2xl">
              {saving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
              Salvar Configurações de E-mail
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="maps">
          <form onSubmit={handleSaveMaps} className="space-y-6 max-w-2xl">
            <Card className="border-none shadow-sm rounded-2xl overflow-hidden">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-50 rounded-lg"><MapIcon className="w-5 h-5 text-green-600" /></div>
                  <div>
                    <CardTitle className="text-xl">Google Maps API</CardTitle>
                    <CardDescription>Configure sua chave de API para habilitar os mapas interativos nos eventos.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><Key className="w-3.5 h-3.5 text-muted-foreground" /> Maps API Key</Label>
                  <Input 
                    value={googleMapsApiKey} 
                    onChange={(e) => setGoogleMapsApiKey(e.target.value)} 
                    placeholder="AIzaSy..." 
                    className="rounded-xl font-mono text-xs h-12" 
                  />
                  <div className="p-3 bg-muted/50 rounded-lg flex gap-3 mt-2">
                     <Info className="w-4 h-4 text-primary shrink-0" />
                     <p className="text-[10px] text-muted-foreground leading-tight">
                        Sua chave deve ter as permissões de <strong>Maps Embed API</strong> habilitadas no Google Cloud Console. Se deixado vazio, o sistema usará um modo de busca simplificado sem recursos avançados.
                     </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Button type="submit" disabled={saving} className="w-full bg-secondary text-white font-black h-14 rounded-2xl shadow-lg">
              {saving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
              Salvar Configuração de Mapas
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="values">
          <form onSubmit={handleSaveAds} className="space-y-6 max-w-2xl">
            <Card className="border-none shadow-sm rounded-2xl overflow-hidden">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-50 rounded-lg"><Coins className="w-5 h-5 text-orange-600" /></div>
                  <div>
                    <CardTitle className="text-xl">Valores de Publicidade</CardTitle>
                    <CardDescription>Defina os custos padrão para impulsionamento.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><MousePointer2 className="w-3.5 h-3.5 text-muted-foreground" /> Valor por Clique (CPC)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">R$</span>
                    <Input type="number" step="0.01" value={cpcValue} onChange={(e) => setCpcValue(e.target.value)} placeholder="0.15" className="rounded-xl pl-9 h-12 font-bold" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><TrendingUp className="w-3.5 h-3.5 text-muted-foreground" /> Valor por Mil Impressões (CPM)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">R$</span>
                    <Input type="number" step="0.01" value={cpmValue} onChange={(e) => setCpmValue(e.target.value)} placeholder="5.00" className="rounded-xl pl-9 h-12 font-bold" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Button type="submit" disabled={saving} className="w-full bg-secondary text-white font-black h-14 rounded-2xl uppercase italic">
              {saving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
              Salvar Parâmetros de Custo
            </Button>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  );
}
