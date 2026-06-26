
'use client';

import * as React from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Calculator, 
  Plus, 
  Search, 
  Loader2, 
  Edit, 
  Trash2, 
  Copy, 
  Power, 
  PowerOff,
  Calendar,
  CheckCircle2,
  XCircle,
  MoreVertical,
  Percent,
  Coins
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { 
  createSimulationCampaign, 
  updateSimulationCampaign, 
  deleteSimulationCampaign, 
  toggleSimulationCampaign 
} from '@/app/actions/simulation';
import { cn } from '@/lib/utils';

export default function AdminTaxasAtracaoPage() {
  const db = useFirestore();
  const [search, setSearch] = React.useState("");
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingCampaign, setEditingCampaign] = React.useState<any>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const campaignsQuery = useMemoFirebase(() => 
    db ? query(collection(db, "simulation_campaigns"), orderBy("createdAt", "desc")) : null, 
    [db]
  );
  const { data: campaigns, loading } = useCollection<any>(campaignsQuery);

  const filtered = campaigns?.filter(c => 
    c.name?.toLowerCase().includes(search.toLowerCase()) || 
    c.code?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    
    const payload = {
      name: formData.get("name") as string,
      code: (formData.get("code") as string).toUpperCase(),
      description: formData.get("description") as string,
      orgFeePercent: parseFloat(formData.get("orgFeePercent") as string),
      orgMinFee: parseFloat(formData.get("orgMinFee") as string),
      buyerFeePercent: parseFloat(formData.get("buyerFeePercent") as string),
      active: true,
      startAt: formData.get("startAt") as string,
      endAt: formData.get("endAt") as string,
    };

    try {
      const res = editingCampaign 
        ? await updateSimulationCampaign(editingCampaign.id, payload)
        : await createSimulationCampaign(payload);

      if (res.success) {
        toast({ title: editingCampaign ? "Campanha atualizada" : "Campanha criada" });
        setIsDialogOpen(false);
        setEditingCampaign(null);
      } else throw new Error(res.error);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro", description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggle = async (id: string, current: boolean) => {
    try {
      await toggleSimulationCampaign(id, !current);
      toast({ title: !current ? "Ativada" : "Desativada" });
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao alterar status" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta campanha de simulação?")) return;
    try {
      await deleteSimulationCampaign(id);
      toast({ title: "Excluída" });
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao excluir" });
    }
  };

  const duplicate = (c: any) => {
    setEditingCampaign({ ...c, id: null, code: `${c.code}_COPY`, name: `${c.name} (Cópia)` });
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black italic uppercase tracking-tighter text-primary flex items-center gap-3">
            <Calculator className="w-8 h-8 text-secondary" /> Campanhas de Atração
          </h1>
          <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest">Gestão de Taxas para a Calculadora Comercial</p>
        </div>
        <Button onClick={() => { setEditingCampaign(null); setIsDialogOpen(true); }} className="bg-secondary text-white font-black rounded-full px-8 h-11 gap-2 uppercase italic shadow-lg">
          <Plus className="w-5 h-5" /> Nova Campanha
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar campanha..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 h-11 rounded-xl" />
      </div>

      <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="font-black uppercase text-[10px] p-6">Nome / Código</TableHead>
              <TableHead className="font-black uppercase text-[10px]">Taxa Org.</TableHead>
              <TableHead className="font-black uppercase text-[10px]">Taxa Compr.</TableHead>
              <TableHead className="font-black uppercase text-[10px] text-center">Status</TableHead>
              <TableHead className="text-right font-black uppercase text-[10px] p-6">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-secondary" /></TableCell></TableRow>
            ) : filtered.length > 0 ? (
              filtered.map(c => (
                <TableRow key={c.id} className="hover:bg-muted/10 transition-colors">
                  <TableCell className="p-6">
                    <div className="flex flex-col">
                      <span className="font-bold text-sm text-primary uppercase">{c.name}</span>
                      <span className="text-[10px] font-black text-secondary tracking-widest">{c.code}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                       <span className="text-xs font-black">{c.orgFeePercent}%</span>
                       <span className="text-[9px] font-bold opacity-40">Mín: R$ {c.orgMinFee}</span>
                    </div>
                  </TableCell>
                  <TableCell><span className="text-xs font-black">{c.buyerFeePercent}%</span></TableCell>
                  <TableCell className="text-center">
                    <Badge className={cn("text-[8px] font-black uppercase h-5", c.active ? "bg-green-600" : "bg-red-500")}>
                      {c.active ? "Ativa" : "Inativa"}
                    </Badge>
                  </TableCell>
                  <TableCell className="p-6 text-right">
                     <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                           <Button variant="ghost" size="icon" className="rounded-full"><MoreVertical className="w-4 h-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl">
                           <DropdownMenuItem onClick={() => { setEditingCampaign(c); setIsDialogOpen(true); }} className="gap-2"><Edit className="w-4 h-4" /> Editar</DropdownMenuItem>
                           <DropdownMenuItem onClick={() => duplicate(c)} className="gap-2"><Copy className="w-4 h-4" /> Duplicar</DropdownMenuItem>
                           <DropdownMenuItem onClick={() => handleToggle(c.id, c.active)} className="gap-2">
                              {c.active ? <><PowerOff className="w-4 h-4" /> Desativar</> : <><Power className="w-4 h-4" /> Ativar</>}
                           </DropdownMenuItem>
                           <DropdownMenuItem onClick={() => handleDelete(c.id)} className="gap-2 text-destructive"><Trash2 className="w-4 h-4" /> Excluir</DropdownMenuItem>
                        </DropdownMenuContent>
                     </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={5} className="py-24 text-center opacity-30 italic">Nenhuma campanha cadastrada.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
         <DialogContent className="max-w-md rounded-[2.5rem]">
            <form onSubmit={handleSave} className="space-y-6">
               <DialogHeader>
                  <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">Configurar Campanha</DialogTitle>
                  <DialogDescription>Defina os parâmetros para a calculadora de marketing.</DialogDescription>
               </DialogHeader>
               <div className="space-y-4">
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase opacity-60">Nome da Campanha</Label>
                     <Input name="name" required defaultValue={editingCampaign?.name} className="rounded-xl" />
                  </div>
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase opacity-60">Código Único</Label>
                     <Input name="code" required defaultValue={editingCampaign?.code} className="rounded-xl font-black" />
                  </div>
                  <Separator className="border-dashed" />
                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-1"><Percent className="w-3 h-3" /> Org. %</Label>
                        <Input name="orgFeePercent" type="number" step="0.1" required defaultValue={editingCampaign?.orgFeePercent} className="rounded-xl" />
                     </div>
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-1"><Coins className="w-3 h-3" /> Org. Mín (R$)</Label>
                        <Input name="orgMinFee" type="number" step="0.01" required defaultValue={editingCampaign?.orgMinFee} className="rounded-xl" />
                     </div>
                  </div>
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-1"><Percent className="w-3 h-3" /> Comprador %</Label>
                     <Input name="buyerFeePercent" type="number" step="0.1" required defaultValue={editingCampaign?.buyerFeePercent} className="rounded-xl" />
                  </div>
                  <Separator className="border-dashed" />
                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase opacity-60">Início</Label>
                        <Input name="startAt" type="date" defaultValue={editingCampaign?.startAt} className="rounded-xl text-xs" />
                     </div>
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase opacity-60">Fim</Label>
                        <Input name="endAt" type="date" defaultValue={editingCampaign?.endAt} className="rounded-xl text-xs" />
                     </div>
                  </div>
               </div>
               <DialogFooter>
                  <Button type="submit" disabled={isSubmitting} className="w-full h-14 bg-secondary text-white font-black rounded-2xl shadow-xl uppercase italic">
                     {isSubmitting ? <Loader2 className="animate-spin" /> : editingCampaign?.id ? "Salvar Alterações" : "Criar Campanha"}
                  </Button>
               </DialogFooter>
            </form>
         </DialogContent>
      </Dialog>
    </div>
  );
}
