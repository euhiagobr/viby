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
  Zap,
  Globe
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { cn } from '@/lib/utils';

export default function AdminConfiguracoesPage() {
  const db = useFirestore();
  const app = useFirebaseApp();
  
  const stripeRef = React.useMemo(() => (db ? doc(db, 'settings', 'stripe') : null), [db]);
  const { data: stripeKeys, loading: loadingStripe } = useDoc<any>(stripeRef);

  const [saving, setSaving] = React.useState(false);
  const [stripePublishableKey, setStripePublishableKey] = React.useState('');
  const [stripeSecretKey, setStripeSecretKey] = React.useState('');
  const [stripeFeePercent, setStripeFeePercent] = React.useState('3.99');
  const [stripeFeeFixed, setStripeFeeFixed] = React.useState('0.39');
  const [stripeMode, setStripeMode] = React.useState<'test' | 'live'>('test');
  const [showSecret, setShowSecret] = React.useState(false);

  React.useEffect(() => {
    if (stripeKeys) {
      setStripePublishableKey(stripeKeys.publishableKey || '');
      setStripeSecretKey(stripeKeys.secretKey || '');
      setStripeFeePercent(stripeKeys.feePercent?.toString() || '3.99');
      setStripeFeeFixed(stripeKeys.feeFixed?.toString() || '0.39');
      setStripeMode(stripeKeys.mode || 'test');
    }
  }, [stripeKeys]);

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

    // Validação básica antes de salvar
    if (!stripeData.publishableKey || !stripeData.secretKey) {
      toast({ variant: "destructive", title: "Campos vazios", description: "Insira as chaves pública e secreta." });
      setSaving(false);
      return;
    }

    setDoc(doc(db, 'settings', 'stripe'), stripeData, { merge: true })
      .then(() => toast({ title: 'Configuração salva!', description: 'O sistema já está utilizando as novas chaves.' }))
      .catch(async (error) => { 
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'settings/stripe', operation: 'write', requestResourceData: stripeData })); 
      })
      .finally(() => setSaving(false));
  };

  if (loadingStripe) return <div className="flex justify-center items-center h-[60vh]"><Loader2 className="animate-spin text-secondary" /></div>;

  const isConfigured = !!stripePublishableKey && !!stripeSecretKey;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
          <CreditCard className="w-8 h-8 text-secondary" /> Configurações de Pagamento
        </h1>
        <p className="text-muted-foreground font-medium">As chaves inseridas aqui habilitam o checkout Stripe em tempo real.</p>
      </div>

      <form onSubmit={handleSaveStripe} className="space-y-6 max-w-2xl">
        <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden bg-white">
          <CardHeader className="bg-muted/30 p-8 border-b">
            <div className="flex justify-between items-start">
               <div className="space-y-1">
                  <CardTitle className="text-xl font-black italic uppercase tracking-tighter">Gateway Stripe</CardTitle>
                  <CardDescription className="font-medium uppercase text-[10px] tracking-widest">Fonte única de credenciais da plataforma</CardDescription>
               </div>
               <Badge className={cn("uppercase text-[9px] font-black h-6", isConfigured ? "bg-green-500 text-white" : "bg-red-500 text-white")}>
                  {isConfigured ? 'Conectado' : 'Desconectado'}
               </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            <div className="grid grid-cols-2 gap-2">
               <Button type="button" variant={stripeMode === 'test' ? 'secondary' : 'outline'} className="rounded-xl h-11 font-bold gap-2" onClick={() => setStripeMode('test')}><Zap className="w-4 h-4" /> Modo Teste</Button>
               <Button type="button" variant={stripeMode === 'live' ? 'secondary' : 'outline'} className="rounded-xl h-11 font-bold gap-2" onClick={() => setStripeMode('live')}><Globe className="w-4 h-4" /> Modo Produção</Button>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase opacity-60">Publishable Key</Label>
              <Input value={stripePublishableKey} onChange={e => setStripePublishableKey(e.target.value)} placeholder="pk_test_..." className="font-mono text-xs rounded-xl h-12" />
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase opacity-60">Secret Key</Label>
              <div className="relative">
                <Input type={showSecret ? "text" : "password"} value={stripeSecretKey} onChange={e => setStripeSecretKey(e.target.value)} placeholder="sk_test_..." className="font-mono text-xs rounded-xl h-12 pr-10" />
                <Button type="button" variant="ghost" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8" onClick={() => setShowSecret(!showSecret)}>
                  {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <div className="p-4 bg-blue-50 rounded-2xl border-2 border-dashed border-blue-200 flex gap-4">
               <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
               <p className="text-[10px] text-blue-800 font-bold uppercase leading-relaxed italic">
                 As chaves são salvas no banco de dados isolado e protegidas por regras de servidor. A alteração é imediata para novos checkouts.
               </p>
            </div>

            <Separator className="border-dashed" />

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase opacity-60">Taxa Gateway (%)</Label>
                <div className="relative">
                   <Input type="number" step="0.01" value={stripeFeePercent} onChange={e => setStripeFeePercent(e.target.value)} className="rounded-xl h-12 pr-8 font-black" />
                   <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold opacity-30">%</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase opacity-60">Taxa Fixa (R$)</Label>
                <div className="relative">
                   <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold opacity-30">R$</span>
                   <Input type="number" step="0.01" value={stripeFeeFixed} onChange={e => setStripeFeeFixed(e.target.value)} className="rounded-xl h-12 pl-9 font-black" />
                </div>
              </div>
            </div>
          </CardContent>
          <div className="p-8 pt-0">
             <Button type="submit" disabled={saving} className="w-full h-14 bg-primary text-white font-black rounded-2xl shadow-xl uppercase italic hover:scale-[1.01] transition-all">
                {saving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
                Atualizar Gateway Dinamicamente
             </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
