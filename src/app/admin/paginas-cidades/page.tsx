'use client';

import * as React from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, getDocs, doc, deleteDoc, where, limit } from 'firebase/firestore';
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
  Sparkles
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { generateAndPersistCityCover } from '@/app/actions/city-pages';
import Link from 'next/link';

export default function AdminCityPagesManager() {
  const db = useFirestore();
  const [search, setSearch] = React.useState("");
  const [isGenerating, setIsGenerating] = React.useState<string | null>(null);

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
    console.log('[Admin UI] Botão de geração clicado para:', city.city);
    setIsGenerating(city.id);
    
    try {
      console.log('[Admin UI] Consultando categorias populares...');
      const eventsSnap = await getDocs(query(
        collection(db!, "events"), 
        where("city", "==", city.city),
        limit(10)
      ));
      const categories = Array.from(new Set(eventsSnap.docs.map(d => d.data().categoryName).filter(Boolean)));
      console.log('[Admin UI] Categorias localizadas:', categories);

      console.info('[Admin UI] Chamando Server Action: generateAndPersistCityCover');
      const res = await generateAndPersistCityCover({
        slug: city.slug,
        city: city.city,
        state: city.state,
        country: city.country,
        categories: categories as string[]
      });

      if (!res.success) {
        throw new Error(res.error);
      }

      console.info('[Admin UI] Geração concluída com sucesso!');
      toast({ title: "Capa da cidade gerada!", description: "A imagem foi salva no Storage." });
    } catch (e: any) {
      console.error('[Admin UI] Erro capturado na interface:', e.message);
      toast({ 
        variant: "destructive", 
        title: "Falha na Geração IA", 
        description: e.message || "Erro desconhecido." 
      });
    } finally {
      setIsGenerating(null);
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
               As capas geradas aqui são utilizadas no topo da página de cada cidade. 
               Elas são otimizadas para SEO, representando o ecossistema cultural de toda a região.
            </p>
         </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Filtrar cidades cadastradas..." 
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
                       <p className="text-[8px] font-black uppercase">Sem Imagem de Capa</p>
                    </div>
                  )}
                  <div className="absolute top-3 left-3">
                     <Badge className="bg-white/90 text-primary border-none shadow-sm text-[8px] font-black uppercase">{city.slug.split('-')[0]}-{city.state}</Badge>
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
                        {city.coverImage ? 'Regerar' : 'Gerar Capa'}
                     </Button>
                     <Button variant="ghost" size="sm" asChild className="rounded-xl h-10 font-black uppercase text-[9px] gap-2 hover:bg-muted">
                        <Link href={`/o-que-fazer-em/br-${city.state?.toLowerCase()}/${city.slug.split('-').pop()}`} target="_blank">
                           <ExternalLink className="w-3 h-3" /> Ver Página
                        </Link>
                     </Button>
                  </div>
                  
                  <div className="flex items-center justify-between pt-4 border-t border-dashed">
                     <div className="flex items-center gap-1.5 text-green-600">
                        <CheckCircle2 className="w-3 h-3" />
                        <span className="text-[8px] font-black uppercase tracking-widest">Página de Destino Ativa</span>
                     </div>
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
             <p className="text-xs font-black uppercase tracking-[0.3em]">Nenhuma cidade registrada</p>
          </div>
        )}
      </div>

      <div className="p-6 bg-muted/10 rounded-3xl border border-border flex items-start gap-4">
         <Info className="w-6 h-6 text-muted-foreground shrink-0 mt-0.5" />
         <div className="space-y-1">
            <h4 className="font-black uppercase text-[10px] tracking-widest text-primary italic">Processo de Automação</h4>
            <p className="text-[10px] text-muted-foreground leading-relaxed font-medium uppercase">
               O sistema cadastra automaticamente uma nova cidade assim que o primeiro evento nela é publicado ou acessado. 
               A IA gera a imagem apenas se o campo "Capa" estiver vazio.
            </p>
         </div>
      </div>
    </div>
  );
}
