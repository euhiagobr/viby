
'use client';

import * as React from 'react';
import { useFirestore, useCollection, useMemoFirebase, useAuth, useUser } from '@/firebase';
import { collection, query, orderBy, where, getDocs, limit, doc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Users, 
  Handshake, 
  Search, 
  Loader2, 
  Plus, 
  Settings2, 
  Wallet, 
  History,
  ShieldAlert,
  CheckCircle2,
  Trash2,
  ChevronRight,
  TrendingUp,
  Inbox,
  AlertTriangle,
  X
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/financial-utils';
import { cn } from "@/lib/utils";
import { createPartnerAction, togglePartnerStatusAction, updatePartnerTiersAction } from '@/app/actions/partners';
import { PartnerTier } from '@/lib/partner-utils';

export default function AdminPartnersPage() {
  const db = useFirestore();
  const auth = useAuth();
  const { user: adminUser } = useUser(auth);
  
  const [search, setSearch] = React.useState("");
  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [isTiersOpen, setIsTiersOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  
  const [selectedPartner, setSelectedPartner] = React.useState<any>(null);
  const [newPartnerId, setNewPartnerId] = React.useState("");
  const [newPartnerCode, setNewPartnerCode] = React.useState("");
  
  // Tiers editor state
  const [editingTiers, setEditingTiers] = React.useState<PartnerTier[]>([]);

  const partnersQuery = useMemoFirebase(() => 
    db ? query(collection(db, "partners"), orderBy("createdAt", "desc")) : null, 
    [db]
  );
  const { data: partners, loading } = useCollection<any>(partnersQuery);

  const filtered = React.useMemo(() => {
    if (!partners) return [];
    return partners.filter(p => 
      p.name?.toLowerCase().includes(search.toLowerCase()) || 
      p.code?.toLowerCase().includes(search.toLowerCase()) ||
      p.email?.toLowerCase().includes(search.toLowerCase())
    );
  }, [partners, search]);

  const handleAddPartner = async () => {
    if (!newPartnerId || !newPartnerCode || !adminUser) return;
    setIsSubmitting(true);
    try {
      const res = await createPartnerAction({
        userId: newPartnerId,
        code: newPartnerCode,
        adminUid: adminUser.uid
      });
      if (res.success) {
        toast({ title: "Parceiro adicionado!" });
        setIsAddOpen(false);
        setNewPartnerId("");
        setNewPartnerCode("");
      } else throw new Error(res.error);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro", description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateTiers = async () => {
    if (!selectedPartner || !adminUser) return;
    setIsSubmitting(true);
    try {
      const res = await updatePartnerTiersAction({
        partnerId: selectedPartner.id,
        tiers: editingTiers,
        adminUid: adminUser.uid
      });
      if (res.success) {
        toast({ title: "Tabela de comissões atualizada!" });
        setIsTiersOpen(false);
      } else throw new Error(res.error);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro", description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (partner: any) => {
    if (!adminUser) return;
    const newStatus = partner.status === 'active' ? 'inactive' : 'active';
    try {
      const res = await togglePartnerStatusAction(partner.id, newStatus, adminUser.uid);
      if (!res.success) throw new Error(res.error);
      toast({ title: `Parceiro ${newStatus === 'active' ? 'reativado' : 'suspenso'}` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro", description: e.message });
    }
  };

  const addTierRow = () => {
    setEditingTiers([...editingTiers, { min: 0, max: null, value: 0 }]);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
            <Handshake className="w-8 h-8 text-secondary" />
            Módulo de Parceiros
          </h1>
          <p className="text-muted-foreground font-medium">Gestão de indicações de alto nível e comissionamento por faixas.</p>
        </div>
        
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
           <DialogTrigger asChild>
              <Button className="bg-secondary text-white font-black rounded-full px-8 h-12 shadow-lg gap-2 uppercase italic">
                <Plus className="w-5 h-5" /> Adicionar Parceiro
              </Button>
           </DialogTrigger>
           <DialogContent className="max-w-md rounded-[2.5rem]">
              <DialogHeader>
                 <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-primary">Novo Parceiro</DialogTitle>
                 <DialogDescription>Promova um usuário existente para o programa de parceiros.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">UID do Usuário (Viby)</Label>
                    <Input value={newPartnerId} onChange={e => setNewPartnerId(e.target.value)} placeholder="Copie o UID do perfil do usuário" className="rounded-xl h-11" />
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">Código de Indicação</Label>
                    <Input value={newPartnerCode} onChange={e => setNewPartnerCode(e.target.value.toUpperCase())} placeholder="EX: MARIA10" className="rounded-xl h-11 uppercase font-bold" />
                 </div>
              </div>
              <DialogFooter>
                 <Button onClick={handleAddPartner} disabled={isSubmitting} className="w-full bg-secondary text-white font-black h-14 rounded-2xl shadow-xl uppercase italic">
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : "Confirmar Parceria"}
                 </Button>
              </DialogFooter>
           </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar parceiro..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 h-12 rounded-xl" />
      </div>

      <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="font-black uppercase text-[10px] p-6">Parceiro / Código</TableHead>
              <TableHead className="font-black uppercase text-[10px] text-center">Status</TableHead>
              <TableHead className="font-black uppercase text-[10px] text-center">Indicados</TableHead>
              <TableHead className="font-black uppercase text-[10px] text-right">Saldo Disp.</TableHead>
              <TableHead className="text-right font-black uppercase text-[10px] p-6">Gestão</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-secondary" /></TableCell></TableRow>
            ) : filtered.length > 0 ? (
              filtered.map(p => (
                <TableRow key={p.id} className={cn("hover:bg-muted/5", p.status === 'inactive' && "opacity-50 grayscale")}>
                  <TableCell className="p-6">
                    <div className="flex flex-col">
                      <span className="font-bold text-sm text-primary uppercase italic">{p.name}</span>
                      <span className="text-[10px] font-black text-secondary tracking-widest uppercase">CODE: {p.code}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className={cn("text-[8px] font-black uppercase h-5", p.status === 'active' ? "bg-green-600" : "bg-red-500")}>{p.status === 'active' ? 'ATIVO' : 'SUSPENSO'}</Badge>
                  </TableCell>
                  <TableCell className="text-center font-bold text-xs">{p.stats?.referralsCount || 0}</TableCell>
                  <TableCell className="text-right font-black text-sm text-primary">{formatCurrency(p.stats?.availableBalance || 0)}</TableCell>
                  <TableCell className="p-6 text-right">
                    <div className="flex items-center justify-end gap-1">
                       <Button variant="ghost" size="icon" onClick={() => { setSelectedPartner(p); setEditingTiers(p.tiers); setIsTiersOpen(true); }} className="text-secondary"><Settings2 className="w-4 h-4" /></Button>
                       <Button variant="ghost" size="icon" onClick={() => handleToggleStatus(p)} className={p.status === 'active' ? "text-orange-500" : "text-green-600"} title={p.status === 'active' ? "Suspender" : "Ativar"}>
                          {p.status === 'active' ? <ShieldAlert className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                       </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={5} className="py-32 text-center opacity-30 italic"><Inbox className="w-12 h-12 mx-auto mb-4" />Nenhum parceiro localizado.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* EDITOR DE COMISSÕES */}
      <Dialog open={isTiersOpen} onOpenChange={setIsTiersOpen}>
        <DialogContent className="max-w-xl rounded-[2.5rem] p-0 overflow-hidden">
           <DialogHeader className="p-8 border-b bg-muted/30">
              <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-primary">Tabela de Comissões</DialogTitle>
              <DialogDescription className="font-bold text-secondary text-[10px] uppercase">Personalize os ganhos de: {selectedPartner?.name}</DialogDescription>
           </DialogHeader>
           <div className="p-8 space-y-6">
              <div className="space-y-4">
                 <div className="grid grid-cols-12 gap-2 text-[8px] font-black uppercase opacity-40 px-2">
                    <div className="col-span-4">Valor Min (R$)</div>
                    <div className="col-span-4">Valor Max (R$)</div>
                    <div className="col-span-3 text-right">Comissão (R$)</div>
                    <div className="col-span-1"></div>
                 </div>
                 <div className="space-y-2">
                    {editingTiers.map((tier, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-muted/20 p-2 rounded-xl border border-dashed">
                         <div className="col-span-4"><Input type="number" step="0.01" value={tier.min} onChange={e => {
                            const n = [...editingTiers]; n[idx].min = parseFloat(e.target.value) || 0; setEditingTiers(n);
                         }} className="h-9 text-xs rounded-lg" /></div>
                         <div className="col-span-4"><Input type="number" step="0.01" value={tier.max === null ? "" : tier.max} onChange={e => {
                            const n = [...editingTiers]; n[idx].max = e.target.value ? parseFloat(e.target.value) : null; setEditingTiers(n);
                         }} placeholder="∞" className="h-9 text-xs rounded-lg" /></div>
                         <div className="col-span-3"><Input type="number" step="0.01" value={tier.value} onChange={e => {
                            const n = [...editingTiers]; n[idx].value = parseFloat(e.target.value) || 0; setEditingTiers(n);
                         }} className="h-9 text-xs font-black text-primary text-right rounded-lg" /></div>
                         <div className="col-span-1 flex justify-center">
                            <button onClick={() => setEditingTiers(editingTiers.filter((_, i) => i !== idx))} className="text-destructive opacity-40 hover:opacity-100"><Trash2 className="w-3.5 h-3.5" /></button>
                         </div>
                      </div>
                    ))}
                 </div>
                 <Button variant="outline" onClick={addTierRow} className="w-full h-10 rounded-xl border-dashed gap-2 text-[10px] font-black uppercase">
                    <Plus className="w-3.5 h-3.5" /> Adicionar Faixa
                 </Button>
              </div>

              <div className="p-4 bg-secondary/5 rounded-2xl flex gap-3 border border-secondary/10">
                 <Info className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
                 <p className="text-[10px] text-secondary font-bold uppercase leading-relaxed italic">As faixas são processadas em cascata. O sistema identifica o preço do ingresso e aplica a comissão fixa correspondente.</p>
              </div>
           </div>
           <DialogFooter className="p-8 bg-muted/10 border-t">
              <Button onClick={handleUpdateTiers} disabled={isSubmitting} className="w-full bg-secondary text-white font-black h-14 rounded-2xl shadow-xl uppercase italic">
                 {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />} Salvar Tabela
              </Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
