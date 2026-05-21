'use client';

import * as React from 'react';
import { useCurrentOrganization } from '@/contexts/OrganizationContext';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Wallet, 
  TrendingUp, 
  DollarSign, 
  CreditCard, 
  ArrowUpRight, 
  Loader2,
  Info,
  ShieldCheck,
  Building2,
  History
} from 'lucide-react';
import { formatCurrency } from '@/lib/financial-utils';
import { cn } from '@/lib/utils';

export default function OrganizationFinancePage() {
  const { currentOrg, userRole } = useCurrentOrganization();
  const db = useFirestore();

  const isFinanceManager = ['owner', 'admin', 'finance'].includes(userRole || '');

  if (!isFinanceManager) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <ShieldCheck className="w-16 h-16 text-muted-foreground opacity-20" />
        <h2 className="text-xl font-bold">Acesso Restrito</h2>
        <p className="text-muted-foreground">Você não tem permissão para visualizar dados financeiros.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
          <Wallet className="w-8 h-8 text-secondary" />
          Financeiro da Marca
        </h1>
        <p className="text-muted-foreground font-medium">Gestão de recebíveis, taxas e conta de repasse da organização.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="border-none shadow-sm bg-primary text-white overflow-hidden relative group">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase opacity-60 tracking-widest flex justify-between">
               Saldo Disponível (Líquido)
               <Wallet className="w-4 h-4" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black">{formatCurrency(0)}</div>
            <Button variant="ghost" className="mt-4 w-full h-10 rounded-xl bg-white/10 text-white font-black uppercase text-[10px] italic hover:bg-white/20">Solicitar Saque</Button>
          </CardContent>
          <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-secondary/20 rounded-full blur-3xl" />
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex justify-between">
               Receita Bruta (Vendas)
               <TrendingUp className="w-4 h-4 text-green-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black">{formatCurrency(0)}</div>
            <p className="text-[9px] font-bold text-muted-foreground uppercase mt-2">Baseado nos ingressos vendidos</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white border-l-4 border-secondary">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex justify-between">
               Configuração Stripe
               <CreditCard className="w-4 h-4 text-secondary" />
            </CardTitle>
          </CardHeader>
          <CardContent>
             <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                <span className="text-[10px] font-black uppercase">Pendente Onboarding</span>
             </div>
             <Button className="w-full bg-secondary text-white font-black h-10 rounded-xl uppercase italic text-[10px] shadow-lg">Conectar Stripe</Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         <Card className="lg:col-span-2 border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
            <CardHeader className="border-b pb-4">
               <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <History className="w-5 h-5 text-secondary" /> Histórico de Transações
               </CardTitle>
               <CardDescription>Movimentações financeiras da marca.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
               <div className="py-20 text-center text-muted-foreground italic text-sm">
                  Nenhuma transação registrada no período.
               </div>
            </CardContent>
         </Card>

         <Card className="border-none shadow-sm rounded-[2rem] bg-muted/20 border-2 border-dashed border-border">
            <CardHeader>
               <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-secondary" /> Dados Bancários PJ
               </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
               <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                  Vincule uma conta bancária vinculada ao CNPJ da sua organização para processar os repasses automáticos das vendas de ingressos.
               </p>
               
               <div className="p-4 bg-white rounded-2xl border flex items-center gap-4 grayscale opacity-50">
                  <div className="p-2 bg-muted rounded-lg"><DollarSign className="w-6 h-6" /></div>
                  <div className="flex flex-col">
                     <span className="text-[9px] font-black uppercase opacity-40">Status da Conta</span>
                     <span className="font-bold text-xs">Não Configurada</span>
                  </div>
               </div>

               <Button variant="outline" className="w-full rounded-xl font-bold h-12 border-secondary text-secondary hover:bg-secondary/5">Configurar Repasse</Button>
            </CardContent>
         </Card>
      </div>

      <div className="p-6 bg-secondary/5 rounded-3xl border border-secondary/10 flex items-start gap-4">
         <Info className="w-6 h-6 text-secondary shrink-0 mt-0.5" />
         <div className="space-y-1">
            <h4 className="font-black uppercase text-[10px] tracking-widest text-secondary">Nota sobre Taxas</h4>
            <p className="text-xs text-muted-foreground leading-relaxed font-medium">
               A Viby desconta automaticamente a taxa de serviço de acordo com o plano do proprietário (owner) da organização. Os valores exibidos nesta página já são líquidos de todas as taxas de processamento e plataforma.
            </p>
         </div>
      </div>
    </div>
  );
}
