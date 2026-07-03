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
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { cn } from "@/lib/utils";
import { 
  createMenuSectionAction, 
  createMenuItemAction,
  updateMenuItemAction,
  deleteMenuSectionAction,
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
  const [editingItem, setEditingItem] = React.useState<any>(null);

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

  const resetItemForm = () => {
    setItemForm({
      nome: "", descricao: "", sectionId: "", valor: "", porcao: "",
      temAlergenicos: false, alergenicos: [],
      promocional: false, valorPromocional: "", promoInicio: "", promoFim: ""
    });
    setEditingItem(null);
  };

  const handleOpenEdit = (item: any) => {
    setItemForm({
      ...item,
      valor: item.valor.toString(),
      valorPromocional: item.valorPromocional?.toString() || ""
    });
    setEditingItem(item);
    setIsItemDialogOpen(true);
  };

  const handleCreateSection = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    try {
      const res = await createMenuSectionAction(orgId, {
        nome: formData.get('nome') as string,
        ordem: (sections?.length || 0) + 1
      });
      if (res.success) {
        toast({ title: "Agrupamento criado!" });
        setIsSectionDialogOpen(false);
      }
    } catch (e) { 
      toast({ variant: "destructive", title: "Erro ao criar agrupamento" }); 
    } finally { 
      setIsSubmitting(false); 
    }
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemForm.sectionId) {
      toast({ variant: "destructive", title: "Erro", description: "Selecione um agrupamento para este item." });
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
        toast({ title: editingItem ? "Item atualizado!" : "Item adicionado ao cardápio!" });
        setIsItemDialogOpen(false);
        resetItemForm();
      }
    } catch (e) { 
      toast({ variant: "destructive", title: "Erro ao salvar item" }); 
    } finally { 
      setIsSubmitting(false); 
    }
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
      {/* HEADER DE AÇÕES */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
         <div className="space-y-1">
            <h2 className="text-2xl font-black uppercase italic tracking-tighter text-primary">Gestão de Cardápio</h2>
            <p className="text-xs font-bold text-muted-foreground uppercase">Organize seus produtos e ofertas nativas.</p>
         </div>
         <div className="flex gap-2">
            <Dialog open={isSectionDialogOpen} onOpenChange={setIsSectionDialogOpen}>
               <DialogTrigger asChild>
                  <Button variant="outline" className="rounded-xl h-11 px-6 font-bold uppercase text-[10px] border-secondary text-secondary">
                     <Plus className="w-4 h-4 mr-2" /> Novo Agrupamento
                  </Button>
               </DialogTrigger>
               <DialogContent className="max-w-sm rounded-[2rem]">
                  <form onSubmit={handleCreateSection} className="space-y-6">
                     <DialogHeader>
                        <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">Novo Agrupamento</DialogTitle>
                        <DialogDescription className="font-bold text-secondary text-[10px] uppercase">Crie uma nova seção para o seu menu.</DialogDescription>
                     </DialogHeader>
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Nome (ex: Entradas, Bebidas, Sobremesas)</Label>
                        <Input name="nome" required placeholder="Digite o nome da seção..." className="rounded-xl h-12" />
                     </div>
                     <DialogFooter>
                        <Button type="submit" disabled={isSubmitting} className="w-full bg-secondary text-white font-black h-12 rounded-xl uppercase italic shadow-lg">
                           {isSubmitting ? <Loader2 className="animate-spin" /> : "Criar Agrupamento"}
                        </Button>
                     </DialogFooter>
                  </form>
               </DialogContent>
            </Dialog>

            <Button 
              onClick={() => { resetItemForm(); setIsItemDialogOpen(true); }}
              className="bg-primary text-white font-black rounded-full px-8 h-11 shadow-lg gap-2 uppercase italic hover:scale-105 transition-transform"
            >
               <Plus className="w-5 h-5" /> Novo Item
            </Button>
         </div>
      </div>

      {/* MODAL DE ITEM (CRIAÇÃO E EDIÇÃO) */}
      <Dialog open={isItemDialogOpen} onOpenChange={(v) => { if(!v) resetItemForm(); setIsItemDialogOpen(v); }}>
         <DialogContent className="max-w-2xl h-[90vh] p-0 overflow-hidden rounded-[2.5rem] flex flex-col">
            <DialogHeader className="p-8 border-b bg-muted/30">
               <div className="flex items-center gap-3">
                  <div className="p-2 bg-secondary/10 rounded-lg text-secondary"><ShoppingBag className="w-6 h-6" /></div>
                  <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-primary">
                    {editingItem ? 'Editar Produto' : 'Cadastrar Produto'}
                  </DialogTitle>
               </div>
               <DialogDescription className="font-bold text-secondary text-[10px] uppercase">Preencha os detalhes do item no cardápio.</DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSaveItem} className="flex-1 overflow-y-auto p-8 space-y-8">
               {/* 1. SELEÇÃO DE AGRUPAMENTO (OBRIGATÓRIO PRIMEIRO) */}
               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-secondary ml-1">Vincular ao Agrupamento</Label>
                  <Select value={itemForm.sectionId} onValueChange={v => setItemForm({...itemForm, sectionId: v})}>
                     <SelectTrigger className="rounded-xl h-12 font-bold border-secondary/30">
                        <SelectValue placeholder="Selecione onde este item será exibido..." />
                     </SelectTrigger>
                     <SelectContent className="rounded-xl shadow-2xl">
                        {sections && sections.length > 0 ? (
                           sections.map((s:any) => <SelectItem key={s.id} value={s.id} className="font-bold uppercase text-xs">{s.nome}</SelectItem>)
                        ) : (
                           <SelectItem value="none" disabled>Crie um agrupamento primeiro</SelectItem>
                        )}
                     </SelectContent>
                  </Select>
               </div>

               <Separator className="border-dashed" />

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Nome do Item</Label>
                     <Input value={itemForm.nome} onChange={e => setItemForm({...itemForm, nome: e.target.value})} required placeholder="Ex: Burger Clássico" className="rounded-xl h-11" />
                  </div>
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Porção (ex: 300g, 500ml)</Label>
                     <Input value={itemForm.porcao} onChange={e => setItemForm({...itemForm, porcao: e.target.value})} placeholder="Informa o peso ou medida..." className="rounded-xl h-11" />
                  </div>
               </div>

               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Descrição Longa</Label>
                  <Textarea value={itemForm.descricao} onChange={e => setItemForm({...itemForm, descricao: e.target.value})} required placeholder="Descreva os ingredientes e diferenciais..." className="rounded-xl resize-none h-24" />
               </div>

               <div className="max-w-[200px] space-y-2">
                  <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Valor Unitário (R$)</Label>
                  <div className="relative">
                     <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-secondary">R$</span>
                     <Input type="number" step="0.01" value={itemForm.valor} onChange={e => setItemForm({...itemForm, valor: e.target.value})} required className="rounded-xl h-12 pl-10 font-black text-lg border-secondary/20" />
                  </div>
               </div>

               <Separator className="border-dashed" />

               {/* ALERGENICOS */}
               <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-muted/20 rounded-2xl border border-dashed">
                     <div className="flex items-center gap-3">
                        <div className="p-2 bg-white rounded-lg"><AlertTriangle className="w-4 h-4 text-orange-500" /></div>
                        <div>
                           <p className="text-[10px] font-black uppercase italic">Possui Alergênicos?</p>
                           <p className="text-[8px] font-bold text-muted-foreground uppercase leading-none">Sinalize restrições alimentares importantes.</p>
                        </div>
                     </div>
                     <Switch checked={itemForm.temAlergenicos} onCheckedChange={v => setItemForm({...itemForm, temAlergenicos: v})} />
                  </div>
                  {itemForm.temAlergenicos && (
                    <div className="flex flex-wrap gap-2 animate-in slide-in-from-top-2">
                       {ALLERGENS_OPTIONS.map(opt => (
                         <Badge 
                           key={opt} 
                           onClick={() => handleToggleAlergenico(opt)}
                           className={cn(
                             "cursor-pointer h-7 px-3 font-black uppercase text-[8px] transition-all", 
                             itemForm.alergenicos.includes(opt) ? "bg-red-50 text-white" : "bg-muted text-muted-foreground hover:bg-red-100"
                           )}
                         >
                           {opt}
                         </Badge>
                       ))}
                    </div>
                  )}
               </div>

               {/* PROMOCIONAL */}
               <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-secondary/5 rounded-2xl border border-secondary/20">
                     <div className="flex items-center gap-3">
                        <div className="p-2 bg-white rounded-lg shadow-sm text-secondary"><Zap className="w-4 h-4" /></div>
                        <div>
                           <p className="text-[10px] font-black uppercase italic text-secondary">Ativar Oferta Especial?</p>
                           <p className="text-[8px] font-bold text-muted-foreground uppercase leading-none">O preço original será riscado no perfil.</p>
                        </div>
                     </div>
                     <Switch checked={itemForm.promocional} onCheckedChange={v => setItemForm({...itemForm, promocional: v})} />
                  </div>
                  {itemForm.promocional && (
                    <div className="space-y-6 animate-in slide-in-from-top-2 p-6 bg-secondary/5 rounded-3xl border border-dashed border-secondary/20">
                       <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-secondary">Novo Valor de Venda (R$)</Label>
                          <div className="relative">
                             <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-secondary">R$</span>
                             <Input type="number" step="0.01" value={itemForm.valorPromocional} onChange={e => setItemForm({...itemForm, valorPromocional: e.target.value})} className="rounded-xl h-11 border-secondary/30 font-black text-secondary pl-10" />
                          </div>
                       </div>
                       <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2"><Label className="text-[9px] font-black uppercase opacity-60">Inicia em</Label><Input type="datetime-local" value={itemForm.promoInicio} onChange={e => setItemForm({...itemForm, promoInicio: e.target.value})} className="rounded-xl h-11 text-xs" /></div>
                          <div className="space-y-2"><Label className="text-[9px] font-black uppercase opacity-60">Encerra em</Label><Input type="datetime-local" value={itemForm.promoFim} onChange={e => setItemForm({...itemForm, promoFim: e.target.value})} className="rounded-xl h-11 text-xs" /></div>
                       </div>
                    </div>
                  )}
               </div>
            </form>

            <DialogFooter className="p-8 bg-muted/10 border-t">
               <Button onClick={handleSaveItem} disabled={isSubmitting || !itemForm.sectionId} className="w-full bg-secondary text-white font-black h-16 rounded-2xl shadow-xl uppercase italic text-lg hover:scale-[1.01] transition-transform">
                  {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
                  {editingItem ? "Salvar Alterações" : "Adicionar ao Cardápio"}
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>

      {/* VISUALIZAÇÃO E LISTAGEM */}
      {sections.length === 0 ? (
        <div className="py-40 text-center bg-white rounded-[3rem] border-2 border-dashed opacity-30 italic flex flex-col items-center gap-6">
           <Utensils className="w-16 h-16" />
           <div className="space-y-1">
              <p className="text-xl font-black uppercase italic tracking-tighter">O cardápio está vazio</p>
              <p className="text-xs font-bold uppercase">Comece criando um agrupamento como 'Bebidas' ou 'Entradas'.</p>
           </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-12">
           {sections.map(section => (
             <section key={section.id} className="space-y-6">
                <div className="flex items-center justify-between px-4 border-b-2 border-primary/5 pb-4">
                   <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-primary/5 rounded-xl text-primary"><Layers className="w-5 h-5" /></div>
                      <h3 className="text-2xl font-black uppercase italic tracking-tighter text-primary">{section.nome}</h3>
                   </div>
                   <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] font-black uppercase h-6 px-3">{items.filter((i:any) => i.sectionId === section.id).length} itens</Badge>
                      <Button variant="ghost" size="icon" onClick={() => { if(confirm("Deseja excluir este agrupamento? Os itens vinculados serão mantidos sem categoria.")) deleteMenuSectionAction(orgId, section.id) }} className="text-destructive opacity-20 hover:opacity-100"><Trash2 className="w-4 h-4" /></Button>
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                   {items.filter((i:any) => i.sectionId === section.id).map((item: any) => (
                     <Card key={item.id} className="border-none shadow-sm rounded-[2rem] bg-white group hover:shadow-xl transition-all relative overflow-hidden">
                        {item.promocional && <div className="absolute top-0 right-0 p-3"><Zap className="w-4 h-4 text-secondary fill-secondary" /></div>}
                        <CardContent className="p-8 space-y-4">
                           <div className="flex justify-between items-start">
                              <div className="space-y-1">
                                 <h4 className="font-black text-base uppercase italic text-primary leading-none truncate max-w-[180px]">{item.nome}</h4>
                                 <p className="text-[10px] font-bold text-muted-foreground uppercase">{item.porcao || "Porção Individual"}</p>
                              </div>
                              <div className="text-right">
                                 {item.promocional ? (
                                   <div className="flex flex-col items-end">
                                      <span className="text-[10px] line-through opacity-30 font-black text-red-500">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valor)}</span>
                                      <span className="text-base font-black text-secondary italic">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valorPromocional)}</span>
                                   </div>
                                 ) : (
                                   <span className="text-base font-black text-primary italic">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valor)}</span>
                                 )}
                              </div>
                           </div>
                           <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed font-medium min-h-[32px]">{item.descricao}</p>
                           <div className="flex justify-between items-center pt-6 border-t border-dashed border-border/40">
                              <div className="flex flex-wrap gap-1">
                                 {item.alergenicos?.slice(0, 3).map((a: string) => <Badge key={a} variant="outline" className="text-[7px] h-4 font-black uppercase border-red-100 text-red-500 bg-red-50">{a}</Badge>)}
                                 {item.alergenicos?.length > 3 && <span className="text-[7px] font-black opacity-30">+{item.alergenicos.length - 3}</span>}
                              </div>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                 <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/5 rounded-full" onClick={() => handleOpenEdit(item)}><Edit className="w-3.5 h-3.5" /></Button>
                                 <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/5 rounded-full" onClick={() => { if(confirm("Remover item?")) deleteMenuItemAction(orgId, item.id) }}><Trash2 className="w-3.5 h-3.5" /></Button>
                              </div>
                           </div>
                        </CardContent>
                     </Card>
                   ))}
                   <button 
                     onClick={() => { resetItemForm(); setItemForm(prev => ({...prev, sectionId: section.id})); setIsItemDialogOpen(true); }}
                     className="rounded-[2rem] border-2 border-dashed border-border flex flex-col items-center justify-center gap-3 p-8 opacity-40 hover:opacity-100 hover:border-secondary transition-all group"
                   >
                      <Plus className="w-8 h-8 text-secondary group-hover:scale-110 transition-transform" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Adicionar nesta seção</span>
                   </button>
                </div>
             </section>
           ))}
        </div>
      )}
    </div>
  );
}