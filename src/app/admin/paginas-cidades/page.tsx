'use client';

import * as React from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Map, 
  Loader2, 
  Search, 
  RefreshCw, 
  Image as ImageIcon, 
  Trash2, 
  Globe, 
  ExternalLink,
  Zap,
  CheckCircle2,
  Inbox,
  Info,
  Sparkles,
  Edit,
  Save,
  Link as LinkIcon
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { toast } from '@/hooks/use-toast';
import Link from 'next/link';
import { forceGenerateCityCoverAction, updateCityPageAction } from '@/app/actions/city-pages';

export default function AdminCityPagesManager() {
  const db = useFirestore();
  const [search, setSearch] = React.useState("");
  const [isGenerating, setIsGenerating] = React.useState<string | null>(null);
  
  // Estado para Edição Manual
  const [editingCity, setEditingCity] = React.useState<any>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  const cityPagesQuery = useMemoFirebase(() => 
    db ? query(collection(db, "cityPages"), orderBy("city", "asc")) : null, 
    [db]
  );
  const { data: cityPages, loading } = useCollection<any>(cityPagesQuery);

  const filtered = React.useMemo(() => {
    if (!cityPages) return [];
    return cityPages.filter(p => 
      p.city?.toLowerCase().includes(search.toLowerCase()) ||
      p.slug?.toLowerCase().includes(search.toLowerCase())
    );
  }, [cityPages, search]);

  const handleForceGenerate = async (city: any) => {
    setIsGenerating(city.id);
    try {
      const result = await forceGenerateCityCoverAction(city);
      if (result.success) {
        toast({ title: "Capa da cidade gerada!", description: `Nova imagem obtida para ${city.city}.` });
      } else {
        throw new Error(result.error);
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Falha na Geração", description: e.message });
    } finally {
      setIsGenerating(null);
    }
  };

  const handleSaveManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCity || isSaving) return;

    setIsSaving(true);
    try {
      const res = await updateCityPageAction(editingCity.slug || editingCity.id, {
        city: editingCity.city,
        coverImage: editingCity.coverImage,
        cityCoverUrl: editingCity.coverImage
      });

      if (res.success) {
        toast({ title: "Cidade atualizada!" });
        setEditingCity(null);
      } else throw new Error(res.error);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao salvar", description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePage = async (id: string) => {
    if (!confirm("Remover os metadados desta página? A imagem no Storage não será apagada.")) return;
    try {
      await deleteDoc(doc(db!, "cityPages", id));
      toast({ title: "Metadados removidos." });
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao remover" });
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black italic uppercase tracking-tighter text-primary flex items-center gap-3">
            <Map className="w-8 h-8 text-secondary" /> Capas de Cidades
          </h1>
          <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest">Identidade Visual para Landing Pages Regionais</p>
        </div>
      </div>

      <div className="p-6 bg-secondary/5 rounded-[2rem] border-2 border-dashed border-secondary/20 flex items-start gap-4">
         <Sparkles className="w-6 h-6 text-secondary shrink-0 mt-1" />
         <div className="space-y-1">
            <h4 className="font-black uppercase text-xs italic text-primary">Inteligência de Divulgação Regional</h4>
            <p className="text-[10px] text-muted-foreground font-bold uppercase leading-relaxed">
               As capas representam o ecossistema cultural de toda a região. Adicionamos desambiguação por Estado e Seed aleatório para garantir imagens únicas.
            </p>
         </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Filtrar cidades..." 
          value={search} 
          onChange={e => setSearch(e.target.value)} 
          className="pl-10 h-12 rounded-xl" 
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-20 flex justify-center"><Loader2 className="animate-spin text-secondary" /></div>
        ) : filtered.length > 0 ? (
          filtered.map(city => (
            <Card key={city.id} className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white group border-b-4 border-transparent hover:border-secondary transition-all">
               <div className="relative h-40 bg-muted">
                  {city.coverImage ? (
                    <img src={city.coverImage} className="w-full h-full object-cover transition-transform group-hover:scale-105" alt="" />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full opacity-20 bg-muted/50">
                       <ImageIcon className="w-10 h-10 mb-1" />
                       <p className="text-[8px] font-black uppercase">Sem Imagem</p>
                    </div>
                  )}
                  <div className="absolute top-3 left-3">
                     <Badge className="bg-white/90 text-primary border-none shadow-sm text-[8px] font-black uppercase">{city.state}</Badge>
                  </div>
               </div>
               <CardContent className="p-6 space-y-6">
                  <div className="space-y-1">
                     <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary truncate">{city.city}</h3>
                     <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest truncate">{city.slug}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2">
                     <Button 
                       variant="outline" 
                       size="sm" 
                       className="rounded-xl h-10 font-black uppercase text-[9px] gap-2 border-secondary text-secondary"
                       onClick={() => handleForceGenerate(city)}
                       disabled={isGenerating === city.id}
                     >
                        {isGenerating === city.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                        Regerar Auto
                     </Button>
                     <Button 
                        variant="secondary" 
                        size="sm" 
                        className="rounded-xl h-10 font-black uppercase text-[9px] gap-2"
                        onClick={() => setEditingCity(city)}
                     >
                        <Edit className="w-3 h-3" /> Editar Manual
                     </Button>
                  </div>
                  
                  <div className="flex items-center justify-between pt-4 border-t border-dashed">
                     <Button variant="ghost" size="sm" asChild className="h-6 px-2 font-black uppercase text-[8px] gap-1.5 opacity-40 hover:opacity-100">
                        <Link href={`/o-que-fazer-em/${city.slug}`} target="_blank">
                           <ExternalLink className="w-2.5 h-2.5" /> Ver Página
                        </Link>
                     </Button>
                     <button onClick={() => handleDeletePage(city.id)} className="text-destructive opacity-20 hover:opacity-100 transition-opacity">
                        <Trash2 className="w-3.5 h-3.5" />
                     </button>
                  </div>
               </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-full py-32 text-center bg-white rounded-[3rem] border-2 border-dashed opacity-20 flex flex-col items-center gap-4">
             <Inbox className="w-12 h-12" />
             <p className="text-xs font-black uppercase tracking-[0.3em]">Nenhuma cidade encontrada</p>
          </div>
        )}
      </div>

      {/* DIALOG DE EDIÇÃO MANUAL */}
      <Dialog open={!!editingCity} onOpenChange={(v) => !v && setEditingCity(null)}>
         <DialogContent className="max-w-md rounded-[2.5rem]">
            <form onSubmit={handleSaveManual} className="space-y-6">
               <DialogHeader>
                  <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-primary">Editar Cidade</DialogTitle>
                  <DialogDescription className="text-xs font-bold uppercase opacity-60">Troca manual de imagem e metadados.</DialogDescription>
               </DialogHeader>

               <div className="space-y-4">
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase opacity-60">Nome da Cidade</Label>
                     <Input 
                       value={editingCity?.city || ""} 
                       onChange={e => setEditingCity({...editingCity, city: e.target.value})}
                       className="rounded-xl h-11"
                     />
                  </div>
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase opacity-60">URL da Imagem de Capa</Label>
                     <div className="relative">
                        <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30 text-secondary" />
                        <Input 
                           value={editingCity?.coverImage || ""} 
                           onChange={e => setEditingCity({...editingCity, coverImage: e.target.value})}
                           className="rounded-xl h-11 pl-10 text-xs font-mono"
                           placeholder="https://..."
                        />
                     </div>
                  </div>
                  {editingCity?.coverImage && (
                    <div className="relative aspect-video rounded-2xl overflow-hidden border shadow-inner bg-muted">
                       <img src={editingCity.coverImage} className="w-full h-full object-cover" alt="Preview" />
                    </div>
                  )}
               </div>

               <DialogFooter>
                  <Button type="submit" disabled={isSaving} className="w-full bg-secondary text-white font-black h-14 rounded-2xl shadow-xl uppercase italic">
                     {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                     Salvar Alterações
                  </Button>
               </DialogFooter>
            </form>
         </DialogContent>
      </Dialog>
    </div>
  );
}
