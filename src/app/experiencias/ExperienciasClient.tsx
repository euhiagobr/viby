'use client';

import * as React from "react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  MapPin, 
  Calendar as CalendarIcon, 
  ChevronRight,
  SlidersHorizontal,
  X,
  ArrowRight,
  Inbox,
  Loader2
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import { format, startOfToday, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn, normalizeText } from "@/lib/utils";
import { ExperienceCardPremium } from "@/components/experiences/ExperienceCardPremium";
import { ExperienceCategoryCard } from "@/components/experiences/ExperienceCategoryCard";
import { ExperienceCarousel } from "@/components/experiences/ExperienceCarousel";
import { useAds } from "@/hooks/home/useAds";
import { motion, AnimatePresence } from "framer-motion";

interface ExperienciasClientProps {
  initialExperiences: any[];
  initialCategories: any[];
}

export default function ExperienciasClient({ initialExperiences, initialCategories }: ExperienciasClientProps) {
  const { ads, loading: adsLoading } = useAds();
  const [mounted, setMounted] = useState(false);
  
  const [search, setSearch] = useState("");
  const [searchCity, setSearchCity] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  useEffect(() => {
    setMounted(true);
  }, []);

  const filteredExperiences = React.useMemo(() => {
    const searchNorm = normalizeText(search);
    const cityNorm = normalizeText(searchCity);

    return initialExperiences.filter(exp => {
      const matchesSearch = !search || 
        normalizeText(exp.title || "").includes(searchNorm) ||
        normalizeText(exp.shortDescription || "").includes(searchNorm);
      
      const eventLoc = normalizeText(`${exp.city || ""} ${exp.state || ""} ${exp.address?.city || ""} ${exp.address?.stateRegion || ""}`);
      const matchesCity = !searchCity || eventLoc.includes(cityNorm);
      const matchesCategory = selectedCategory === 'all' || exp.category === selectedCategory;

      return matchesSearch && matchesCity && matchesCategory;
    });
  }, [initialExperiences, search, searchCity, selectedCategory]);

  const mostReserved = React.useMemo(() => {
    return [...filteredExperiences].sort((a, b) => (b.salesCount || 0) - (a.salesCount || 0)).slice(0, 10);
  }, [filteredExperiences]);

  const clearFilters = () => {
    setSearch("");
    setSearchCity("");
    setSelectedCategory("all");
    setSelectedDate(undefined);
  };

  if (!mounted) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <Loader2 className="w-10 h-10 animate-spin text-secondary" />
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-white font-sans selection:bg-secondary/10 selection:text-secondary">
      
      {/* HERO SECTION - APPLE/AIRBNB STYLE */}
      <section className="relative h-[85vh] w-full flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?q=80&w=2070&auto=format&fit=crop" 
            alt="Experience" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/40 bg-gradient-to-t from-white via-transparent to-black/20" />
        </div>

        <div className="container mx-auto px-6 relative z-10 flex flex-col items-center text-center space-y-12">
          <div className="max-w-4xl space-y-4">
             <motion.h1 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-6xl md:text-8xl font-black tracking-tighter text-white drop-shadow-2xl italic uppercase"
             >
                Experiências, passeios e atrações
             </motion.h1>
             <motion.p 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-xl md:text-2xl font-medium text-white/90 drop-shadow-md"
             >
                Passeios, restaurantes, parques, degustações, aventuras e muito mais. Compre online em poucos minutos.
             </motion.p>
          </div>

          {/* SEARCH BAR */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="w-full max-w-5xl bg-white shadow-2xl rounded-full p-2 flex flex-col md:flex-row items-center gap-2 ring-1 ring-black/5"
          >
            <div className="flex-1 w-full flex items-center px-6 gap-3 group">
              <Search className="w-5 h-5 text-muted-foreground group-focus-within:text-secondary transition-colors" />
              <input 
                placeholder="Restaurante, passeio, degustação, parque..." 
                className="w-full h-12 bg-transparent outline-none text-sm font-medium"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="hidden md:block w-px h-8 bg-muted" />
            <div className="flex-1 w-full flex items-center px-6 gap-3 group">
              <MapPin className="w-5 h-5 text-muted-foreground group-focus-within:text-secondary transition-colors" />
              <input 
                placeholder="Cidade ou região" 
                className="w-full h-12 bg-transparent outline-none text-sm font-medium"
                value={searchCity}
                onChange={e => setSearchCity(e.target.value)}
              />
            </div>
            <div className="hidden md:block w-px h-8 bg-muted" />
            <div className="flex-1 w-full flex items-center px-2">
               <Popover>
                  <PopoverTrigger asChild>
                    <button className="flex items-center gap-3 px-4 h-12 w-full text-muted-foreground hover:bg-muted/50 rounded-full transition-all">
                      <CalendarIcon className="w-5 h-5" />
                      <span className="text-sm font-medium truncate">
                        {selectedDate ? format(selectedDate, "dd 'de' MMMM", { locale: ptBR }) : "Quando?"}
                      </span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-4 rounded-3xl border-none shadow-2xl" align="center">
                    <div className="space-y-4">
                       <div className="flex flex-wrap gap-2">
                          <Button variant="outline" size="sm" className="rounded-full text-[10px] font-black uppercase h-8" onClick={() => setSelectedDate(startOfToday())}>Hoje</Button>
                          <Button variant="outline" size="sm" className="rounded-full text-[10px] font-black uppercase h-8" onClick={() => setSelectedDate(format(addDays(startOfToday(), 1), 'yyyy-MM-dd') as any)}>Amanhã</Button>
                       </div>
                       <Calendar
                         mode="single"
                         selected={selectedDate}
                         onSelect={setSelectedDate}
                         disabled={(date) => date < startOfToday()}
                         locale={ptBR}
                       />
                    </div>
                  </PopoverContent>
               </Popover>
            </div>
            <Button className="w-full md:w-auto h-14 px-10 bg-secondary text-white font-black rounded-full uppercase italic text-sm shadow-xl shadow-secondary/20 hover:scale-[1.02] transition-all">
              Buscar experiências
            </Button>
          </motion.div>
        </div>
      </section>

      {/* CATEGORIES SECTION */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-6 space-y-12">
           <div className="flex flex-col items-center text-center space-y-2">
              <h2 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter text-primary">Explore por categoria</h2>
              <p className="text-muted-foreground font-medium uppercase text-xs tracking-widest">Encontre a sua próxima paixão</p>
           </div>
           
           <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
              {initialCategories.map(cat => (
                <ExperienceCategoryCard 
                  key={cat.id} 
                  category={cat} 
                  isActive={selectedCategory === cat.name}
                  onClick={() => setSelectedCategory(selectedCategory === cat.name ? 'all' : cat.name)}
                />
              ))}
           </div>
        </div>
      </section>

      {/* FILTER BAR */}
      <section className="sticky top-16 z-40 bg-white/80 backdrop-blur-md border-y border-muted/50 py-4">
        <div className="container mx-auto px-6 flex items-center gap-3 overflow-x-auto scrollbar-hide no-wrap">
           <Button variant="outline" className="rounded-full h-10 gap-2 border-muted font-bold text-xs uppercase text-muted-foreground hover:bg-muted">
              <SlidersHorizontal className="w-4 h-4" /> Filtros
           </Button>
           <Separator orientation="vertical" className="h-6 mx-2" />
           {['Preço', 'Data', 'Avaliação', 'Duração', 'Cidade'].map(filter => (
             <Button key={filter} variant="outline" className="rounded-full h-10 px-6 border-muted font-bold text-xs uppercase text-muted-foreground hover:bg-muted shrink-0 transition-all">
                {filter}
             </Button>
           ))}
           <div className="ml-auto flex items-center gap-2">
              {(search || searchCity || selectedCategory !== 'all' || selectedDate) && (
                <Button variant="ghost" onClick={clearFilters} className="text-[10px] font-black uppercase text-destructive">Limpar</Button>
              )}
              <Button variant="ghost" className="rounded-full h-10 gap-2 font-bold text-xs uppercase text-muted-foreground">
                 Ordenar por <ChevronRight className="w-4 h-4" />
              </Button>
           </div>
        </div>
      </section>

      {/* VITRINES */}
      <main className="flex-1 space-y-32 py-24 bg-white overflow-hidden">
        
        {/* VITRINE 1: PADRÃO */}
        <section className="space-y-12">
          <div className="container mx-auto px-6 flex items-end justify-between">
            <div className="space-y-2">
              <h2 className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter text-primary">Próximas Experiências</h2>
              <p className="text-muted-foreground font-medium text-lg">Curadoria exclusiva Viby para você viver o agora.</p>
            </div>
            <Button variant="ghost" className="font-black uppercase italic text-sm text-secondary hover:bg-secondary/5 gap-2">
               Ver todas <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
          <ExperienceCarousel experiences={filteredExperiences} ads={ads} />
        </section>

        {/* VITRINE 2: MAIS RESERVADAS */}
        <section className="space-y-12">
          <div className="container mx-auto px-6 flex items-end justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                 <h2 className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter text-primary">As Mais Reservadas</h2>
                 <Badge className="bg-secondary text-white border-none font-black h-8 px-4 rounded-xl text-[10px] animate-pulse">Trending</Badge>
              </div>
              <p className="text-muted-foreground font-medium text-lg">As vivências que estão conquistando o Brasil nesta temporada.</p>
            </div>
            <Button variant="ghost" className="font-black uppercase italic text-sm text-secondary hover:bg-secondary/5 gap-2">
               Ver todas <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
          <ExperienceCarousel experiences={mostReserved} variant="sophisticated" />
        </section>

      </main>

      {/* EMPTY STATE */}
      {filteredExperiences.length === 0 && !isFetching && (
        <div className="py-40 text-center container mx-auto px-6">
           <div className="max-w-md mx-auto space-y-6">
              <Inbox className="w-20 h-20 mx-auto opacity-10" />
              <h3 className="text-2xl font-bold">Nenhuma vivência localizada</h3>
              <p className="text-muted-foreground">Tente ajustar seus filtros para encontrar novas experiências disponíveis.</p>
              <Button onClick={clearFilters} variant="outline" className="rounded-full px-8 h-12 font-black uppercase italic">Limpar todos os filtros</Button>
           </div>
        </div>
      )}
    </div>
  );
}

const isFetching = false; // Placeholder for internal state if needed
