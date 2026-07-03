
'use client';

import * as React from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Trash2, 
  Loader2, 
  ChevronRight, 
  Utensils, 
  Clock, 
  Zap, 
  Info,
  AlertTriangle,
  Edit,
  Layers,
  ShoppingBag,
  Save,
  X
} from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { toast } from '@/hooks/use-toast';
import { cn } from "@/lib/utils";
import { 
  createMenuSectionAction, 
  updateMenuSectionAction, 
  deleteMenuSectionAction,
  createMenuItemAction,
  updateMenuItemAction,
  deleteMenuItemAction 
} from '@/app/actions/menu';

const ALLERGENS_OPTIONS = [
  "Glúten", "Lactose", "Ovos", "Peixes", "Amendoim", "Soja", "Frutos do Mar", "Castanhas", "Pimenta"
];

interface MenuManagementProps {
  orgId: string;
}

export function MenuManagement({ orgId }: MenuManagementProps) {
  const db = useFirestore();
  
  // Queries em tempo real
  const sectionsQuery = useMemoFirebase(() => 
    db ? query(collection(db, 'organizations', orgId, 'menu_sections'), orderBy('ordem', 'asc')) : null, 
    [db, orgId]
  );
  const { data: sections, loading: loadingSections } = useCollection<any>(sectionsQuery);

  const itemsQuery = useMemoFirebase(() => 
    db ? query(collection(db, 'organizations', orgId, 'menu_items'), orderBy('nome', 'asc')) : null, 
    [db, orgId]
  );
  const { data: items, loading: loadingItems } = useCollection<any>(itemsQuery);

  const [isSectionDialogOpen, setIsSectionDialogOpen] = React.useState(false);
  const [isItemDialogOpen, setIsItemDialogOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [editingItem, setEditingId] = React.useState<any>(null);

  // Estados do Formulário de Item
  const [itemForm, setItemForm] = React.useState<any>({
    nome: "",
    descricao: "",
    sectionId: "",
    valor: "",
    porcao: "",
    temAlergenicos: false,
    alergenicos: [] as string[],
    promocional: false,
    valorPromocional: "",
    promoInicio: "",
    promoFim: ""
  });

  const handleCreateSection = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    try {
      const res = await createMenuSectionAction(orgId, {
        nome: formData.get('nome') as string,
        ordem: sections.length + 1
      });
      if (res.success) {
        toast({ title: "Seção criada!" });
        setIsSectionDialogOpen(false);
      }
    } catch (e) { toast({ variant: "destructive", title: "Erro ao criar" }); }
    finally { setIsSubmitting(false); }
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemForm.sectionId) {
      toast({ variant: "destructive", title: "Selecione uma seção" });
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = {
        ...itemForm,
        valor: parseFloat(itemForm.valor),
        valorPromocional: itemForm.promocional ? parseFloat(itemForm.valorPromocional) : null
      };

      const res = editingItem 
        ? await updateMenuItemAction(orgId, editingItem.id, payload)
        : await createMenuItemAction(orgId, payload);

      if (res.success) {
        toast({ title: editingItem ? "Item atualizado" : "Item adicionado!" });
        setIsItemDialogOpen(false);
        resetItemForm();
      }
    } catch (e) { toast({ variant: "destructive", title: "Erro ao salvar" }); }
    finally { setIsSubmitting(false); }
  };

  const resetItemForm = () => {
    setItemForm({
      nome: "", descricao: "", sectionId: "", valor: "", porcao: "",
      temAlergenicos: false, alergenicos: [],
      promocional: false, valorPromocional: "", promoInicio: "", promoFim: ""
    });
    setEditingId(null);
  };

  const handleToggleAlergenico = (tag: string) => {
    setItemForm((prev: any) => ({
      ...prev,
      alergenicos: prev.alergenicos.includes(tag) 
        ? prev.alergenicos.filter((t: string) => t !== tag)
        : [...prev.alergenicos, tag]
    }));
  };

  if (loadingSections || loadingItems) return <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-secondary" /></div>;

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
         <div className="space-y-1">
            <h2 className="text-2xl font-black uppercase italic tracking-tighter text-primary">Gerenciamento de Cardápio</h2>
            <p className="text-xs font-bold text-muted-foreground uppercase">Organize seus produtos e ofertas nativas.</p>
         </div>
         <div className="flex gap-2">
            <Dialog open={isSectionDialogOpen} onOpenChange={setIsSectionDialogOpen}>
               <DialogTrigger asChild>
                  <Button variant="outline" className="rounded-xl h-11 px-6 font-bold uppercase text-[10px] border-secondary text-secondary">
                     <Layers className="w-4 h-4 mr-2" /> Nova Seção
                  </Button>
               </DialogTrigger>
               <DialogContent className="max-w-sm rounded-[2rem]">
                  <form onSubmit={handleCreateSection} className="space-y-6">
                     <DialogHeader><DialogTitle className="text-xl font-black uppercase italic">Adicionar Categoria</DialogTitle></DialogHeader>
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase opacity-60">Nome (ex: Entradas, Bebidas)</Label>
                        <Input name="nome" required className="rounded-xl h-12" />
                     </div>
                     <DialogFooter><Button type="submit" disabled={isSubmitting} className="w-full bg-secondary text-white font-black h-12 rounded-xl uppercase italic">{isSubmitting ? <Loader2 className="animate-spin" /> : "Criar Seção"}</Button></DialogFooter>
                  </form>
               </DialogContent>
            </Dialog>

            <Button 
              onClick={() => { resetItemForm(); setIsItemDialogOpen(true); }}
              className="bg-primary text-white font-black rounded-full px-8 h-11 shadow-lg gap-2 uppercase italic"
            >
               <Plus className="w-5 h-5" /> Novo Item
            </Button>
         </div>
      </div>

      {sections.length === 0 ? (
        <div className="py-32 text-center bg-white rounded-[3rem] border-2 border-dashed opacity-30 italic flex flex-col items-center gap-4">
           <Utensils className="w-12 h-12" />
           <p className="text-xs font-black uppercase tracking-widest">Crie sua primeira seção para começar</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-12">
           {sections.map(section => (
             <section key={section.id} className="space-y-6">
                <div className="flex items-center justify-between px-2 border-b border-dashed pb-4">
                   <div className="flex items-center gap-3">
                      <div className="p-2 bg-secondary/10 rounded-lg text-secondary"><ChevronRight className="w-4 h-4" /></div>
                      <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary">{section.nome}</h3>
                   </div>
                   <Button variant="ghost" size="icon" onClick={() => deleteMenuSectionAction(orgId, section.id)} className="text-destructive opacity-20 hover:opacity-100"><Trash2 className="w-4 h-4" /></Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                   {items.filter((i:any) => i.sectionId === section.id).map((item: any) => (
                     <Card key={item.id} className="border-none shadow-sm rounded-[1.5rem] bg-white group hover:shadow-md transition-all">
                        <CardContent className="p-6 space-y-4">
                           <div className="flex justify-between items-start">
                              <div className="space-y-1">
                                 <h4 className="font-bold text-sm uppercase italic text-primary">{item.nome}</h4>
                                 <p className="text-[10px] text-muted-foreground font-medium">{item.porcao}</p>
                              </div>
                              <div className="text-right">
                                 {item.promocional ? (
                                   <div className="flex flex-col items-end">
                                      <span className="text-[10px] line-through opacity-30 font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valor)}</span>
                                      <span className="text-sm font-black text-secondary">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valorPromocional)}</span>
                                   </div>
                                 ) : (
                                   <span className="text-sm font-black text-primary">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valor)}</span>
                                 )}
                              </div>
                           </div>
                           <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">{item.descricao}</p>
                           <div className="flex justify-between items-center pt-4 border-t border-dashed">
                              <div className="flex gap-1">
                                 {item.alergenicos?.map((a: string) => <Badge key={a} variant="outline" className="text-[7px] h-4 font-black uppercase border-red-100 text-red-500 bg-red-50">{a}</Badge>)}
                              </div>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                 <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => { setEditingId(item); setItemForm(item); setIsItemDialogOpen(true); }}><Edit className="w-4 h-4" /></Button>
                                 <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMenuItemAction(orgId, item.id)}><Trash2 className="w-4 h-4" /></Button>
                              </div>
                           </div>
                        </CardContent>
                     </Card>
                   ))}
                </div>
             </section>
           ))}
        </div>
      )}

      {/* DIALOG DE ITEM */}
      <Dialog open={isItemDialogOpen} onOpenChange={(v) => { if(!v) resetItemForm(); setIsItemDialogOpen(v); }}>
         <DialogContent className="max-w-xl rounded-[2.5rem] p-0 overflow-hidden">
            <DialogHeader className="p-8 border-b bg-muted/30">
               <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-primary">{editingItem ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
               <DialogDescription className="font-bold text-secondary text-[10px] uppercase">Preencha os detalhes do item no cardápio.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSaveItem} className="p-8 space-y-8 max-h-[60vh] overflow-y-auto">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Nome do Item</Label>
                     <Input value={itemForm.nome} onChange={e => setItemForm({...itemForm, nome: e.target.value})} required className="rounded-xl h-11" />
                  </div>
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Seção</Label>
                     <Select value={itemForm.sectionId} onValueChange={v => setItemForm({...itemForm, sectionId: v})}>
                        <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent className="rounded-xl">{sections?.map((s:any) => <SelectItem key={s.id} value={s.id}>{s.nome.toUpperCase()}</SelectItem>)}</SelectContent>
                     </Select>
                  </div>
               </div>

               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Descrição Longa</Label>
                  <Textarea value={itemForm.descricao} onChange={e => setItemForm({...itemForm, descricao: e.target.value})} required className="rounded-xl resize-none h-20" />
               </div>

               <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Preço Original (R$)</Label>
                     <Input type="number" step="0.01" value={itemForm.valor} onChange={e => setItemForm({...itemForm, valor: e.target.value})} required className="rounded-xl h-11 font-black" />
                  </div>
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Porção (ex: 300g)</Label>
                     <Input value={itemForm.porcao} onChange={e => setItemForm({...itemForm, porcao: e.target.value})} placeholder="300g, 500ml..." className="rounded-xl h-11" />
                  </div>
               </div>

               <Separator className="border-dashed" />

               <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-muted/20 rounded-2xl border border-dashed">
                     <div className="flex items-center gap-3">
                        <div className="p-2 bg-white rounded-lg"><AlertTriangle className="w-4 h-4 text-orange-500" /></div>
                        <p className="text-[10px] font-black uppercase italic">Possui Alergenicos?</p>
                     </div>
                     <Switch checked={itemForm.temAlergenicos} onCheckedChange={v => setItemForm({...itemForm, temAlergenicos: v})} />
                  </div>
                  {itemForm.temAlergenicos && (
                    <div className="flex flex-wrap gap-2 animate-in slide-in-from-top-2">
                       {ALLERGENS_OPTIONS.map(opt => (
                         <Badge 
                           key={opt} 
                           onClick={() => handleToggleAlergenico(opt)}
                           className={cn("cursor-pointer h-7 px-3 font-black uppercase text-[8px] transition-all", itemForm.alergenicos.includes(opt) ? "bg-red-500 text-white" : "bg-muted text-muted-foreground")}
                         >
                           {opt}
                         </Badge>
                       ))}
                    </div>
                  )}
               </div>

               <Separator className="border-dashed" />

               <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-secondary/5 rounded-2xl border border-secondary/20">
                     <div className="flex items-center gap-3">
                        <div className="p-2 bg-white rounded-lg shadow-sm"><Zap className="w-4 h-4 text-secondary" /></div>
                        <p className="text-[10px] font-black uppercase italic text-secondary">Preço Promocional?</p>
                     </div>
                     <Switch checked={itemForm.promocional} onCheckedChange={v => setItemForm({...itemForm, promocional: v})} />
                  </div>
                  {itemForm.promocional && (
                    <div className="space-y-6 animate-in slide-in-from-top-2">
                       <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-secondary">Novo Valor de Oferta (R$)</Label>
                          <Input type="number" step="0.01" value={itemForm.valorPromocional} onChange={e => setItemForm({...itemForm, valorPromocional: e.target.value})} className="rounded-xl h-11 border-secondary/30 font-black text-secondary" />
                       </div>
                       <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Inicia em</Label><Input type="datetime-local" value={itemForm.promoInicio} onChange={e => setItemForm({...itemForm, promoInicio: e.target.value})} className="rounded-xl h-11 text-xs" /></div>
                          <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Encerra em</Label><Input type="datetime-local" value={itemForm.promoFim} onChange={e => setItemForm({...itemForm, promoFim: e.target.value})} className="rounded-xl h-11 text-xs" /></div>
                       </div>
                    </div>
                  )}
               </div>
            </form>
            <div className="p-8 bg-muted/10 border-t">
               <Button onClick={handleSaveItem} disabled={isSubmitting} className="w-full h-14 bg-secondary text-white font-black rounded-2xl shadow-xl uppercase italic text-lg">
                  {isSubmitting ? <Loader2 className="animate-spin" /> : editingItem ? "Salvar Alterações" : "Adicionar ao Menu"}
               </Button>
            </div>
         </DialogContent>
      </Dialog>
    </div>
  );
}
