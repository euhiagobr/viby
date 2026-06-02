'use client';

import * as React from 'react';
import { useFirestore, useDoc } from '@/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
  CheckCircle2,
  Mail,
  Coins,
  ShieldAlert,
  UserX
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';

export default function AdminConfiguracoesPage() {
  const db = useFirestore();
  
  // Queries
  const stripeRef = React.useMemo(() => (db ? doc(db, 'settings', 'stripe') : null), [db]);
  const emailRef = React.useMemo(() => (db ? doc(db, 'settings', 'email') : null), [db]);
  const feesRef = React.useMemo(() => (db ? doc(db, 'settings', 'fees') : null), [db]);
  const blockedRef = React.useMemo(() => (db ? doc(db, 'settings', 'blocked_usernames') : null), [db]);

  const { data: stripeKeys, loading: loadingStripe } = useDoc<any>(stripeRef);
  const { data: emailSettings, loading: loadingEmail } = useDoc<any>(emailRef);
  const { data: globalFees, loading: loadingFees } = useDoc<any>(feesRef);
  const { data: blockedUsernames, loading: loadingBlocked } = useDoc<any>(blockedRef);

  const [saving, setSaving] = React.useState(false);
  const [showSecret, setShowSecret] = React.useState(false);

  // Form States
  const [stripeForm, setStripeForm] = React.useState({
    publishableKey: '',
    secretKey: '',
    feePercent: '3.99',
    feeFixed: '0.39',
    mode: 'test'
  });

  const [emailForm, setEmailForm] = React.useState({
    smtpHost: 'smtp.gmail.com',
    smtpPort: '465',
    smtpUser: '',
    smtpPass: ''
  });

  const [feesForm, setFeesForm] = React.useState({
    buyerMarkupPercent: '15',
    organizerBasePercent: '10',
    organizerMinFee: '3.99'
  });

  const [blockedList, setBlockedList] = React.useState("");

  React.useEffect(() => {
    if (stripeKeys) {
      setStripeForm({
        publishableKey: stripeKeys.publishableKey || '',
        secretKey: stripeKeys.secretKey || '',
        feePercent: stripeKeys.feePercent?.toString() || '3.99',
        feeFixed: stripeKeys.feeFixed?.toString() || '0.39',
        mode: stripeKeys.mode || 'test'
      });
    }
    if (emailSettings) {
      setEmailForm({
        smtpHost: emailSettings.smtpHost || 'smtp.gmail.com',
        smtpPort: emailSettings.smtpPort?.toString() || '465',
        smtpUser: emailSettings.smtpUser || '',
        smtpPass: emailSettings.smtpPass || ''
      });
    }
    if (globalFees) {
      setFeesForm({
        buyerMarkupPercent: globalFees.buyerMarkupPercent?.toString() || '15',
        organizerBasePercent: globalFees.organizerBasePercent?.toString() || '10',
        organizerMinFee: globalFees.organizerMinFee?.toString() || '3.99'
      });
    }
    if (blockedUsernames?.list) {
      setBlockedList(blockedUsernames.list.join(", "));
    }
  }, [stripeKeys, emailSettings, globalFees, blockedUsernames]);

  const handleSave = async (collection: string, data: any) => {
    if (!db) return;
    setSaving(true);
    
    // Limpar campos de metadados do Firestore se existirem (evitar erros de validação)
    const { id, ...cleanData } = data;

    try {
      await setDoc(doc(db, 'settings', collection), { 
        ...cleanData, 
        updatedAt: serverTimestamp() 
      }, { merge: true });
      
      toast({ title: 'Configuração atualizada!', description: `Dados da coleção ${collection} salvos.` });
    } catch (error: any) {
      console.error(`[Admin Config Save Error] ${collection}:`, error);
      
      if (error.code === 'permission-denied') {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ 
          path: `settings/${collection}`, 
          operation: 'write', 
          requestResourceData: cleanData 
        }));
      } else {
        toast({ 
          variant: 'destructive', 
          title: 'Erro ao salvar', 
          description: error.message || 'Falha na comunicação com o banco.' 
        });
      }
    } finally {
      setSaving(false);
    }
  };

  if (loadingStripe || loadingEmail || loadingFees || loadingBlocked) {
    return <div className="flex justify-center items-center h-[60vh]"><Loader2 className="animate-spin text-secondary" /></div>;
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
          <Globe className="w-8 h-8 text-secondary" /> Configurações do Sistema
        </h1>
        <p className="text-muted-foreground font-medium">Gestão centralizada de parâmetros globais, financeiros e segurança.</p>
      </div>

      <Tabs defaultValue="pagamentos" className="space-y-6">
        <TabsList className="bg-muted/50 p-1 rounded-xl h-12 flex-wrap">
          <TabsTrigger value="pagamentos" className="rounded-lg px-6 font-bold gap-2"><CreditCard className="w-4 h-4" /> Pagamentos</TabsTrigger>
          <TabsTrigger value="email" className="rounded-lg px-6 font-bold gap-2"><Mail className="w-4 h-4" /> E-mail (SMTP)</TabsTrigger>
          <TabsTrigger value="taxas" className="rounded-lg px-6 font-bold gap-2"><Coins className="w-4 h-4" /> Taxas & Regras</TabsTrigger>
          <TabsTrigger value="seguranca" className="rounded-lg px-6 font-bold gap-2"><ShieldAlert className="w-4 h-4" /> Segurança</TabsTrigger>
        </TabsList>

        <TabsContent value="pagamentos" className="animate-in fade-in slide-in-from-top-2 duration-300">
          <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden bg-white max-w-2xl">
            <CardHeader className="bg-muted/30 p-8 border-b">
               <CardTitle className="text-xl font-black italic uppercase tracking-tighter">Gateway Stripe</CardTitle>
               <CardDescription className="text-[10px] font-bold uppercase">Credenciais dinâmicas para o checkout</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-2">
                 <Button variant={stripeForm.mode === 'test' ? 'secondary' : 'outline'} className="rounded-xl h-11 font-bold gap-2" onClick={() => setStripeForm({...stripeForm, mode: 'test'})}><Zap className="w-4 h-4" /> Modo Teste</Button>
                 <Button variant={stripeForm.mode === 'live' ? 'secondary' : 'outline'} className="rounded-xl h-11 font-bold gap-2" onClick={() => setStripeForm({...stripeForm, mode: 'live'})}><Globe className="w-4 h-4" /> Modo Produção</Button>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase opacity-60">Publishable Key</Label>
                <Input value={stripeForm.publishableKey} onChange={e => setStripeForm({...stripeForm, publishableKey: e.target.value})} placeholder="pk_..." className="font-mono text-xs rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase opacity-60">Secret Key</Label>
                <div className="relative">
                  <Input type={showSecret ? "text" : "password"} value={stripeForm.secretKey} onChange={e => setStripeForm({...stripeForm, secretKey: e.target.value})} placeholder="sk_..." className="font-mono text-xs rounded-xl pr-10" />
                  <Button type="button" variant="ghost" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => setShowSecret(!showSecret)}>{showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</Button>
                </div>
              </div>
              <Separator className="border-dashed" />
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Taxa Gateway (%)</Label><Input type="number" step="0.01" value={stripeForm.feePercent} onChange={e => setStripeForm({...stripeForm, feePercent: e.target.value})} className="rounded-xl" /></div>
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Taxa Fixa (R$)</Label><Input type="number" step="0.01" value={stripeForm.feeFixed} onChange={e => setStripeForm({...stripeForm, feeFixed: e.target.value})} className="rounded-xl" /></div>
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
               <CardDescription className="text-[10px] font-bold uppercase">Envio de ingressos e recuperação de senha</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <div className="md:col-span-2 space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Host SMTP</Label><Input value={emailForm.smtpHost} onChange={e => setEmailForm({...emailForm, smtpHost: e.target.value})} placeholder="smtp.gmail.com" className="rounded-xl h-11" /></div>
                 <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Porta</Label><Input value={emailForm.smtpPort} onChange={e => setEmailForm({...emailForm, smtpPort: e.target.value})} placeholder="465" className="rounded-xl h-11" /></div>
              </div>
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Usuário / E-mail</Label><Input value={emailForm.smtpUser} onChange={e => setEmailForm({...emailForm, smtpUser: e.target.value})} placeholder="exemplo@viby.club" className="rounded-xl h-11" /></div>
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Senha de App</Label><Input type="password" value={emailForm.smtpPass} onChange={e => setEmailForm({...emailForm, smtpPass: e.target.value})} placeholder="••••••••••••••••" className="rounded-xl h-11" /></div>
              <div className="p-4 bg-blue-50 rounded-2xl flex gap-3"><Info className="w-4 h-4 text-blue-600 mt-1" /><p className="text-[10px] text-blue-800 font-medium uppercase leading-tight">Certifique-se de usar uma 'Senha de App' caso utilize Gmail com 2FA.</p></div>
              <Button onClick={() => handleSave('email', emailForm)} disabled={saving} className="w-full h-12 bg-primary text-white font-black rounded-xl uppercase italic">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} Salvar Configurações de E-mail
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="taxas" className="animate-in fade-in slide-in-from-top-2 duration-300">
           <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden bg-white max-w-2xl">
              <CardHeader className="bg-muted/30 p-8 border-b">
                 <CardTitle className="text-xl font-black italic uppercase tracking-tighter">Regras Financeiras</CardTitle>
                 <CardDescription className="text-[10px] font-bold uppercase">Parâmetros globais de monetização</CardDescription>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">Markup do Comprador (%)</Label>
                    <div className="relative"><Input type="number" value={feesForm.buyerMarkupPercent} onChange={e => setFeesForm({...feesForm, buyerMarkupPercent: e.target.value})} className="rounded-xl h-11 pr-8" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold opacity-30">%</span></div>
                    <p className="text-[9px] text-muted-foreground uppercase">Valor somado ao preço de face no carrinho.</p>
                 </div>
                 <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase opacity-60">Comissão Produtor (%)</Label>
                       <div className="relative"><Input type="number" value={feesForm.organizerBasePercent} onChange={e => setFeesForm({...feesForm, organizerBasePercent: e.target.value})} className="rounded-xl h-11 pr-8" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold opacity-30">%</span></div>
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase opacity-60">Taxa Mínima (R$)</Label>
                       <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold opacity-30">R$</span><Input type="number" value={feesForm.organizerMinFee} onChange={e => setFeesForm({...feesForm, organizerMinFee: e.target.value})} className="rounded-xl h-11 pl-9" /></div>
                    </div>
                 </div>
                 <div className="p-4 bg-secondary/5 rounded-2xl flex gap-3 border border-dashed border-secondary/20">
                    <CheckCircle2 className="w-5 h-5 text-secondary shrink-0 mt-1" />
                    <div className="space-y-1">
                       <p className="text-[10px] font-black uppercase text-secondary italic">Regra de Faturamento Ativa</p>
                       <p className="text-[10px] text-muted-foreground uppercase leading-tight">O sistema aplicará automaticamente o MAIOR valor entre o percentual e a taxa mínima.</p>
                    </div>
                 </div>
                 <Button onClick={() => handleSave('fees', feesForm)} disabled={saving} className="w-full h-12 bg-primary text-white font-black rounded-xl uppercase italic">
                   {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} Salvar Parâmetros Fiscais
                 </Button>
              </CardContent>
           </Card>
        </TabsContent>

        <TabsContent value="seguranca" className="animate-in fade-in slide-in-from-top-2 duration-300">
           <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden bg-white max-w-2xl">
              <CardHeader className="bg-muted/30 p-8 border-b">
                 <CardTitle className="text-xl font-black italic uppercase tracking-tighter">Blacklist de Usernames</CardTitle>
                 <CardDescription className="text-[10px] font-bold uppercase">Impedir uso de nomes reservados ou ofensivos</CardDescription>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">Nomes Bloqueados (Separados por vírgula)</Label>
                    <Textarea 
                      value={blockedList} 
                      onChange={e => setBlockedList(e.target.value)} 
                      placeholder="admin, support, ajuda, oficial, viby..."
                      className="min-h-[150px] rounded-2xl border-dashed resize-none"
                    />
                 </div>
                 <div className="p-4 bg-orange-50 rounded-2xl flex gap-3">
                    <ShieldAlert className="w-5 h-5 text-orange-600 mt-1" />
                    <p className="text-[10px] text-orange-800 font-medium uppercase leading-tight italic">Estes termos serão bloqueados instantaneamente no fluxo de cadastro e criação de organizações.</p>
                 </div>
                 <Button 
                   onClick={() => handleSave('blocked_usernames', { list: blockedList.split(",").map(s => s.trim().toLowerCase()).filter(Boolean) })} 
                   disabled={saving} 
                   className="w-full h-12 bg-primary text-white font-black rounded-xl uppercase italic"
                 >
                   {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} Atualizar Blacklist
                 </Button>
              </CardContent>
           </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}