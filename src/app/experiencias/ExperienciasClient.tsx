
'use client';

import * as React from "react";
import { useState, useEffect } from "react";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where, limit, orderBy, getDocs, startAfter } from "firebase/firestore";
import { EventCard } from "@/components/events/EventCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { 
  Search, 
  MapPin, 
  Sparkles, 
  Loader2, 
  Inbox, 
  FilterX,
  Navigation,
  Globe,
  ChevronRight,
  Clock,
  Layout
} from "lucide-react";
import { getCurrentLocation, type Coordinates } from "@/lib/location-utils";
import { cn, normalizeText } from "@/lib/utils";

interface ExperienciasClientProps {
  initialData: any[];
}

export default function ExperienciasClient({ initialData }: ExperienciasClientProps) {
  const db = useFirestore();
  const [mounted, setMounted] = useState(false);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  
  const [search, setSearch] = useState("");
  const [searchCity, setSearchCity] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  
  const [rawExp, setRawExp] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialData.length >= 20);
  const [lastDoc, setLastDoc] = useState<any>(null);

  useEffect(() => {
    setMounted(true);
    getCurrentLocation().then(loc => { if (loc) setUserLocation(loc); }).catch(() => {});
  }, []);

  const categoriesQuery = useMemoFirebase(() => 
    db ? query(collection(db, "categories"), where("type", "==", "experience"), orderBy("name", "asc")) : null, 
    [db]
  );
  const { data: categories } = useCollection<any>(categoriesQuery);

  const processedExp = React.useMemo(() => {
    const searchNorm = normalizeText(search);
    const cityNorm = normalizeText(searchCity);

    return rawExp.filter(exp => {
      const matchesSearch = !search || 
        normalizeText(exp.title || "").includes(searchNorm) ||
        normalizeText(exp.shortDescription || "").includes(searchNorm);
      
      const eventLoc = normalizeText(`${exp.city || ""} ${exp.state || ""}`);
      const matchesCity = !searchCity || eventLoc.includes(cityNorm);

      const matchesCategory = selectedCategory === 'all' || exp.category === selectedCategory;

      return matchesSearch && matchesCity && matchesCategory;
    });
  }, [rawExp, search, searchCity, selectedCategory]);

  const clearFilters = () => {
    setSearch("");
    setSearchCity("");
    setSelectedCategory("all");
  };

  if (!mounted) return null;

  return (
    <div className="flex flex-col min-h-screen">
      {/* HERO ESPECÍFICO */}
      <section className="relative min-h-[60vh] flex items-center justify-center overflow-hidden bg-primary text-white">
        <div className="absolute inset-0 opacity-30 pointer-events-none">
           <div className="absolute inset-0 bg-[url('https://picsum.photos/seed/experience/1920/1080')] bg-cover bg-center" />
           <div className="absolute inset-0 bg-gradient-to-b from-primary/80 via-primary/40 to-primary" />
        </div>
        
        <div className="container mx-auto px-4 relative z-10 py-20 text-center">
          <div className="max-w-4xl mx-auto space-y-8 flex flex-col items-center">
            <Badge className="bg-secondary text-white border-none px-6 py-2 rounded-full font-black uppercase text-xs tracking-widest flex items-center gap-2 animate-bounce">
              <Sparkles className="w-4 h-4 fill-current" /> Marketplace de Vivências
            </Badge>
            <h1 className="text-6xl md:text-9xl font-black uppercase italic tracking-tighter leading-[0.8] text-white">
              VIVÊNCIAS <br /><span className="text-secondary">CULTURAIS</span>
            </h1>
            <p className="text-lg md:text-2xl font-medium opacity-90 max-w-2xl mx-auto leading-relaxed">
              Descubra workshops, tours, gastronomia e experiências exclusivas com agendamento simplificado.
            </p>

            <Card className="bg-white/10 backdrop-blur-2xl border-white/10 rounded-[3rem] p-6 md:p-8 shadow-2xl mt-12 w-full text-left max-w-3xl">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <div className="md:col-span-5 relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                  <Input 
                    placeholder="O que você quer aprender ou viver?" 
                    className="bg-white/5 border-white/10 h-14 pl-12 rounded-2xl text-white placeholder:text-white/30"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="md:col-span-4 relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary" />
                  <Input 
                    placeholder="Cidade?" 
                    className="bg-white/5 border-white/10 h-14 pl-12 rounded-2xl text-white placeholder:text-white/30"
                    value={searchCity}
                    onChange={(e) => setSearchCity(e.target.value)}
                  />
                </div>
                <div className="md:col-span-3">
                   <Button onClick={() => window.scrollTo({top: 600, behavior:'smooth'})} className="w-full h-14 bg-secondary text-white font-black uppercase italic rounded-2xl shadow-xl hover:scale-105 transition-all">
                      Buscar Agora
                   </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* FILTROS DE CATEGORIA */}
      {categories && categories.length > 0 && (
        <section className="bg-white border-b sticky top-16 z-30 shadow-sm overflow-hidden">
           <div className="container mx-auto px-4 py-4">
              <div className="flex items-center gap-4 overflow-x-auto scrollbar-hide py-1">
                 <Button
                    variant={selectedCategory === 'all' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setSelectedCategory('all')}
                    className={cn(
                      "rounded-full px-6 font-black uppercase text-[10px] tracking-widest shrink-0 transition-all",
                      selectedCategory === 'all' ? "bg-secondary text-white shadow-lg" : "text-muted-foreground"
                    )}
                 >
                    Todas as Vivências
                 </Button>
                 {categories.map((cat: any) => (
                   <Button
                      key={cat.id}
                      variant={selectedCategory === cat.name ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setSelectedCategory(cat.name)}
                      className={cn(
                        "rounded-full px-6 font-black uppercase text-[10px] tracking-widest shrink-0 transition-all",
                        selectedCategory === cat.name ? "bg-secondary text-white shadow-lg" : "text-muted-foreground"
                      )}
                   >
                      {cat.name}
                   </Button>
                 ))}
              </div>
           </div>
        </section>
      )}

      {/* FEED PRINCIPAL */}
      <main id="experiencias-feed" className="container mx-auto px-4 py-16 flex-1 space-y-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
           <div className="space-y-1">
              <h2 className="text-4xl font-black uppercase italic tracking-tighter text-primary">Próximas Datas</h2>
              <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest">Encontre o momento perfeito para sua vivência.</p>
           </div>
           {(search || searchCity || selectedCategory !== 'all') && (
             <Button variant="ghost" onClick={clearFilters} className="text-destructive font-bold uppercase text-[10px] gap-2 h-10 px-4 rounded-xl hover:bg-destructive/5">
                <FilterX className="w-4 h-4" /> Limpar filtros
             </Button>
           )}
        </div>

        {processedExp.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {processedExp.map((exp) => (
              <EventCard key={exp.id} event={{ ...exp, productType: 'experience', userLocation }} />
            ))}
          </div>
        ) : (
          <div className="py-40 text-center bg-white rounded-[4rem] border-2 border-dashed flex flex-col items-center gap-6 shadow-inner">
             <Inbox className="w-16 h-16 text-muted-foreground opacity-20" />
             <div className="space-y-2">
                <h3 className="text-2xl font-black uppercase italic text-primary">Nenhuma experiência localizada.</h3>
                <p className="text-muted-foreground font-medium uppercase text-xs">Tente ajustar seus filtros ou mude a cidade da busca.</p>
             </div>
             <Button variant="outline" onClick={clearFilters} className="rounded-2xl h-14 px-10 border-2 uppercase font-black italic">
                Ver Todas as Vivências
             </Button>
          </div>
        )}

        {hasMore && (
          <div className="flex justify-center pt-10">
             <Button variant="outline" className="rounded-full px-12 h-14 font-black uppercase italic border-2 border-secondary text-secondary">
                Ver Mais Experiências
             </Button>
          </div>
        )}
      </main>
    </div>
  );
}
