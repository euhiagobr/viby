
'use client';

import * as React from "react";
import { useState, useEffect } from "react";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where, orderBy, getDocs, collectionGroup } from "firebase/firestore";
import { ExperienceCard } from "@/components/experiences/ExperienceCard";
import { AdsRenderer } from "@/components/ads/AdsRenderer";
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
  Calendar as CalendarIcon,
  X,
  Zap,
  Info
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, isSameDay, startOfToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getCurrentLocation, type Coordinates } from "@/lib/location-utils";
import { cn, normalizeText } from "@/lib/utils";
import { useAds } from "@/hooks/home/useAds";

interface ExperienciasClientProps {
  initialData: any[];
}

export default function ExperienciasClient({ initialData }: ExperienciasClientProps) {
  const db = useFirestore();
  const { ads, loading: adsLoading } = useAds();
  const [mounted, setMounted] = useState(false);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  
  const [search, setSearch] = useState("");
  const [searchCity, setSearchCity] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [now, setNow] = useState<Date>(new Date());

  // Carregar slots para filtro de data global e controle de expiração
  const slotsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collectionGroup(db, "slots"), where("status", "==", "active"));
  }, [db]);
  const { data: allSlots, loading: slotsLoading } = useCollection<any>(slotsQuery);

  useEffect(() => {
    setMounted(true);
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 60000);
    getCurrentLocation().then(loc => { if (loc) setUserLocation(loc); }).catch(() => {});
    return () => clearInterval(timer);
  }, []);

  const categoriesQuery = useMemoFirebase(() => 
    db ? query(collection(db, "categories"), where("type", "==", "experience"), orderBy("name", "asc")) : null, 
    [db]
  );
  const { data: categories } = useCollection<any>(categoriesQuery);

  const processedExp = React.useMemo(() => {
    const searchNorm = normalizeText(search);
    const cityNorm = normalizeText(searchCity);

    return initialData.filter(exp => {
      if (exp.status !== 'active') return false;

      // Filtro 1: Expiração automática (30 min após o ÚLTIMO slot)
      const mySlots = allSlots?.filter(s => s.experienceId === exp.id) || [];
      if (mySlots.length > 0) {
        // Ordenamos por data DESC para pegar o horário mais tardio
        const lastSlot = [...mySlots].sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime())[0];
        const expirationTime = new Date(new Date(lastSlot.datetime).getTime() + 30 * 60000);
        if (now > expirationTime) return false;
      }

      // Filtro 2: Busca por texto
      const matchesSearch = !search || 
        normalizeText(exp.title || "").includes(searchNorm) ||
        normalizeText(exp.shortDescription || "").includes(searchNorm);
      if (!matchesSearch) return false;

      // Filtro 3: Busca por cidade
      const eventLoc = normalizeText(`${exp.city || ""} ${exp.state || ""} ${exp.address?.city || ""} ${exp.address?.stateRegion || ""}`);
      const matchesCity = !searchCity || eventLoc.includes(cityNorm);
      if (!matchesCity) return false;

      // Filtro 4: Categoria
      const matchesCategory = selectedCategory === 'all' || exp.category === selectedCategory;
      if (!matchesCategory) return false;

      // Filtro 5: Data específica
      if (selectedDate) {
        const hasSlotOnDay = mySlots.some(s => isSameDay(new Date(s.datetime), selectedDate));
        if (!hasSlotOnDay) return false;
      }

      return true;
    });
  }, [initialData, allSlots, search, searchCity, selectedCategory, selectedDate, now]);

  // Lógica de Intercalação de Ads (Primeiro é Ad, depois a cada 3-7 experiências)
  const unifiedFeed = React.useMemo(() => {
    const feed: any[] = [];
    if (!mounted || adsLoading) return feed;

    let adIdx = 0;
    let expIdx = 0;

    // Regra: Sempre começa com um anúncio se houver
    if (ads.length > 0) {
      feed.push({ type: 'ad', adIndex: adIdx % ads.length });
      adIdx++;
    }

    // Padrão de intercalação: 3, 4, 5, 6, 7 experiências entre cada Ad
    const intervals = [3, 4, 5, 6, 7];
    let intervalIdx = 0;

    while (expIdx < processedExp.length) {
      const currentInterval = intervals[intervalIdx % intervals.length];
      
      // Adiciona o bloco de experiências
      for (let i = 0; i < currentInterval && expIdx < processedExp.length; i++) {
        feed.push({ type: 'experience', data: processedExp[expIdx] });
        expIdx++;
      }

      // Adiciona um anúncio após o intervalo
      if (ads.length > 0 && expIdx < processedExp.length) {
        feed.push({ type: 'ad', adIndex: adIdx % ads.length });
        adIdx++;
        intervalIdx++;
      }
    }

    return feed;
  }, [processedExp, ads, adsLoading, mounted]);

  const clearFilters = () => {
    setSearch("");
    setSearchCity("");
    setSelectedCategory("all");
    setSelectedDate(undefined);
  };

  if (!mounted) return null;

  return (
    <div className="flex flex-col min-h-screen">
      <section className="relative min-h-[60vh] flex items-center justify-center overflow-hidden bg-primary text-white">
        <div className="absolute inset-0 opacity-30 pointer-events-none">
           <div className="absolute inset-0 bg-[url('https://picsum.photos/seed/experience/1920/1080')] bg-cover bg-center" />
           <div className="absolute inset-0 bg-gradient-to-b from-primary/80 via-primary/40 to-primary" />
        </div>
        
        <div className="container mx-auto px-4 relative z-10 py-20 text-center">
          <div className="max-w-5xl mx-auto space-y-8 flex flex-col items-center">
            <Badge className="bg-secondary text-white border-none px-6 py-2 rounded-full font-black uppercase text-xs tracking-widest flex items-center gap-2 animate-bounce shadow-xl shadow-secondary/20">
              <Sparkles className="w-4 h-4 fill-current" /> Marketplace de Vivências
            </Badge>
            <h1 className="text-6xl md:text-9xl font-black uppercase italic tracking-tighter leading-[0.8] text-white">
              VIVÊNCIAS <br /><span className="text-secondary">CULTURAIS</span>
            </h1>
            <p className="text-lg md:text-2xl font-medium opacity-95 max-w-2xl mx-auto leading-relaxed">
              Descubra workshops, tours, gastronomia e experiências exclusivas com agendamento simplificado.
            </p>

            <Card className="bg-white/10 backdrop-blur-2xl border border-white/10 rounded-[3rem] p-6 md:p-8 shadow-2xl mt-12 w-full text-left">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <div className="md:col-span-4 relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                  <Input 
                    placeholder="O que você quer viver?" 
                    className="bg-white/5 border-white/10 h-14 pl-12 rounded-2xl text-white placeholder:text-white/30"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="md:col-span-3 relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary" />
                  <Input 
                    placeholder="Cidade?" 
                    className="bg-white/5 border-white/10 h-14 pl-12 rounded-2xl text-white placeholder:text-white/30"
                    value={searchCity}
                    onChange={(e) => setSearchCity(e.target.value)}
                  />
                </div>
                <div className="md:col-span-3">
                   <Popover>
                      <PopoverTrigger asChild>
                         <Button variant="outline" className={cn("w-full h-14 bg-white/5 border-white/10 rounded-2xl text-white gap-3 font-black uppercase italic text-xs", selectedDate && "bg-secondary border-secondary")}>
                            <CalendarIcon className="w-4 h-4 text-secondary" />
                            {selectedDate ? format(selectedDate, "dd 'de' MMMM", { locale: ptBR }) : "Quando?"}
                         </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 rounded-[2rem] border-none shadow-2xl" align="center">
                         <Calendar
                           mode="single"
                           selected={selectedDate}
                           onSelect={setSelectedDate}
                           disabled={(date) => date < startOfToday()}
                           initialFocus
                           locale={ptBR}
                         />
                      </PopoverContent>
                   </Popover>
                </div>
                <div className="md:col-span-2">
                   <Button onClick={() => window.scrollTo({top: 600, behavior:'smooth'})} className="w-full h-14 bg-secondary text-white font-black uppercase italic rounded-2xl shadow-xl hover:scale-105 transition-all">
                      Buscar
                   </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

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
                      selectedCategory === 'all' ? "bg-secondary text-white shadow-lg shadow-secondary/20" : "text-muted-foreground"
                    )}
                 >
                    Ver Tudo
                 </Button>
                 {categories.map((cat: any) => (
                   <Button
                      key={cat.id}
                      variant={selectedCategory === cat.name ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setSelectedCategory(cat.name)}
                      className={cn(
                        "rounded-full px-6 font-black uppercase text-[10px] tracking-widest shrink-0 transition-all",
                        selectedCategory === cat.name ? "bg-secondary text-white shadow-lg shadow-secondary/20" : "text-muted-foreground"
                      )}
                   >
                      {cat.name}
                   </Button>
                 ))}
              </div>
           </div>
        </section>
      )}

      <main id="experiencias-feed" className="container mx-auto px-4 py-16 flex-1 space-y-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
           <div className="space-y-1">
              <h2 className="text-4xl font-black uppercase italic tracking-tighter text-primary">Próximas <span className="text-secondary">Vivências</span></h2>
              <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest">Encontre o momento perfeito para sua jornada cultural.</p>
           </div>
           {(search || searchCity || selectedCategory !== 'all' || selectedDate) && (
             <Button variant="ghost" onClick={clearFilters} className="text-destructive font-bold uppercase text-[10px] gap-2 h-10 px-4 rounded-xl hover:bg-destructive/5">
                <FilterX className="w-4 h-4" /> Limpar filtros
             </Button>
           )}
        </div>

        {unifiedFeed.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {unifiedFeed.map((item, idx) => (
              item.type === 'ad' ? (
                <AdsRenderer 
                  key={`ad-${idx}`} 
                  location="marketplace" 
                  index={item.adIndex} 
                  googleSlotId="marketplace-feed-slot" 
                />
              ) : (
                <ExperienceCard 
                  key={item.data.id} 
                  experience={item.data} 
                  userLocation={userLocation} 
                />
              )
            ))}
          </div>
        ) : (
          <div className="py-40 text-center bg-white rounded-[4rem] border-2 border-dashed flex flex-col items-center gap-6 shadow-inner">
             <Inbox className="w-16 h-16 text-muted-foreground opacity-20" />
             <div className="space-y-2">
                <h3 className="text-2xl font-black uppercase italic text-primary">Nenhuma experiência disponível.</h3>
                <p className="text-muted-foreground font-medium uppercase text-xs">Tente ajustar seus filtros ou selecionar outra data.</p>
             </div>
             <Button variant="outline" onClick={clearFilters} className="rounded-2xl h-14 px-10 border-2 uppercase font-black italic">
                Ver Todas as Vivências
             </Button>
          </div>
        )}
      </main>
    </div>
  );
}
