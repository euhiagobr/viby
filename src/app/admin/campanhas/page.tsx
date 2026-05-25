
'use client';

import * as React from 'react';
import { useFirestore, useDoc } from '@/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { 
  Zap, 
  Save, 
  Loader2, 
  Clock, 
  Percent, 
  Coins, 
  User, 
  Building2,
  Calendar,
  AlertTriangle,
  Info
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

export default function AdminCampanhasPage() {
  const db = useFirestore();
  const promotionsRef = React.useMemo(() => (db ? doc(db, 'settings', 'promotions') : null), [db]);
  const { data: promotions, loading } = useDoc<any>(promotionsRef);

  const [saving, setSaving] = React.useState(false);
  const [formData, setFormData] = React.useState({
    organizerPromoActive: false,
    organizerPromoPercent: "5",
    organizerPromoMinFee: "4.99",
    organizerPromoStart: "",
    organizerPromoEnd: "",
    buyerPromoActive: false,
    buyerPromoPercent: "10",
    buyerPromoStart: "",
    buyerPromoEnd: "",
  });

  React.useEffect(() => {
    if (promotions) {
      setFormData({
        organizerPromoActive: promotions.organizerPromoActive ?? false,
        organizerPromoPercent: promotions.organizerPromoPercent?.toString() ?? "5",
        organizerPromoMinFee: promotions.organizerPromoMinFee?.toString() ?? "4.99",
        organizerPromoStart: promotions.organizerPromoStart ?? "",
        organizerPromoEnd: promotions.organizerPromoEnd ?? "",
        buyerPromoActive: promotions.buyerPromoActive ?? false,
        buyerPromoPercent: promotions.buyerPromoPercent?.toString() ?? "10",
        buyerPromoStart: promotions.buyerPromoStart ?? "",
        buyerPromoEnd: promotions.buyerPromoEnd ?? "",
      });
    }
  }, [promotions]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db) return;
    setSaving(true);

    const data = {
      ...formData,
      organizerPromoPercent: parseFloat(formData.organizerPromoPercent) || 0,
      organizerPromoMinFee: parseFloat(formData.organizerPromoMinFee) || 0,
      buyerPromoPercent: parseFloat(formData.buyerPromoPercent) || 0,
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, 'settings', 'promotions'), data, { merge: true });
      toast({ title: 'Campanhas atualizadas!' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro ao salvar' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-[60vh]"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
          <Zap className="w-8 h-8 text-secondary" />
          Campanhas Promocionais
        </h1>
        <p className="text-muted-foreground font-medium">Configure taxas de serviço preferenciais para períodos específicos.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-8 max-w-5xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* CAMPANHA ORGANIZADOR */}
          <Card className={cn(
            "border-none shadow-sm rounded-[2rem] overflow-hidden transition-all duration-500",
            formData.organizerPromoActive ? "ring-2 ring-secondary bg-white" : "bg-muted/30"
          )}>
            <CardHeader className="bg-muted/20 p-8 border-b">
              <div className="flex justify-between items-start">
                 <div className="space-y-1">
                    <div className="flex items-center gap-2 text-primary font-black uppercase text-[10px] tracking-widest">
                       <Building2 className="w-4 h-4 text-secondary" /> Promo Organizador
                    </div>
                    <CardTitle className="text-xl font-black italic uppercase tracking-tighter">Taxa do Produtor</CardTitle>
                 </div>
                 <Switch 
                   checked={formData.organizerPromoActive}
                   onCheckedChange={(v) => setFormData({...formData, organizerPromoActive: v})}
                 />
              </div>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">Porcentagem (%)</Label>
                    <div className="relative">
                      <Input 
                        type="number" step="0.1" 
                        value={formData.organizerPromoPercent}
                        onChange={e => setFormData({...formData, organizerPromoPercent: e.target.value})}
                        disabled={!formData.organizerPromoActive}
                        className="rounded-xl h-12 pr-9 font-black text-secondary" 
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold opacity-30">%</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">Valor Mínimo (R$)</Label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold opacity-30">R$</span>
                      <Input 
                        type="number" step="0.01" 
                        value={formData.organizerPromoMinFee}
                        onChange={e => setFormData({...formData, organizerPromoMinFee: e.target.value})}
                        disabled={!formData.organizerPromoActive}
                        className="rounded-xl h-12 pl-10 font-black text-secondary" 
                      />
                    </div>
                  </div>
               </div>

               <Separator className="border-dashed" />

               <div className="space-y-4">
                  <Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-2"><Clock className="w-3.5 h-3.5" /> Período de Vigência</Label>
                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <Label className="text-[9px] font-bold uppercase opacity-40">Início</Label>
                        <Input 
                          type="datetime-local" 
                          value={formData.organizerPromoStart}
                          onChange={e => setFormData({...formData, organizerPromoStart: e.target.value})}
                          disabled={!formData.organizerPromoActive}
                          className="rounded-xl h-11 text-xs" 
                        />
                     </div>
                     <div className="space-y-2">
                        <Label className="text-[9px] font-bold uppercase opacity-40">Fim</Label>
                        <Input 
                          type="datetime-local" 
                          value={formData.organizerPromoEnd}
                          onChange={e => setFormData({...formData, organizerPromoEnd: e.target.value})}
                          disabled={!formData.organizerPromoActive}
                          className="rounded-xl h-11 text-xs" 
                        />
                     </div>
                  </div>
               </div>

               {formData.organizerPromoActive && (
                 <div className="p-4 bg-secondary/5 rounded-2xl flex gap-3 animate-in zoom-in-95 duration-300">
                    <Info className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
                    <p className="text-[10px] text-secondary font-medium leading-relaxed uppercase">Esta taxa será aplicada no cálculo de repasse de todos os ingressos vendidos durante este período.</p>
                 </div>
               )}
            </CardContent>
          </Card>

          {/* CAMPANHA COMPRADOR */}
          <Card className={cn(
            "border-none shadow-sm rounded-[2rem] overflow-hidden transition-all duration-500",
            formData.buyerPromoActive ? "ring-2 ring-primary bg-white" : "bg-muted/30"
          )}>
            <CardHeader className="bg-muted/20 p-8 border-b">
               <div className="flex justify-between items-start">
                  <div className="space-y-1">
                     <div className="flex items-center gap-2 text-primary font-black uppercase text-[10px] tracking-widest">
                        <User className="w-4 h-4 text-primary" /> Promo Comprador
                     </div>
                     <CardTitle className="text-xl font-black italic uppercase tracking-tighter">Taxa Administrativa</CardTitle>
                  </div>
                  <Switch 
                    checked={formData.buyerPromoActive}
                    onCheckedChange={(v) => setFormData({...formData, buyerPromoActive: v})}
                  />
               </div>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase opacity-60">Taxa do Usuário (%)</Label>
                  <div className="relative">
                     <Input 
                        type="number" step="0.1" 
                        value={formData.buyerPromoPercent}
                        onChange={e => setFormData({...formData, buyerPromoPercent: e.target.value})}
                        disabled={!formData.buyerPromoActive}
                        className="rounded-xl h-12 pr-9 font-black text-primary" 
                     />
                     <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold opacity-30">%</span>
                  </div>
               </div>

               <Separator className="border-dashed" />

               <div className="space-y-4">
                  <Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-2"><Clock className="w-3.5 h-3.5" /> Período de Vigência</Label>
                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <Label className="text-[9px] font-bold uppercase opacity-40">Início</Label>
                        <Input 
                          type="datetime-local" 
                          value={formData.buyerPromoStart}
                          onChange={e => setFormData({...formData, buyerPromoStart: e.target.value})}
                          disabled={!formData.buyerPromoActive}
                          className="rounded-xl h-11 text-xs" 
                        />
                     </div>
                     <div className="space-y-2">
                        <Label className="text-[9px] font-bold uppercase opacity-40">Fim</Label>
                        <Input 
                          type="datetime-local" 
                          value={formData.buyerPromoEnd}
                          onChange={e => setFormData({...formData, buyerPromoEnd: e.target.value})}
                          disabled={!formData.buyerPromoActive}
                          className="rounded-xl h-11 text-xs" 
                        />
                     </div>
                  </div>
               </div>

               {formData.buyerPromoActive && (
                 <div className="p-4 bg-primary/5 rounded-2xl flex gap-3 animate-in zoom-in-95 duration-300">
                    <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <p className="text-[10px] text-primary font-medium leading-relaxed uppercase">A taxa somada ao valor do ingresso no carrinho será reduzida para o valor acima.</p>
                 </div>
               )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
           <div className="p-6 bg-orange-50 rounded-[2rem] border-2 border-dashed border-orange-200 flex items-start gap-4">
              <AlertTriangle className="w-6 h-6 text-orange-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                 <h4 className="font-black uppercase text-xs text-orange-800 italic">Aviso de Precedência</h4>
                 <p className="text-[10px] text-orange-700 font-medium leading-relaxed uppercase">As campanhas ativas sobrescrevem as configurações globais de taxas. Se uma venda ocorrer fora das datas definidas, o sistema voltará automaticamente para a taxa padrão.</p>
              </div>
           </div>

           <Button 
             type="submit" 
             disabled={saving}
             className="w-full h-16 bg-secondary text-white font-black rounded-2xl shadow-xl shadow-secondary/20 uppercase italic text-lg hover:scale-[1.01] transition-transform"
           >
              {saving ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : <Save className="w-6 h-6 mr-2" />}
              Salvar Configurações de Campanha
           </Button>
        </div>
      </form>
    </div>
  );
}
