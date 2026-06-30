'use client';

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Plus, 
  Trash2, 
  Loader2, 
  Calendar, 
  Clock, 
  Coins, 
  Users, 
  Pause, 
  Play,
  Save,
  CheckCircle2,
  XCircle,
  Zap,
  Edit,
  X
} from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { 
  createExperienceSlotAction, 
  updateExperienceSlotAction, 
  deleteExperienceSlotAction 
} from '@/app/actions/experiences';
import { toast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/financial-utils';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';

interface ExperienceSlotsAdminProps {
  experienceId: string;
}

export function ExperienceSlotsAdmin({ experienceId }: ExperienceSlotsAdminProps) {
  const db = useFirestore();
  const [isAdding, setIsAdding] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const slotsQuery = useMemoFirebase(() => {
    if (!db || !experienceId) return null;
    return query(
      collection(db, "experiences", experienceId, "slots"),
      orderBy("datetime", "asc")
    );
  }, [db, experienceId]);

  const { data: slots, loading: loadingSlots } = useCollection<any>(slotsQuery);

  const [slotForm, setSlotForm] = React.useState({
    datetime: "",
    price: 0,
    capacity: 100,
    hasPromo: false,
    promoPrice: 0,
    promoStart: "",
    promoEnd: "",
    status: 'active' as 'active' | 'paused' | 'closed'
  });

  const handleAddSlot = async () => {
    if (!slotForm.datetime || loading) return;
    setLoading(true);
    try {
      const res = await createExperienceSlotAction(experienceId, slotForm);
      if (res.success) {
        toast({ title: "Horário adicionado!" });
        setIsAdding(false);
        resetForm();
      } else throw new Error(res.error);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao criar", description: e.message });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSlot = async (slotId: string) => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await updateExperienceSlotAction(experienceId, slotId, slotForm);
      if (res.success) {
        toast({ title: "Horário atualizado!" });
        setEditingId(null);
        resetForm();
      } else throw new Error(res.error);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao atualizar", description: e.message });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSlotForm({
      datetime: "",
      price: 0,
      capacity: 100,
      hasPromo: false,
      promoPrice: 0,
      promoStart: "",
      promoEnd: "",
      status: 'active'
    });
  };

  const startEdit = (slot: any) => {
    setSlotForm({
      datetime: slot.datetime,
      price: slot.price,
      capacity: slot.capacity,
      hasPromo: slot.hasPromo || false,
      promoPrice: slot.promoPrice || 0,
      promoStart: slot.promoStart || "",
      promoEnd: slot.promoEnd || "",
      status: slot.status
    });
    setEditingId(slot.id);
    setIsAdding(false);
  };

  const handleToggleStatus = async (slotId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'active' ? 'paused' : 'active';
    try {
      await updateExperienceSlotAction(experienceId, slotId, { status: nextStatus });
      toast({ title: `Horário ${nextStatus === 'active' ? 'ativado' : 'pausado'}` });
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao atualizar" });
    }
  };

  const handleDelete = async (slotId: string) => {
    if (!confirm("Remover este horário permanentemente?")) return;
    try {
      await deleteExperienceSlotAction(experienceId, slotId);
      toast({ title: "Horário removido." });
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao remover" });
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary">Sessões & Horários</h3>
          <p className="text-xs font-bold text-muted-foreground uppercase">Gerencie cada dia e hora de operação.</p>
        </div>
        {!isAdding && !editingId && (
          <Button 
            onClick={() => setIsAdding(true)} 
            className="bg-secondary text-white font-black rounded-xl h-10 px-6 uppercase italic shadow-lg gap-2"
          >
            <Plus className="w-4 h-4" /> Novo Horário
          </Button>
        )}
      </div>

      {(isAdding || editingId) && (
        <Card className="border-2 border-dashed border-secondary/20 bg-secondary/5 rounded-[2rem] overflow-hidden animate-in slide-in-from-top-4">
          <CardContent className="p-8 space-y-8">
            <div className="flex justify-between items-center">
              <h4 className="font-black uppercase italic text-primary">{editingId ? "Editar Sessão" : "Nova Sessão"}</h4>
              <button onClick={() => { setIsAdding(false); setEditingId(null); resetForm(); }} className="text-muted-foreground hover:text-destructive"><X className="w-5 h-5" /></button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-secondary" /> Data e Horário
                </Label>
                <Input 
                  type="datetime-local" 
                  value={slotForm.datetime}
                  onChange={e => setSlotForm({...slotForm, datetime: e.target.value})}
                  className="rounded-xl h-11"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-2">
                       <Coins className="w-3.5 h-3.5 text-secondary" /> Valor (R$)
                    </Label>
                    <Input 
                      type="number" 
                      step="0.01"
                      value={slotForm.price}
                      onChange={e => setSlotForm({...slotForm, price: parseFloat(e.target.value) || 0})}
                      className="rounded-xl h-11 font-black"
                    />
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-2">
                       <Users className="w-3.5 h-3.5 text-secondary" /> Vagas
                    </Label>
                    <Input 
                      type="number"
                      value={slotForm.capacity}
                      onChange={e => setSlotForm({...slotForm, capacity: parseInt(e.target.value) || 0})}
                      className="rounded-xl h-11 font-bold"
                    />
                 </div>
              </div>
            </div>

            <Separator className="border-dashed" />

            <div className="space-y-6">
               <div className="flex items-center justify-between p-4 bg-white rounded-2xl border shadow-sm">
                  <div className="flex items-center gap-3">
                     <Zap className={cn("w-5 h-5", slotForm.hasPromo ? "text-orange-500 fill-orange-500" : "text-muted-foreground")} />
                     <div>
                        <p className="text-xs font-black uppercase italic">Valor Promocional?</p>
                        <p className="text-[9px] font-bold text-muted-foreground uppercase leading-none">O preço mudará automaticamente no período definido.</p>
                     </div>
                  </div>
                  <Switch checked={slotForm.hasPromo} onCheckedChange={v => setSlotForm({...slotForm, hasPromo: v})} />
               </div>

               {slotForm.hasPromo && (
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in slide-in-from-top-2">
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-orange-600">Preço Promo (R$)</Label>
                       <Input 
                         type="number" step="0.01" 
                         value={slotForm.promoPrice} 
                         onChange={e => setSlotForm({...slotForm, promoPrice: parseFloat(e.target.value) || 0})}
                         className="h-11 rounded-xl font-black border-orange-200"
                       />
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase opacity-60">Início Vendas Promo</Label>
                       <Input 
                         type="datetime-local" 
                         value={slotForm.promoStart} 
                         onChange={e => setSlotForm({...slotForm, promoStart: e.target.value})}
                         className="h-11 rounded-xl text-xs"
                       />
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase opacity-60 text-red-500">Fim Vendas Promo</Label>
                       <Input 
                         type="datetime-local" 
                         value={slotForm.promoEnd} 
                         onChange={e => setSlotForm({...slotForm, promoEnd: e.target.value})}
                         className="h-11 rounded-xl text-xs"
                       />
                    </div>
                 </div>
               )}
            </div>

            <div className="flex gap-2 justify-end pt-4">
               <Button variant="ghost" className="rounded-xl font-bold uppercase text-[10px]" onClick={() => { setIsAdding(false); setEditingId(null); resetForm(); }}>Cancelar</Button>
               <Button 
                 onClick={() => editingId ? handleUpdateSlot(editingId) : handleAddSlot()} 
                 disabled={loading || !slotForm.datetime}
                 className="bg-secondary text-white font-black h-11 px-8 rounded-xl shadow-xl uppercase italic"
               >
                 {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                 {editingId ? "Salvar Alterações" : "Confirmar Horário"}
               </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4">
        {loadingSlots ? (
          <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-secondary" /></div>
        ) : slots && slots.length > 0 ? (
          slots.map((slot: any) => (
            <Card key={slot.id} className={cn(
              "border-none shadow-sm rounded-2xl bg-white overflow-hidden transition-all group",
              slot.status === 'paused' && "opacity-60 grayscale-[0.5]",
              editingId === slot.id && "ring-2 ring-secondary"
            )}>
              <CardContent className="p-6 flex items-center justify-between gap-6">
                <div className="flex items-center gap-6">
                   <div className="p-3 bg-muted rounded-2xl text-secondary">
                      <Clock className="w-6 h-6" />
                   </div>
                   <div className="space-y-1">
                      <p className="text-sm font-black uppercase italic text-primary leading-none">
                        {new Date(slot.datetime).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                        <span className="mx-2 opacity-20">|</span>
                        {new Date(slot.datetime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <div className="flex items-center gap-3">
                         <Badge variant="outline" className="text-[8px] font-black uppercase h-5 px-1.5 border-dashed">
                           {slot.capacity} VAGAS • {slot.sold || 0} VENDIDAS
                         </Badge>
                         <div className="flex items-center gap-2">
                            {slot.hasPromo ? (
                               <div className="flex items-center gap-2">
                                  <span className="text-[10px] line-through opacity-30">{formatCurrency(slot.price)}</span>
                                  <span className="text-xs font-black text-orange-600 flex items-center gap-1">
                                     <Zap className="w-3 h-3 fill-current" /> {formatCurrency(slot.promoPrice)}
                                  </span>
                               </div>
                            ) : (
                               <span className="text-xs font-black text-secondary">{formatCurrency(slot.price)}</span>
                            )}
                         </div>
                      </div>
                   </div>
                </div>

                <div className="flex items-center gap-3">
                   <Badge className={cn(
                     "text-[8px] font-black uppercase h-5",
                     slot.status === 'active' ? "bg-green-600 text-white" : "bg-orange-500 text-white"
                   )}>
                     {slot.status === 'active' ? 'ATIVO' : 'PAUSADO'}
                   </Badge>
                   <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => startEdit(slot)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => handleToggleStatus(slot.id, slot.status)}>
                        {slot.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10" onClick={() => handleDelete(slot.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                   </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="py-24 text-center border-2 border-dashed rounded-[3rem] opacity-20 flex flex-col items-center gap-4">
             <Calendar className="w-12 h-12" />
             <p className="text-[10px] font-black uppercase tracking-widest">Nenhum horário configurado ainda.</p>
          </div>
        )}
      </div>
    </div>
  );
}
