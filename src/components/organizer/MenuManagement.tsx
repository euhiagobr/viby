
'use client';

import * as React from 'react';
import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { Card } from '@/components/ui/card';
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
  ArrowUp, 
  ArrowDown,
  Utensils, 
  Edit,
  Save,
  LayoutGrid,
  List,
  Image as ImageIcon,
  Star,
} from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
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
import { 
  RadioGroup, 
  RadioGroupItem 
} from "@/components/ui/radio-group";
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { 
  createMenuSectionAction, 
  deleteMenuSectionAction,
  createMenuItemAction,
  updateMenuItemAction,
  deleteMenuItemAction, 
  updateOrganizationMenuLayoutAction,
  reorderItemsAction
} from '@/app/actions/menu';
import { uploadImageAction } from '@/app/actions/storage';
import Image from 'next/image';

const ALLERGENS_OPTIONS = ["Glúten", "Lactose", "Ovos", "Peixes", "Amendoim", "Soja", "Frutos do Mar", "Castanhas"];
const SERVES_OPTIONS = Array.from({ length: 10 }, (_, i) => `${i + 1} pessoa${i > 0 ? 's' : ''}`);

const initialItemFormState = {
  nome: "",
  descricao: "",
  sectionId: "",
  valor: "",
  priceDisplayMode: "value",
  imageUrl: "",
  featured: false,
  porcao: "",
  serves: "",
  temAlergenicos: false,
  alergenicos: [] as string[],
  promocional: false,
  valorPromocional: "",
  promoInicio: "",
  promoFim: "",
  ordem: 0
};

const ImageUploader = ({ imageUrl, onImageUrlChange, orgId, itemId }: {
  imageUrl: string | null;
  onImageUrlChange: (url: string) => void;
  orgId: string;
  itemId?: string;
}) => {
  const [uploading, setUploading] = React.useState(false);
  const [preview, setPreview] = React.useState<string | null>(imageUrl);

  const [isResultDialogOpen, setIsResultDialogOpen] = React.useState(false);
  const [resultDialogContent, setResultDialogContent] = React.useState<{ title: string; description: string; } | null>(null);
  
  const handleFileChangeAndUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(selectedFile);

    setUploading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);

    const result = await uploadImageAction(formData, `menu_items/${orgId}`, itemId || 'new_item');
    
    setUploading(false);
    
    if (result.success && result.publicUrl) {
      onImageUrlChange(result.publicUrl);
      setResultDialogContent({ 
        title: "Upload Concluído", 
        description: "Sua imagem foi enviada e já está vinculada a este item.", 
      });
    } else {
      setResultDialogContent({ 
        title: "Erro no Upload", 
        description: result.error || "Não foi possível enviar a imagem. Tente novamente.",
      });
    }
    setIsResultDialogOpen(true);
    
    e.target.value = '';
  };

  React.useEffect(() => {
    setPreview(imageUrl);
  }, [imageUrl]);

  return (
    <div className="space-y-2">
      <Label>Imagem do Item</Label>
      <div className="w-full aspect-square rounded-lg border-2 border-dashed flex items-center justify-center text-gray-400 overflow-hidden relative bg-gray-50">
        {preview ? (
            <Image src={preview} alt="Preview do item" layout="fill" objectFit="cover" />
        ) : (
            <ImageIcon className="w-10 h-10" />
        )}
        {uploading && (
          <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center z-10 backdrop-blur-sm">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="mt-2 text-sm font-medium text-gray-600">Enviando...</p>
          </div>
        )}
      </div>
      
      <Input 
        type="file" 
        onChange={handleFileChangeAndUpload} 
        className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
        accept="image/png, image/jpeg, image/webp"
        disabled={uploading}
      />
      
      <p className="text-xs text-gray-500">O upload iniciará automaticamente após selecionar uma imagem.</p>

      <Dialog open={isResultDialogOpen} onOpenChange={setIsResultDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{resultDialogContent?.title}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>{resultDialogContent?.description}</p>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsResultDialogOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export function MenuManagement({ orgId }: MenuManagementProps) {
  const db = useFirestore();

  const { data: orgData } = useDoc<any>(useMemoFirebase(() => db ? doc(db, 'organizations', orgId) : null, [db, orgId]));
  const { data: sections, loading: loadingSections } = useCollection<any>(useMemoFirebase(() => db ? query(collection(db, 'organizations', orgId, 'menu_sections'), orderBy('ordem', 'asc')) : null, [db, orgId]));
  const { data: items, loading: loadingItems } = useCollection<any>(useMemoFirebase(() => db ? query(collection(db, 'organizations', orgId, 'menu_items'), orderBy('ordem', 'asc')) : null, [db, orgId]));

  const [isSectionDialogOpen, setIsSectionDialogOpen] = React.useState(false);
  const [isItemDialogOpen, setIsItemDialogOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState<any>(null);
  const [itemForm, setItemForm] = React.useState<any>(initialItemFormState);

    const resetItemForm = () => { setItemForm(initialItemFormState); setEditingItem(null); };

  const handleOpenEdit = (item: any) => {
    // Remove Firestore objects (updatedAt, createdAt) que possuem método toJSON e causam erro de serialização
    const { updatedAt, createdAt, ...cleanItem } = item;
    setItemForm({ ...initialItemFormState, ...cleanItem, valor: item.valor.toString(), valorPromocional: item.valorPromocional?.toString() || "" });
    setEditingItem(item);
    setIsItemDialogOpen(true);
  };

  const handleCreateSection = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const res = await createMenuSectionAction(orgId, { nome: formData.get('nome') as string, ordem: (sections?.length || 0) + 1 });
    if (res.success) { toast({ title: "Agrupamento criado!" }); setIsSectionDialogOpen(false); }
    setIsSubmitting(false);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemForm.sectionId) { toast({ variant: "destructive", title: "Selecione um agrupamento" }); return; }
    if (!itemForm.valor) { toast({ variant: "destructive", title: "O campo 'Valor' é obrigatório" }); return; }
    
    setIsSubmitting(true);
    try {
      const payload = { ...itemForm, valor: parseFloat(itemForm.valor), valorPromocional: itemForm.promocional ? parseFloat(itemForm.valorPromocional) : null, ordem: editingItem ? itemForm.ordem : (items?.filter(i => i.sectionId === itemForm.sectionId).length || 0) + 1 };
      const res = editingItem ? await updateMenuItemAction(orgId, editingItem.id, payload) : await createMenuItemAction(orgId, payload);
      if (res.success) { toast({ title: editingItem ? "Item atualizado!" : "Item adicionado!" }); setIsItemDialogOpen(false); resetItemForm(); }
    } finally { setIsSubmitting(false); }
  };

  const handleToggleAlergenico = (tag: string) => setItemForm((prev: any) => ({ ...prev, alergenicos: prev.alergenicos.includes(tag) ? prev.alergenicos.filter((t: string) => t !== tag) : [...prev.alergenicos, tag] }));

  const handleOrderChange = async (collectionName: 'menu_sections' | 'menu_items', docId: string, direction: 'up' | 'down') => {
    const list = collectionName === 'menu_sections' ? sections : items;
    if (!list) return;
    const currentIndex = list.findIndex(item => item.id === docId);
    if (currentIndex === -1) return;
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= list.length) return;
    const [itemA, itemB] = [list[currentIndex], list[targetIndex]];
    setIsSubmitting(true);
    await reorderItemsAction(orgId, collectionName, itemA.id, itemB.ordem, itemB.id, itemA.ordem);
    setIsSubmitting(false);
    toast({ title: 'Ordem atualizada!' });
  };

  const handleLayoutChange = async (layout: 'lista' | 'grid') => { await updateOrganizationMenuLayoutAction(orgId, layout); toast({ title: `Layout atualizado.` }); };

  if (loadingSections || loadingItems) return <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-secondary" /></div>;

  return (
    <div className="space-y-8">
       <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
         <div>
            <h2 className="text-2xl font-semibold">Gestão de Cardápio</h2>
            <p className="text-sm text-gray-500">Organize seus produtos e o visual do seu cardápio.</p>
         </div>
         <div className="flex items-center gap-2">
            <div className='flex items-center gap-1 p-1 bg-gray-100 rounded-lg'>
              <Button variant={orgData?.menuLayout === 'lista' || !orgData?.menuLayout ? 'secondary' : 'ghost'} size='sm' onClick={() => handleLayoutChange('lista')}><List className='w-4 h-4 mr-2'/>Lista</Button>
              <Button variant={orgData?.menuLayout === 'grid' ? 'secondary' : 'ghost'} size='sm' onClick={() => handleLayoutChange('grid')}><LayoutGrid className='w-4 h-4 mr-2'/>Grid</Button>
            </div>
            <Separator orientation="vertical" className="h-6 mx-2"/>
            <Dialog open={isSectionDialogOpen} onOpenChange={setIsSectionDialogOpen}>
               <DialogTrigger asChild>
                  <Button variant="outline"><Plus className="w-4 h-4 mr-2" /> Agrupamento</Button>
               </DialogTrigger>
               <DialogContent className="max-w-md"><form onSubmit={handleCreateSection}><DialogHeader><DialogTitle>Novo Agrupamento</DialogTitle></DialogHeader><Input name="nome" required placeholder="Ex: Entradas, Bebidas..." className="my-4" /><DialogFooter><Button type="submit" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin" /> : "Criar"}</Button></DialogFooter></form></DialogContent>
            </Dialog>
            <Button onClick={() => { resetItemForm(); setIsItemDialogOpen(true); }}><Plus className="w-4 h-4 mr-2" /> Novo Item</Button>
         </div>
      </div>

      <Dialog open={isItemDialogOpen} onOpenChange={(v) => { if(!v) resetItemForm(); setIsItemDialogOpen(v); }}>
        <DialogContent className="max-w-3xl h-[90vh] p-0 flex flex-col">
          <DialogHeader className="p-6 border-b"><DialogTitle className="text-xl">{editingItem ? 'Editar Item' : 'Novo Item'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveItem} className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-6">
                 <div className="space-y-2">
                    <Label>Agrupamento</Label>
                    <Select value={itemForm.sectionId} onValueChange={v => setItemForm({...itemForm, sectionId: v})}>
                       <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                       <SelectContent>{sections?.map((s:any) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>) ?? <SelectItem value="none" disabled>Crie um agrupamento</SelectItem>}</SelectContent>
                    </Select>
                 </div>
                 <div className="space-y-2">
                    <Label>Nome do Item</Label>
                    <Input value={itemForm.nome} onChange={e => setItemForm({...itemForm, nome: e.target.value})} required placeholder="Ex: Burger Clássico" />
                 </div>
                 <div className="space-y-2">
                    <Label>Descrição</Label>
                    <Textarea value={itemForm.descricao} onChange={e => setItemForm({...itemForm, descricao: e.target.value})} required placeholder="Descreva os ingredientes..." />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <Label>Serve (Rendimento)</Label>
                       <Select value={itemForm.serves || 'none'} onValueChange={v => setItemForm({...itemForm, serves: v === 'none' ? '' : v})}>
                          <SelectTrigger><SelectValue placeholder="Não informar" /></SelectTrigger>
                          <SelectContent><SelectItem value="none">Não informar</SelectItem>{SERVES_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}<SelectItem value="Mais de 10 pessoas">Mais de 10 pessoas</SelectItem></SelectContent>
                       </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Porção (Opcional)</Label>
                        <Input value={itemForm.porcao} onChange={e => setItemForm({...itemForm, porcao: e.target.value})} placeholder="Ex: 300g, 500ml" />
                     </div>
                 </div>
              </div>
              <div className="md:col-span-1 space-y-6">
                <ImageUploader 
                  orgId={orgId} 
                  itemId={editingItem?.id} 
                  imageUrl={itemForm.imageUrl} 
                  onImageUrlChange={(url) => setItemForm({...itemForm, imageUrl: url})} 
                />
                <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg border">
                  <Switch id="featured" checked={itemForm.featured} onCheckedChange={v => setItemForm({...itemForm, featured: v})} />
                  <Label htmlFor="featured" className="flex items-center gap-2"><Star className="w-4 h-4 text-yellow-500"/> Destaque da casa</Label>
                </div>
              </div>
            </div>
            <Separator/>
             <div className="space-y-4">
                  <Label>Preço</Label>
                  <div className="p-4 border rounded-lg space-y-4">
                     <RadioGroup value={itemForm.priceDisplayMode} onValueChange={(v) => setItemForm({...itemForm, priceDisplayMode: v})} className="grid grid-cols-3 gap-4">
                        <div><RadioGroupItem value="value" id="value" className="peer sr-only" /><Label htmlFor="value" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary">Mostrar Valor</Label></div>
                        <div><RadioGroupItem value="consult" id="consult" className="peer sr-only" /><Label htmlFor="consult" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary">Sob Consulta</Label></div>
                        <div><RadioGroupItem value="hidden" id="hidden" className="peer sr-only" /><Label htmlFor="hidden" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary">Apenas Faixa</Label></div>
                     </RadioGroup>
                     <div className="max-w-xs space-y-2">
                        <Label>Valor (R$)</Label>
                        <Input type="number" step="0.01" value={itemForm.valor} onChange={e => setItemForm({...itemForm, valor: e.target.value})} required placeholder='29.90' />
                        <p className="text-xs text-gray-500">O valor é obrigatório para estatísticas, mesmo que não seja exibido.</p>
                     </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-4">
                        <div className="flex items-center space-x-2">
                            <Switch id="tem-alergenicos" checked={itemForm.temAlergenicos} onCheckedChange={v => setItemForm({...itemForm, temAlergenicos: v, alergenicos: []})} />
                            <Label htmlFor="tem-alergenicos">Contém alergênicos?</Label>
                         </div>
                      {itemForm.temAlergenicos && (
                        <div className="p-2 border rounded-md flex flex-wrap gap-2">
                           {ALLERGENS_OPTIONS.map(opt => <Badge key={opt} onClick={() => handleToggleAlergenico(opt)} variant={itemForm.alergenicos.includes(opt) ? 'default' : 'outline'} className='cursor-pointer'>{opt}</Badge>)}
                        </div>
                      )}
                   </div>
                   <div className="space-y-4">
                        <div className="flex items-center space-x-2">
                            <Switch id="promocional" checked={itemForm.promocional} onCheckedChange={v => setItemForm({...itemForm, promocional: v})} />
                            <Label htmlFor="promocional" className='text-green-600'>Ativar valor promocional?</Label>
                         </div>
                      {itemForm.promocional && (
                        <div className="space-y-4 p-4 bg-green-50/50 rounded-lg border border-green-200">
                           <div className="space-y-2">
                              <Label className='text-green-700'>Valor Promocional (R$)</Label>
                              <Input type="number" step="0.01" value={itemForm.valorPromocional} onChange={e => setItemForm({...itemForm, valorPromocional: e.target.value})} required className="border-green-300" />
                           </div>
                        </div>
                      )}
                   </div>
                </div>
          </form>
          <DialogFooter className="p-4 border-t">
            <Button variant='outline' onClick={() => setIsItemDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveItem} disabled={isSubmitting || !itemForm.sectionId}>{isSubmitting ? <Loader2 className="animate-spin mr-2"/> : <Save className="w-4 h-4 mr-2" />} {editingItem ? "Salvar Alterações" : "Adicionar Item"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
       {sections.length === 0 ? (
        <div className="py-20 text-center border-2 border-dashed rounded-lg">
           <Utensils className="w-12 h-12 mx-auto text-gray-400" />
           <h3 className="mt-2 text-lg font-medium">O cardápio está vazio</h3>
           <p className="mt-1 text-sm text-gray-500">Comece criando um agrupamento e adicionando itens.</p>
        </div>
      ) : (
        <div className="space-y-6">
           {sections.map((section, sectionIndex) => {
             const sectionItems = items?.filter((i:any) => i.sectionId === section.id).sort((a,b) => a.ordem - b.ordem) || [];
             return (
               <section key={section.id}>
                  <div className="flex items-center justify-between mb-4">
                     <div className="flex items-center gap-1">
                       <Button variant="ghost" size="icon" disabled={isSubmitting || sectionIndex === 0} onClick={() => handleOrderChange('menu_sections', section.id, 'up')}><ArrowUp className="w-4 h-4" /></Button>
                       <Button variant="ghost" size="icon" disabled={isSubmitting || sectionIndex === sections.length - 1} onClick={() => handleOrderChange('menu_sections', section.id, 'down')}><ArrowDown className="w-4 h-4" /></Button>
                       <h3 className="text-xl font-semibold">{section.nome}</h3>
                     </div>
                     <div className='flex items-center gap-2'>
                        <Badge variant="secondary">{sectionItems.length} itens</Badge>
                        <Button variant="ghost" size="icon" className="text-destructive/50 hover:text-destructive" onClick={() => { if(confirm("Deseja excluir este agrupamento? Os itens não serão afetados.")) deleteMenuSectionAction(orgId, section.id) }}><Trash2 className="w-4 h-4" /></Button>
                     </div>
                  </div>

                  <div className="space-y-2 border-l-2 pl-4 ml-5">
                     {sectionItems.map((item: any) => (
                       <Card key={item.id} className="p-2 flex items-center justify-between group">
                          <div className='flex items-center gap-3'>
                            <div className="flex flex-col">
                              <button disabled={isSubmitting} onClick={() => handleOrderChange('menu_items', item.id, 'up')}><ArrowUp className="w-4 h-4 text-gray-300 hover:text-gray-600" /></button>
                              <button disabled={isSubmitting} onClick={() => handleOrderChange('menu_items', item.id, 'down')}><ArrowDown className="w-4 h-4 text-gray-300 hover:text-gray-600" /></button>
                            </div>
                            <div>
                               <h4 className="font-semibold">{item.nome}</h4>
                               <p className="text-sm text-gray-500">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valor)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                             <Button variant="outline" size="sm" onClick={() => handleOpenEdit(item)}><Edit className="w-3.5 h-3.5 mr-2"/>Editar</Button>
                             <Button variant="ghost" size="icon" className="text-destructive/50 hover:text-destructive" onClick={() => { if(confirm("Remover este item do cardápio?")) deleteMenuItemAction(orgId, item.id) }}><Trash2 className="w-4 h-4" /></Button>
                          </div>
                       </Card>
                     ))}
                     <button 
                       onClick={() => { resetItemForm(); setItemForm(prev => ({...prev, sectionId: section.id})); setIsItemDialogOpen(true); }}
                       className="w-full text-left p-3 flex items-center gap-2 text-sm text-gray-500 hover:bg-gray-50 rounded-md"
                     >
                        <Plus className="w-4 h-4" />
                        Adicionar item neste agrupamento
                     </button>
                  </div>
               </section>
             );
           })}
        </div>
      )}
    </div>
  );
}
