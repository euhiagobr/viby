
"use client"

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { generatePendingAffiliateCodesAction } from "@/app/actions/affiliates";
import { toast } from "@/hooks/use-toast";
import { Loader2, ShieldCheck, Users } from "lucide-react";

export default function AdminAfiliadosPage() {
  const [isLoading, setIsLoading] = React.useState(false);
  const [result, setResult] = React.useState<{ count: number; skipped: number; errors: number } | null>(null);

  const handleGenerate = async () => {
    setIsLoading(true);
    setResult(null);
    try {
      const res = await generatePendingAffiliateCodesAction();
      if (res.success) {
        setResult({ count: res.count || 0, skipped: res.skipped || 0, errors: res.errors || 0 });
        toast({ title: "Processo Concluído!", description: `${res.count} códigos gerados.` });
      } else {
        throw new Error(res.error);
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro no Processo", description: e.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-12">
      <div className="text-center">
        <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center justify-center gap-3">
            <ShieldCheck className="w-8 h-8 text-secondary" />
            Admin de Afiliados
        </h1>
        <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest mt-1">Ferramentas para gerenciamento do programa.</p>
      </div>

      <Card className="rounded-2xl shadow-lg">
        <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5 text-primary"/> Códigos Pendentes</CardTitle>
            <CardDescription>Esta ação irá gerar códigos de afiliado para todos os usuários que ainda não possuem um. A operação pode levar alguns minutos.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <Button onClick={handleGenerate} disabled={isLoading} className="w-full">
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} 
                Gerar Códigos Pendentes
            </Button>

            {result && (
                <div className="p-4 bg-muted/50 rounded-lg text-sm space-y-2">
                    <p><strong>Resultados:</strong></p>
                    <p><span className="font-bold text-green-600">{result.count}</span> usuários processados com sucesso.</p>
                    <p><span className="font-bold text-gray-500">{result.skipped}</span> usuários já possuíam código e foram ignorados.</p>
                    <p><span className="font-bold text-red-600">{result.errors}</span> usuários encontraram erros durante o processo.</p>
                </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
