
'use client';

import * as React from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, setDoc, deleteDoc, serverTimestamp, addDoc } from 'firebase/firestore';
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
  Zap, 
  Coins, 
  Calendar,
  Search,
  CheckCircle2,
  TrendingUp,
  Percent,
  Inbox,
  FilterX
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

export default function AdminCuponsPage() {
  const db = useFirestore();
  const [search, setSearch] = React.useState("");
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

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

  const handleCreateCoupon = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!db) return;
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);

    const couponData = {
      code: (formData.get("code") as string).trim().toUpperCase(),
      type: formData.get("type") as string,
      value: parseFloat(formData.get("value") as string),
      minRecharge: parseFloat(formData.get("minRecharge") as string) || 0,
      maxRecharge: formData.get("maxRecharge") ? parseFloat(formData.get("maxRecharge") as string) : null,
      startAt: new Date(formData.get("startAt") as string),
      endAt: new Date(formData.get("endAt") as string),
      status: "active",
      createdAt: serverTimestamp()
    };

    try {
      await addDoc(collection(db, "ad_coupons"), couponData);
      toast({ title: "Cupom de Anúncio criado!" });
      setIsDialogOpen(false);
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao criar cupom" });
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

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
            <TicketPercent className="w-8 h-8 text-secondary" /> Cupons de Anúncio
          </h1>
          <p className="text-muted-foreground font-medium">Gestão de incentivos para recarga de saldo publicitário.</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-secondary text-white font-black rounded-full px-8 h-12 shadow-lg gap-2 uppercase italic">
              <Plus className="w-5 h-5" /> Novo Cupom Ads
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md rounded-[2.5rem]">
            <form onSubmit={handleCreateCoupon} className="space-y-6">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">Configurar Cupom</DialogTitle>
                <DialogDescription>Defina as regras de benefício para anúncios.</DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">Código do Cupom</Label>
                    <Input name="code" required placeholder="EX: BOOSTER10" className="rounded-xl h-11 uppercase font-bold" />
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase opacity-60">Tipo</Label>
                       <Select name="type" defaultValue="discount">
                          <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                          <SelectContent className="rounded-xl">
                             <SelectItem value="discount">Desconto (%) no pagamento</SelectItem>
                             <SelectItem value="bonus_percent">Aumento (%) no saldo</SelectItem>
                             <SelectItem value="bonus_fixed">Ganhar Valor Fixo (R$)</SelectItem>
                          </SelectContent>
                       </Select>
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase opacity-60">Valor do Benefício</Label>
                       <Input name="value" type="number" step="0.01" required className="rounded-xl h-11 font-black" />
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase opacity-60">Mín. Recarga (R$)</Label>
                       <Input name="minRecharge" type="number" step="0.01" placeholder="10.00" className="rounded-xl h-11" />
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase opacity-60">Máx. Recarga (R$)</Label>
                       <Input name="maxRecharge" type="number" step="0.01" placeholder="Opcional" className="rounded-xl h-11" />
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase opacity-60">Válido De</Label>
                       <Input name="startAt" type="datetime-local" required className="rounded-xl h-11 text-xs" />
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase opacity-60">Válido Até</Label>
                       <Input name="endAt" type="datetime-local" required className="rounded-xl h-11 text-xs" />
                    </div>
                 </div>
              </div>

              <DialogFooter>
                 <Button type="submit" disabled={isSubmitting} className="w-full bg-secondary text-white font-black h-14 rounded-2xl shadow-xl uppercase italic">
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : "Publicar Cupom"}
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
              <TableHead className="font-black uppercase text-[10px] tracking-widest p-6">Código / Criado em</TableHead>
              <TableHead className="font-black uppercase text-[10px] tracking-widest">Tipo de Benefício</TableHead>
              <TableHead className="font-black uppercase text-[10px] tracking-widest">Valor</TableHead>
              <TableHead className="font-black uppercase text-[10px] tracking-widest">Vigência</TableHead>
              <TableHead className="text-right font-black uppercase text-[10px] tracking-widest p-6">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-secondary" /></TableCell></TableRow>
            ) : filteredCoupons.length > 0 ? (
              filteredCoupons.map((c) => (
                <TableRow key={c.id} className="hover:bg-muted/5 transition-colors">
                  <TableCell className="p-6">
                    <div className="flex flex-col">
                       <span className="font-black text-sm uppercase italic text-primary">{c.code}</span>
                       <span className="text-[8px] font-bold text-muted-foreground uppercase">{c.createdAt?.toDate ? c.createdAt.toDate().toLocaleDateString('pt-BR') : 'agora'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn(
                      "text-[9px] font-black uppercase px-2.5 h-6",
                      c.type === 'discount' ? "border-blue-200 text-blue-600 bg-blue-50" : "border-green-200 text-green-600 bg-green-50"
                    )}>
                      {c.type === 'discount' ? "Desconto (%)" : c.type === 'bonus_percent' ? "Aumento (%)" : "Ganhar (R$)"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="font-black text-sm text-primary">
                       {c.type === 'bonus_fixed' ? formatCurrency(c.value) : `${c.value}%`}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5 text-[9px] font-medium text-muted-foreground uppercase">
                       <span>{new Date(c.startAt?.seconds * 1000 || c.startAt).toLocaleString('pt-BR')}</span>
                       <span>{new Date(c.endAt?.seconds * 1000 || c.endAt).toLocaleString('pt-BR')}</span>
                    </div>
                  </TableCell>
                  <TableCell className="p-6 text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-full" onClick={() => handleDelete(c.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={5} className="py-24 text-center">
                 <Inbox className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-10" />
                 <p className="text-muted-foreground font-black uppercase tracking-widest text-xs">Nenhum cupom de anúncio cadastrado.</p>
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <div className="p-6 bg-secondary/5 rounded-3xl border border-secondary/10 flex items-start gap-4">
         <Info className="w-6 h-6 text-secondary shrink-0 mt-0.5" />
         <div className="space-y-1">
            <h4 className="font-black uppercase text-[10px] tracking-widest text-secondary">Nota sobre os Cupons</h4>
            <p className="text-[10px] text-muted-foreground leading-relaxed font-medium uppercase">
               Os cupons de anúncio são processados durante a recarga do saldo livre da marca. O tipo 'Aumento' e 'Ganhar' adicionam saldo extra sem custo adicional para o usuário, enquanto o tipo 'Desconto' reduz o valor final pago no checkout.
            </p>
         </div>
      </div>
    </div>
  );
}
