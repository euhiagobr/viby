'use client';

import * as React from 'react';
import { runStripeAudit } from '@/app/actions/stripe-audit';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ShieldCheck, AlertCircle, Terminal, Key, RefreshCw, Globe, CheckCircle2, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

export default function StripeDiagnosticPage() {
  const [result, setResult] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(false);

  const startAudit = async () => {
    setLoading(true);
    const res = await runStripeAudit();
    setResult(res);
    setLoading(false);
  };

  React.useEffect(() => {
    startAudit();
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-black uppercase italic tracking-tighter text-primary flex items-center gap-3">
            <Terminal className="w-8 h-8 text-secondary" /> Auditoria Stripe
          </h1>
          <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest">Validação técnica de Account ID e Capacidades Connect.</p>
        </div>
        <Button onClick={startAudit} disabled={loading} variant="outline" className="rounded-full h-11 px-6 font-black uppercase text-[10px] gap-2 border-secondary text-secondary">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Re-executar Auditoria
        </Button>
      </div>

      {!result && loading && (
        <div className="py-24 flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-secondary" />
          <p className="text-[10px] font-black uppercase tracking-widest animate-pulse">Consultando API Stripe...</p>
        </div>
      )}

      {result && !result.success && (
        <Card className="border-none shadow-sm rounded-[2rem] bg-red-50 border-l-8 border-red-500">
           <CardContent className="p-10 flex items-start gap-6">
              <div className="p-4 bg-red-100 rounded-2xl text-red-600 shadow-sm"><AlertCircle className="w-8 h-8" /></div>
              <div className="space-y-2">
                 <h2 className="text-xl font-black uppercase italic tracking-tight text-red-800">Falha de Conexão</h2>
                 <p className="text-sm font-bold text-red-700">{result.error}</p>
                 <div className="mt-6 p-4 bg-white/50 rounded-xl font-mono text-[10px] text-red-900 border border-red-200 overflow-x-auto">
                    {result.stack || 'Verifique se as chaves no painel admin estão corretas.'}
                 </div>
              </div>
           </CardContent>
        </Card>
      )}

      {result && result.success && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
           <div className="lg:col-span-4 space-y-6">
              <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
                 <CardHeader className="bg-muted/30 p-8 border-b">
                    <CardTitle className="text-[10px] font-black uppercase tracking-widest opacity-40">Dados da Conta</CardTitle>
                 </CardHeader>
                 <CardContent className="p-8 space-y-6">
                    <div>
                       <p className="text-[9px] font-black uppercase text-muted-foreground mb-1">Account ID</p>
                       <p className="font-mono text-xs font-bold text-primary bg-muted p-2 rounded-lg">{result.data.id}</p>
                    </div>
                    <div>
                       <p className="text-[9px] font-black uppercase text-muted-foreground mb-1">Email</p>
                       <p className="font-bold text-sm text-primary">{result.data.email || '---'}</p>
                    </div>
                    <div>
                       <p className="text-[9px] font-black uppercase text-muted-foreground mb-1">País</p>
                       <p className="font-bold text-sm text-primary flex items-center gap-2"><Globe className="w-4 h-4 text-secondary" /> {result.data.country}</p>
                    </div>
                 </CardContent>
              </Card>

              <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
                 <CardHeader className="bg-muted/30 p-8 border-b">
                    <CardTitle className="text-[10px] font-black uppercase tracking-widest opacity-40">Status Operacional</CardTitle>
                 </CardHeader>
                 <CardContent className="p-8 space-y-4">
                    <div className="flex items-center justify-between p-3 bg-muted/20 rounded-xl border border-border/40">
                       <span className="text-[10px] font-black uppercase opacity-60">Charges Enabled</span>
                       {result.data.charges_enabled ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/20 rounded-xl border border-border/40">
                       <span className="text-[10px] font-black uppercase opacity-60">Payouts Enabled</span>
                       {result.data.payouts_enabled ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
                    </div>
                    <Separator className="border-dashed" />
                    <div className="pt-2">
                       <p className="text-[9px] font-black uppercase text-muted-foreground mb-3">Stripe Connect Habilitado?</p>
                       <Badge className={cn("rounded-full uppercase font-black px-4", result.data.type ? "bg-green-500 text-white" : "bg-red-500 text-white")}>
                          {result.data.type ? `SIM (${result.data.type.toUpperCase()})` : 'NÃO'}
                       </Badge>
                    </div>
                 </CardContent>
              </Card>
           </div>

           <div className="lg:col-span-8 space-y-6">
              <Card className="border-none shadow-sm rounded-[2rem] bg-slate-950 text-white overflow-hidden">
                 <CardHeader className="bg-primary p-8 border-b border-white/5">
                    <CardTitle className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2">
                       <Terminal className="w-5 h-5 text-secondary" /> Resposta Bruta da API
                    </CardTitle>
                 </CardHeader>
                 <CardContent className="p-0">
                    <ScrollArea className="h-[500px]">
                       <pre className="p-8 text-[10px] font-mono text-emerald-400 leading-relaxed">
                          {JSON.stringify(result.data.raw, null, 2)}
                       </pre>
                    </ScrollArea>
                 </CardContent>
              </Card>
           </div>
        </div>
      )}

      <div className="p-6 bg-secondary/5 rounded-3xl border border-secondary/10 flex items-start gap-4">
         <ShieldCheck className="w-6 h-6 text-secondary shrink-0 mt-0.5" />
         <div className="space-y-1">
            <h4 className="font-black uppercase text-[10px] tracking-widest text-secondary italic">Conclusão da Auditoria</h4>
            <p className="text-[10px] text-muted-foreground leading-relaxed font-medium uppercase">
               Esta ferramenta confirmará se o Connect está ativo na sua conta plataforma. Caso os status de 'Charges' ou 'Payouts' estejam como falso, verifique as pendências no seu dashboard Stripe em Settings > Connect > Settings.
            </p>
         </div>
      </div>
    </div>
  );
}
