
'use client';

import * as React from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { 
  collection, 
  query, 
  orderBy, 
  doc, 
  deleteDoc, 
  serverTimestamp, 
  addDoc, 
  updateDoc, 
  collectionGroup, 
  where, 
  getDocs,
  getDoc 
} from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  TicketPercent, 
  Plus, 
  Trash2, 
  Loader2, 
  Clock, 
  Search, 
  Inbox,
  Info,
  Users,
  Layers,
  Calendar,
  Zap,
  Edit,
  BarChart3,
  TrendingUp,
  User,
  Building2,
  ArrowRight
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/financial-utils';
import { cn } from "@/lib/utils";
import { ScrollArea } from '@/components/ui/scroll-area';

export default function AdminCuponsPage() {
  const db = useFirestore();
  const [search, setSearch] = React.useState("");
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [editingCoupon, setEditingCoupon] = React.useState<any>(null);
  
  // Estados para Métricas
  const [selectedCouponForMetrics, setSelectedCouponForMetrics] = React.useState<any>(null);
  const [usageData, setUsageData] = React.useState<any[]>([]);
  const [loadingMetrics, setLoadingMetrics] = React.useState(false);

  const adCouponsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, "ad_coupons"), orderBy("createdAt", "desc"));
  }, [db]);

  const { data: coupons, loading } = useCollection<any>(adCouponsQuery);

  const filteredCoupons = React.useMemo(() => {
    if (!coupons) return [];
    return coupons.filter(c => 
      c.code?.toLowerCase().includes(search.toLowerCase()) || 
      c.type?.toLowerCase().includes(search.toLowerCase())
    );
  }, [coupons, search]);

  // Busca métricas detalhadas do cupom
  React.useEffect(() => {
    if (!db || !selectedCouponForMetrics) return;

    const fetchMetrics = async () => {
      setLoadingMetrics(true);
      try {
        // Busca todas as transações de recarga pagas que usaram este cupom
        const q = query(
          collectionGroup(db, 'transactions'),
          where('couponCode', '==', selectedCouponForMetrics.code),
          where('status', '==', 'completed'),
          where('type', '==', 'ad_topup')
        );
        const snap = await getDocs(q);
        
        const results = await Promise.all(snap.docs.map(async (d) => {
          const data = d.data();
          const orgId = d.ref.parent.parent?.id;
          
          // Buscar nomes para exibição humana
          let orgName = "Marca Desconhecida";
          let userName = "Usuário Desconhecido";

          if (orgId) {
            const orgSnap = await getDoc(doc(db, "organizations", orgId));
            if (orgSnap.exists()) orgName = orgSnap.data().name;
          }

          if (data.userId) {
            const userSnap = await getDoc(doc(db, "users", data.userId));
            if (userSnap.exists()) userName = userSnap.data().name || userSnap.data().displayName;
          }

          return {
            id: d.id,
            orgName,
            userName,
            amount: data.amount,
            totalPaid: data.totalCharged || data.amount,
            date: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt)
          };
        }));

        setUsageData(results.sort((a, b) => b.date.getTime() - a.date.getTime()));
      } catch (e: any) {
        console.error(e);
        toast({ variant: "destructive", title: "Erro ao carregar métricas", description: "Verifique os índices do Firestore." });
      } finally {
        setLoadingMetrics(false);
      }
    };

    fetchMetrics();
  }, [db, selectedCouponForMetrics]);

  const handleSaveCoupon = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!db) return;
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);

    const startAtStr = formData.get("startAt") as string;
    const endAtStr = formData.get("endAt") as string;

    const couponData: any = {
      code: (formData.get("code") as string).trim().toUpperCase(),
      type: formData.get("type") as string,
      value: parseFloat(formData.get("value") as string),
      minRecharge: parseFloat(formData.get("minRecharge") as string) || 0,
      maxRecharge: formData.get("maxRecharge") ? parseFloat(formData.get("maxRecharge") as string) : null,
      maxTotalUses: parseInt(formData.get("maxTotalUses") as string) || 0,
      maxUsesPerUser: parseInt(formData.get("maxUsesPerUser") as string) || 1,
      startAt: new Date(startAtStr),
      endAt: new Date(endAtStr),
      updatedAt: serverTimestamp()
    };

    try {
      if (editingCoupon) {
        await updateDoc(doc(db, "ad_coupons", editingCoupon.id), couponData);
        toast({ title: "Cupom atualizado com sucesso!" });
      } else {
        await addDoc(collection(db, "ad_coupons"), {
          ...couponData,
          currentUses: 0,
          status: "active",
          createdAt: serverTimestamp()
        });
        toast({ title: "Novo cupom de anúncio criado!" });
      }
      setIsDialogOpen(false);
      setEditingCoupon(null);
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao salvar cupom" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!db || !confirm("Remover este cupom?")) return;
    try {
      await deleteDoc(doc(db, "ad_coupons", id));
      toast({ title: "Cupom removido" });
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao remover" });
    }
  };

  const formatTimestamp = (dateVal: any) => {
    if (!dateVal) return "";
    try {
      const d = dateVal.toDate ? dateVal.toDate() : new Date(dateVal);
      return d.toISOString().slice(0, 16);
    } catch (e) { return ""; }
  };

  const formatDisplayDate = (dateVal: any) => {
    if (!dateVal) return "---";
    try {
      const d = dateVal.toDate ? dateVal.toDate() : new Date(dateVal);
      return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch (e) { return "---"; }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
            <TicketPercent className="w-8 h-8 text-secondary" /> Cupons de Anúncio
          </h1>
          <p className="text-muted-foreground font-medium">Gestão de incentivos e limites de uso para saldo Ads.</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if(!open) setEditingCoupon(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingCoupon(null)} className="bg-secondary text-white font-black rounded-full px-8 h-12 shadow-lg gap-2 uppercase italic">
              <Plus className="w-5 h-5" /> Novo Cupom Ads
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md rounded-[2.5rem] max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSaveCoupon} key={editingCoupon?.id || 'new'} className="space-y-6">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">
                  {editingCoupon ? "Editar Cupom" : "Configurar Cupom"}
                </DialogTitle>
                <DialogDescription>Defina as regras de benefício e restrições de uso.</DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">Código do Cupom</Label>
                    <Input name="code" required defaultValue={editingCoupon?.code} placeholder="EX: VIBYPROMO20" className="rounded-xl h-11 uppercase font-bold" />
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase opacity-60">Tipo</Label>
                       <Select name="type" defaultValue={editingCoupon?.type || "discount"}>
                          <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                          <SelectContent className="rounded-xl">
                             <SelectItem value="discount">Desconto (%) no custo</SelectItem>
                             <SelectItem value="bonus_percent">Bônus (%) no saldo</SelectItem>
                             <SelectItem value="bonus_fixed">Ganhar Fixo (R$)</SelectItem>
                          </SelectContent>
                       </Select>
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase opacity-60">Valor do Benefício</Label>
                       <Input name="value" type="number" step="0.01" required defaultValue={editingCoupon?.value} className="rounded-xl h-11 font-black" />
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4 border-t border-dashed pt-4">
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-1.5">
                         <Layers className="w-3 h-3" /> Limite Total
                       </Label>
                       <Input name="maxTotalUses" type="number" placeholder="Ex: 100" required defaultValue={editingCoupon?.maxTotalUses} className="rounded-xl h-11" />
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-1.5">
                         <Users className="w-3 h-3" /> Por Usuário
                       </Label>
                       <Input name="maxUsesPerUser" type="number" defaultValue={editingCoupon?.maxUsesPerUser || 1} required className="rounded-xl h-11" />
                    </div>
                 </div>

                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">Mín. Recarga (R$)</Label>
                    <Input name="minRecharge" type="number" step="0.01" placeholder="30.00" defaultValue={editingCoupon?.minRecharge} className="rounded-xl h-11" />
                 </div>

                 <div className="grid grid-cols-2 gap-4 border-t border-dashed pt-4">
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-1.5">
                         <Clock className="w-3 h-3" /> Início
                       </Label>
                       <Input name="startAt" type="datetime-local" required className="rounded-xl h-11 text-xs" defaultValue={editingCoupon ? formatTimestamp(editingCoupon.startAt) : new Date().toISOString().slice(0, 16)} />
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-1.5">
                         <Clock className="w-3 h-3 text-red-500" /> Fim
                       </Label>
                       <Input name="endAt" type="datetime-local" required className="rounded-xl h-11 text-xs" defaultValue={editingCoupon ? formatTimestamp(editingCoupon.endAt) : ""} />
                    </div>
                 </div>
              </div>

              <DialogFooter>
                 <Button type="submit" disabled={isSubmitting} className="w-full bg-secondary text-white font-black h-14 rounded-2xl shadow-xl uppercase italic">
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : (editingCoupon ? "Salvar Alterações" : "Publicar Cupom")}
                 </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Buscar cupom pelo código..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-12 rounded-xl"
        />
      </div>

      <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="font-black uppercase text-[10px] tracking-widest p-6">Código / Tipo</TableHead>
              <TableHead className="font-black uppercase text-[10px] tracking-widest">Benefício</TableHead>
              <TableHead className="font-black uppercase text-[10px] tracking-widest text-center">Uso / Estoque</TableHead>
              <TableHead className="font-black uppercase text-[10px] tracking-widest">Vigência</TableHead>
              <TableHead className="text-right font-black uppercase text-[10px] tracking-widest p-6">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-secondary" /></TableCell></TableRow>
            ) : filteredCoupons.length > 0 ? (
              filteredCoupons.map((c) => {
                const usagePercent = c.maxTotalUses > 0 ? (c.currentUses / c.maxTotalUses) * 100 : 0;
                return (
                  <TableRow key={c.id} className="hover:bg-muted/5 transition-colors">
                    <TableCell className="p-6">
                      <div className="flex flex-col">
                         <span className="font-black text-sm uppercase italic text-primary">{c.code}</span>
                         <Badge variant="outline" className="w-fit text-[7px] font-black uppercase h-4 px-1 border-muted-foreground/20 mt-1">
                           {c.type === 'discount' ? "Custo" : "Saldo"}
                         </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-black text-sm text-primary">
                         {c.type === 'bonus_fixed' ? formatCurrency(c.value) : `${c.value}%`}
                      </span>
                    </TableCell>
                    <TableCell>
                       <div className="flex flex-col items-center gap-1.5 min-w-[120px]">
                          <div className="flex justify-between w-full text-[9px] font-black uppercase">
                             <span className="text-secondary">{c.currentUses}</span>
                             <span className="opacity-40">/ {c.maxTotalUses || '∞'}</span>
                          </div>
                          <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
                             <div className="h-full bg-secondary transition-all" style={{ width: `${Math.min(100, usagePercent)}%` }} />
                          </div>
                          <p className="text-[7px] font-bold text-muted-foreground uppercase">{c.maxUsesPerUser}x por user</p>
                       </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                         <span className="text-[9px] font-bold text-green-600 uppercase flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" /> {formatDisplayDate(c.startAt)}
                         </span>
                         <span className="text-[9px] font-bold text-red-500 uppercase flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" /> {formatDisplayDate(c.endAt)}
                         </span>
                      </div>
                    </TableCell>
                    <TableCell className="p-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-secondary hover:bg-secondary/10 rounded-full" onClick={() => setSelectedCouponForMetrics(c)} title="Métricas de Uso">
                          <BarChart3 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10 rounded-full" onClick={() => { setEditingCoupon(c); setIsDialogOpen(true); }} title="Editar">
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-full" onClick={() => handleDelete(c.id)} title="Remover">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow><TableCell colSpan={5} className="py-24 text-center">
                 <Inbox className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-10" />
                 <p className="text-muted-foreground font-black uppercase tracking-widest text-xs">Nenhum cupom de anúncio cadastrado.</p>
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* MODAL DE MÉTRICAS */}
      <Dialog open={!!selectedCouponForMetrics} onOpenChange={(o) => !o && setSelectedCouponForMetrics(null)}>
        <DialogContent className="max-w-4xl h-[85vh] p-0 overflow-hidden rounded-[2.5rem] flex flex-col">
          <DialogHeader className="p-8 border-b bg-muted/30">
             <div className="flex justify-between items-start">
                <div className="flex items-center gap-4">
                   <div className="p-3 bg-secondary/10 rounded-2xl text-secondary">
                      <TrendingUp className="w-6 h-6" />
                   </div>
                   <div>
                      <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-primary">Performance: {selectedCouponForMetrics?.code}</DialogTitle>
                      <DialogDescription className="font-bold text-secondary uppercase text-[10px] tracking-widest">Auditoria de Conversão em Tempo Real</DialogDescription>
                   </div>
                </div>
                <div className="text-right">
                   <p className="text-[9px] font-black uppercase opacity-40">Faturamento Gerado (Bruto)</p>
                   <p className="text-2xl font-black text-primary">
                     {formatCurrency(usageData.reduce((acc, curr) => acc + curr.totalPaid, 0))}
                   </p>
                </div>
             </div>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col">
             {loadingMetrics ? (
               <div className="flex-1 flex flex-col items-center justify-center gap-4">
                  <Loader2 className="w-8 h-8 animate-spin text-secondary" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cruzando dados de organizações...</p>
               </div>
             ) : usageData.length > 0 ? (
               <ScrollArea className="flex-1">
                  <div className="p-8">
                     <Table>
                        <TableHeader className="bg-muted/10">
                           <TableRow>
                              <TableHead className="font-black uppercase text-[9px] tracking-widest p-4">Usuário</TableHead>
                              <TableHead className="font-black uppercase text-[9px] tracking-widest">Página / Marca</TableHead>
                              <TableHead className="font-black uppercase text-[9px] tracking-widest">Data do Uso</TableHead>
                              <TableHead className="font-black uppercase text-[9px] tracking-widest text-right">Recarga (Base)</TableHead>
                              <TableHead className="font-black uppercase text-[9px] tracking-widest text-right">Total Pago (Gateway)</TableHead>
                           </TableRow>
                        </TableHeader>
                        <TableBody>
                           {usageData.map((usage) => (
                             <TableRow key={usage.id} className="hover:bg-muted/5 transition-colors">
                                <TableCell className="p-4">
                                   <div className="flex items-center gap-2">
                                      <User className="w-3 h-3 text-secondary" />
                                      <span className="font-bold text-xs uppercase">{usage.userName}</span>
                                   </div>
                                </TableCell>
                                <TableCell>
                                   <div className="flex items-center gap-2">
                                      <Building2 className="w-3 h-3 text-muted-foreground" />
                                      <span className="font-bold text-[10px] uppercase text-primary">{usage.orgName}</span>
                                   </div>
                                </TableCell>
                                <TableCell>
                                   <div className="flex items-center gap-2 text-[10px] font-medium text-muted-foreground">
                                      <Clock className="w-3 h-3" />
                                      {usage.date.toLocaleString('pt-BR')}
                                   </div>
                                </TableCell>
                                <TableCell className="text-right font-black text-xs">
                                   {formatCurrency(usage.amount)}
                                </TableCell>
                                <TableCell className="text-right">
                                   <Badge className="bg-green-500 text-white font-black text-[10px]">
                                      {formatCurrency(usage.totalPaid)}
                                   </Badge>
                                </TableCell>
                             </TableRow>
                           ))}
                        </TableBody>
                     </Table>
                  </div>
               </ScrollArea>
             ) : (
               <div className="flex-1 flex flex-col items-center justify-center p-20 text-center gap-4">
                  <Inbox className="w-16 h-16 text-muted-foreground opacity-10" />
                  <div className="space-y-1">
                     <p className="text-sm font-black uppercase italic text-primary">Sem conversões confirmadas</p>
                     <p className="text-[10px] text-muted-foreground font-medium uppercase max-w-xs mx-auto leading-relaxed">As métricas são calculadas apenas para cupons utilizados em recargas com pagamento aprovado pelo Stripe.</p>
                  </div>
               </div>
             )}
          </div>
          <div className="p-6 bg-muted/30 border-t flex items-center justify-center gap-2">
             <Info className="w-4 h-4 text-secondary opacity-40" />
             <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Estes dados são protegidos e auditáveis para fins fiscais</p>
          </div>
        </DialogContent>
      </Dialog>

      <div className="p-6 bg-secondary/5 rounded-3xl border border-secondary/10 flex items-start gap-4">
         <Info className="w-6 h-6 text-secondary shrink-0 mt-0.5" />
         <div className="space-y-1">
            <h4 className="font-black uppercase text-[10px] tracking-widest text-secondary">Regras de Validação</h4>
            <p className="text-[10px] text-muted-foreground leading-relaxed font-medium uppercase">
               O sistema valida o estoque global (`maxTotalUses`) e quantas vezes cada usuário (`maxUsesPerUser`) pode aplicar o mesmo código. Cupons de bônus creditam saldo extra sem custo adicional, enquanto cupons de desconto reduzem o valor final a pagar.
            </p>
         </div>
      </div>
    </div>
  );
}
