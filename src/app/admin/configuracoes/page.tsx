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
  Mail
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export default function AdminConfiguracoesPage() {
  const db = useFirestore();
  const app = useFirebaseApp();
  
  // Settings Refs
  const settingsRef = React.useMemo(() => (db ? doc(db, 'settings', 'site') : null), [db]);
  const stripeRef = React.useMemo(() => (db ? doc(db, 'settings', 'stripe') : null), [db]);
  const emailRef = React.useMemo(() => (db ? doc(db, 'settings', 'email') : null), [db]);

  const { data: settings, loading: loadingSettings } = useDoc<any>(settingsRef);
  const { data: stripeKeys, loading: loadingStripe } = useDoc<any>(stripeRef);
  const { data: emailSettings, loading: loadingEmail } = useDoc<any>(emailRef);

  const [saving, setSaving] = React.useState(false);
  const [logoUploadProgress, setLogoUploadProgress] = React.useState<number | null>(null);
  const [iconUploadProgress, setIconUploadProgress] = React.useState<number | null>(null);
  
  // Brand State
  const [logoUrl, setLogoUrl] = React.useState('');
  const [iconUrl, setIconUrl] = React.useState('');
  const [siteName, setSiteName] = React.useState('');

  // Stripe State
  const [stripePublishableKey, setStripePublishableKey] = React.useState('');
  const [stripeSecretKey, setStripeSecretKey] = React.useState('');
  const [showSecret, setShowSecret] = React.useState(false);

  // Email State
  const [smtpUser, setSmtpUser] = React.useState('');
  const [smtpPass, setSmtpPass] = React.useState('');
  const [showEmailPass, setShowEmailPass] = React.useState(false);

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
    }
  }, [stripeKeys]);

  React.useEffect(() => {
    if (emailSettings) {
      setSmtpUser(emailSettings.smtpUser || '');
      setSmtpPass(emailSettings.smtpPass || '');
    }
  }, [emailSettings]);

  const storage = React.useMemo(() => {
    if (!app) return null;
    return getStorage(app, 'gs://viby');
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

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setProgress(progress);
        },
        (error) => {
          setProgress(null);
          toast({ variant: 'destructive', title: 'Erro no upload', description: error.message });
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          setUrl(downloadURL);
          setProgress(null);
          toast({ title: 'Upload concluído!' });
        }
      );
    } catch (err) {
      setProgress(null);
    }
  };

  const handleSaveBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db) return;
    setSaving(true);
    
    const settingsData = {
      siteName: siteName || 'Viby',
      logoUrl,
      iconUrl,
      updatedAt: serverTimestamp(),
    };

    setDoc(doc(db, 'settings', 'site'), settingsData, { merge: true })
      .then(() => toast({ title: 'Marca atualizada!' }))
      .catch(async (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: 'settings/site',
          operation: 'write',
          requestResourceData: settingsData,
        }));
      })
      .finally(() => setSaving(false));
  };

  const handleSaveStripe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db) return;
    setSaving(true);

    const stripeData = {
      publishableKey: stripePublishableKey.trim(),
      secretKey: stripeSecretKey.trim(),
      updatedAt: serverTimestamp(),
    };

    setDoc(doc(db, 'settings', 'stripe'), stripeData, { merge: true })
      .then(() => toast({ title: 'Chaves do Stripe salvas!', description: 'A integração financeira está ativa.' }))
      .catch(async (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: 'settings/stripe',
          operation: 'write',
          requestResourceData: stripeData,
        }));
      })
      .finally(() => setSaving(false));
  };

  const handleSaveEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db) return;
    setSaving(true);

    const emailData = {
      smtpUser: smtpUser.trim(),
      smtpPass: smtpPass.trim(),
      updatedAt: serverTimestamp(),
    };

    setDoc(doc(db, 'settings', 'email'), emailData, { merge: true })
      .then(() => toast({ title: 'Configurações de E-mail salvas!', description: 'O sistema de notificações está ativo.' }))
      .catch(async (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: 'settings/email',
          operation: 'write',
          requestResourceData: emailData,
        }));
      })
      .finally(() => setSaving(false));
  };

  if (loadingSettings || loadingStripe || loadingEmail) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-secondary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-primary">Configurações do Sistema</h1>
        <p className="text-muted-foreground">Gerencie a identidade visual e as integrações da plataforma.</p>
      </div>

      <Tabs defaultValue="brand" className="space-y-6">
        <TabsList className="bg-muted/50 p-1 rounded-xl">
          <TabsTrigger value="brand" className="gap-2 rounded-lg font-bold">
            <Layout className="w-4 h-4" /> Marca
          </TabsTrigger>
          <TabsTrigger value="payments" className="gap-2 rounded-lg font-bold">
            <CreditCard className="w-4 h-4" /> Pagamentos
          </TabsTrigger>
          <TabsTrigger value="email" className="gap-2 rounded-lg font-bold">
            <Mail className="w-4 h-4" /> E-mail
          </TabsTrigger>
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
                  <Input 
                    id="siteName" 
                    value={siteName}
                    onChange={(e) => setSiteName(e.target.value)}
                    placeholder="Viby"
                    className="rounded-xl h-12"
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <Label>Logotipo</Label>
                    <div 
                      className="relative aspect-square rounded-2xl bg-muted border-2 border-dashed border-border flex flex-col items-center justify-center overflow-hidden group cursor-pointer"
                      onClick={() => document.getElementById('logo-upload')?.click()}
                    >
                      {logoUrl ? (
                        <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-4" />
                      ) : (
                        <Upload className="w-8 h-8 text-muted-foreground opacity-20" />
                      )}
                      <input id="logo-upload" type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'logo')} />
                    </div>
                    {logoUploadProgress !== null && <Progress value={logoUploadProgress} className="h-1" />}
                  </div>

                  <div className="space-y-4">
                    <Label>Ícone</Label>
                    <div 
                      className="relative aspect-square rounded-2xl bg-muted border-2 border-dashed border-border flex flex-col items-center justify-center overflow-hidden group cursor-pointer"
                      onClick={() => document.getElementById('icon-upload')?.click()}
                    >
                      {iconUrl ? (
                        <img src={iconUrl} alt="Icon" className="w-16 h-16 object-contain" />
                      ) : (
                        <ImageIcon className="w-8 h-8 text-muted-foreground opacity-20" />
                      )}
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

        <TabsContent value="payments">
          <form onSubmit={handleSaveStripe} className="space-y-6 max-w-2xl">
            <Card className="border-none shadow-sm rounded-2xl overflow-hidden">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <CreditCard className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Configuração do Stripe</CardTitle>
                    <CardDescription>Integre sua conta do Stripe para processar pagamentos.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Key className="w-3.5 h-3.5 text-muted-foreground" />
                    Stripe Publishable Key
                  </Label>
                  <Input 
                    value={stripePublishableKey}
                    onChange={(e) => setStripePublishableKey(e.target.value)}
                    placeholder="pk_test_..."
                    className="rounded-xl font-mono text-xs h-12"
                  />
                  <p className="text-[10px] text-muted-foreground">Utilizada no frontend para inicializar o Stripe.</p>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                    Stripe Secret Key
                  </Label>
                  <div className="relative">
                    <Input 
                      type={showSecret ? "text" : "password"}
                      value={stripeSecretKey}
                      onChange={(e) => setStripeSecretKey(e.target.value)}
                      placeholder="sk_test_..."
                      className="rounded-xl font-mono text-xs h-12 pr-12"
                    />
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      className="absolute right-2 top-1/2 -translate-y-1/2"
                      onClick={() => setShowSecret(!showSecret)}
                    >
                      {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                  <p className="text-[10px] text-red-500 font-bold uppercase tracking-tight">Cuidado: Nunca compartilhe sua Secret Key.</p>
                </div>

                <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex gap-3">
                  <Info className="w-5 h-5 text-blue-600 shrink-0" />
                  <p className="text-[10px] text-blue-800 font-medium leading-tight">
                    Essas chaves são salvas no banco de dados e utilizadas dinamicamente pelo servidor do Viby para criar sessões de pagamento seguras.
                  </p>
                </div>
              </CardContent>
            </Card>
            <Button type="submit" disabled={saving} className="w-full bg-secondary text-white font-black h-14 rounded-2xl shadow-lg shadow-secondary/20">
              {saving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
              Salvar Configurações de Pagamento
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="email">
          <form onSubmit={handleSaveEmail} className="space-y-6 max-w-2xl">
            <Card className="border-none shadow-sm rounded-2xl overflow-hidden">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-50 rounded-lg">
                    <Mail className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Configuração de E-mail</CardTitle>
                    <CardDescription>Configure o Google Workspace para envio de ingressos.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                    E-mail do Remetente (Google Workspace)
                  </Label>
                  <Input 
                    value={smtpUser}
                    onChange={(e) => setSmtpUser(e.target.value)}
                    placeholder="contato@suaempresa.com.br"
                    className="rounded-xl h-12"
                  />
                  <p className="text-[10px] text-muted-foreground">O e-mail que aparecerá como remetente para o usuário.</p>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Key className="w-3.5 h-3.5 text-purple-600" />
                    Senha de App (Google)
                  </Label>
                  <div className="relative">
                    <Input 
                      type={showEmailPass ? "text" : "password"}
                      value={smtpPass}
                      onChange={(e) => setSmtpPass(e.target.value)}
                      placeholder="abcd efgh ijkl mnop"
                      className="rounded-xl font-mono text-xs h-12 pr-12"
                    />
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      className="absolute right-2 top-1/2 -translate-y-1/2"
                      onClick={() => setShowEmailPass(!showEmailPass)}
                    >
                      {showEmailPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Não use sua senha normal. Gere uma "Senha de App" nas configurações de segurança do seu Google Account.</p>
                </div>

                <div className="p-4 bg-purple-50 border border-purple-100 rounded-xl flex gap-3">
                  <Info className="w-5 h-5 text-purple-600 shrink-0" />
                  <div className="space-y-1">
                    <p className="text-[10px] text-purple-800 font-bold uppercase">Como configurar?</p>
                    <ol className="text-[10px] text-purple-800 list-decimal ml-4 space-y-1">
                      <li>Acesse sua Conta Google &gt; Segurança</li>
                      <li>Ative a "Verificação em duas etapas"</li>
                      <li>Vá em "Senhas de App" e crie uma para "E-mail"</li>
                      <li>Copie o código de 16 letras e cole aqui</li>
                    </ol>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Button type="submit" disabled={saving} className="w-full bg-primary text-white font-black h-14 rounded-2xl shadow-lg">
              {saving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
              Salvar Configurações de E-mail
            </Button>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  );
}
