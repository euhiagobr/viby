
'use client';

import * as React from "react";
import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
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
  Loader2,
  FilterX,
  CheckCircle2,
  Zap,
  Tag
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { format, startOfToday, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn, normalizeText } from "@/lib/utils";
import { slugify } from "@/lib/slug-utils";
import { ExperienceCardPremium } from "@/components/experiences/ExperienceCardPremium";
import { ExperienceCategoryCard } from "@/components/experiences/ExperienceCategoryCard";
import { ExperienceCarousel } from "@/components/experiences/ExperienceCarousel";
import { useAds } from "@/hooks/home/useAds";
import { motion, AnimatePresence } from "framer-motion";

interface ExperienciasClientProps {
  initialExperiences: any[];
  initialCategories: any[];
}

/**
 * @fileOverview Marketplace de Experiências v3.
 * Implementação de URL como Source of Truth (Filtros Dinâmicos via Query Params).
 */
export default function ExperienciasClient({ initialExperiences = [], initialCategories = [] }: ExperienciasClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { ads } = useAds();
  
  const [mounted, setMounted] = useState(false);
  
  // ESTADOS DOS FILTROS (Inicializados da URL)
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [searchCity, setSearchCity] = useState(searchParams.get("cidade") || "");
  const [selectedCategorySlug, setSelectedCategorySlug] = useState(searchParams.get("categoria") || "all");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    searchParams.get("data") ? new Date(searchParams.get("data")!) : undefined
  );
  const [priceRange, setPriceFilter] = useState(searchParams.get("preco") || "all");
  const [ratingFilter, setRatingFilter] = useState(searchParams.get("avaliacao") || "all");

  useEffect(() => {
    setMounted(true);
  }, []);

  // SINCRONIZAÇÃO: Atualiza a URL sempre que um filtro mudar
  useEffect(() => {
    if (!mounted) return;

    const params = new URLSearchParams(searchParams.toString());
    
    if (search) params.set("q", search); else params.delete("q");
    if (searchCity) params.set("cidade", searchCity); else params.delete("cidade");
    if (selectedCategorySlug !== "all") params.set("categoria", selectedCategorySlug); else params.delete("categoria");
    if (selectedDate) params.set("data", format(selectedDate, "yyyy-MM-dd")); else params.delete("data");
    if (priceRange !== "all") params.set("preco", priceRange); else params.delete("preco");
    if (ratingFilter !== "all") params.set("avaliacao", ratingFilter); else params.delete("avaliacao");

    const query = params.toString();
    const url = query ? `${pathname}?${query}` : pathname;
    
    window.history.replaceState(null, "", url);
  }, [search, searchCity, selectedCategorySlug, selectedDate, priceRange, ratingFilter, pathname, mounted, searchParams]);

  // CATEGORIA ATIVA (Objeto)
  const activeCategory = useMemo(() => {
    if (selectedCategorySlug === "all") return null;
    return initialCategories.find(c => slugify(c.name) === selectedCategorySlug);
  }, [selectedCategorySlug, initialCategories]);

  // FILTRAGEM DOS DADOS
  const filteredExperiences = useMemo(() => {
    const searchNorm = normalizeText(search);
    const cityNorm = normalizeText(searchCity);

    return initialExperiences.filter(exp => {
      // 1. Busca textual
      const matchesSearch = !search || 
        normalizeText(exp.title || "").includes(searchNorm) ||
        normalizeText(exp.shortDescription || "").includes(searchNorm);
      
      // 2. Cidade/Localização
      const eventLoc = normalizeText(`${exp.city || ""} ${exp.state || ""} ${exp.address?.city || ""} ${exp.address?.stateRegion || ""}`);
      const matchesCity = !searchCity || eventLoc.includes(cityNorm);
      
      // 3. Categoria (via Slug para URL amigável)
      const expSlug = slugify(exp.category || "");
      const matchesCategory = selectedCategorySlug === 'all' || expSlug === selectedCategorySlug;

      return matchesSearch && matchesCity && matchesCategory;
    });
  }, [initialExperiences, search, searchCity, selectedCategorySlug]);

  const mostReserved = useMemo(() => {
    return [...filteredExperiences].sort((a, b) => (b.salesCount || 0) - (a.salesCount || 0)).slice(0, 12);
  }, [filteredExperiences]);

  const sortedCategories = useMemo(() => {
    return [...initialCategories].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [initialCategories]);

  const clearFilters = () => {
    setSearch("");
    setSearchCity("");
    setSelectedCategorySlug("all");
    setSelectedDate(undefined);
    setPriceFilter("all");
    setRatingFilter("all");
  };

  const removeFilter = (key: string) => {
    if (key === 'q') setSearch("");
    if (key === 'cidade') setSearchCity("");
    if (key === 'categoria') setSelectedCategorySlug("all");
    if (key === 'data') setSelectedDate(undefined);
    if (key === 'preco') setPriceFilter("all");
    if (key === 'avaliacao') setRatingFilter("all");
  };

  if (!mounted) return null;

  const hasAnyFilter = search || searchCity || selectedCategorySlug !== 'all' || selectedDate || priceRange !== 'all' || ratingFilter !== 'all';

  return (
    <div className="flex flex-col min-h-screen bg-white font-sans selection:bg-secondary/10 selection:text-secondary">
      
      {/* HERO SECTION */}
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
                          <Button variant="outline" size="sm" className="rounded-full text-[10px] font-black uppercase h-8" onClick={() => setSelectedDate(addDays(startOfToday(), 1))}>Amanhã</Button>
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
      <section className="py-24 bg-white border-b">
        <div className="container mx-auto px-6 space-y-12">
           <div className="flex flex-col items-center text-center space-y-2">
              <h2 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter text-primary">Explore por categoria</h2>
              <p className="text-muted-foreground font-medium uppercase text-xs tracking-widest">Encontre a sua próxima paixão</p>
           </div>
           
           <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
              {sortedCategories.map(cat => (
                <ExperienceCategoryCard 
                  key={cat.id} 
                  category={cat} 
                  isActive={selectedCategorySlug === slugify(cat.name)}
                  onClick={() => setSelectedCategorySlug(selectedCategorySlug === slugify(cat.name) ? 'all' : slugify(cat.name))}
                />
              ))}
           </div>
        </div>
      </section>

      {/* FILTER BAR */}
      <section className="sticky top-16 z-40 bg-white/95 backdrop-blur-md border-b py-4 shadow-sm">
        <div className="container mx-auto px-6 space-y-4">
           <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide no-wrap">
              <Button variant="outline" className="rounded-full h-10 gap-2 border-muted font-bold text-xs uppercase text-muted-foreground hover:bg-muted">
                 <SlidersHorizontal className="w-4 h-4" /> Filtros
              </Button>
              <Separator orientation="vertical" className="h-6 mx-2" />
              
              <Select value={priceRange} onValueChange={setPriceFilter}>
                 <SelectTrigger className="w-auto min-w-[120px] rounded-full h-10 border-muted font-bold text-xs uppercase text-muted-foreground">
                    <SelectValue placeholder="Preço" />
                 </SelectTrigger>
                 <SelectContent className="rounded-2xl">
                    <SelectItem value="all">Qualquer preço</SelectItem>
                    <SelectItem value="0-50">Até R$ 50</SelectItem>
                    <SelectItem value="50-150">R$ 50 - R$ 150</SelectItem>
                    <SelectItem value="150-500">R$ 150 - R$ 500</SelectItem>
                    <SelectItem value="500+">Mais de R$ 500</SelectItem>
                 </SelectContent>
              </Select>

              <Select value={ratingFilter} onValueChange={setRatingFilter}>
                 <SelectTrigger className="w-auto min-w-[120px] rounded-full h-10 border-muted font-bold text-xs uppercase text-muted-foreground">
                    <SelectValue placeholder="Avaliação" />
                 </SelectTrigger>
                 <SelectContent className="rounded-2xl">
                    <SelectItem value="all">Todas as notas</SelectItem>
                    <SelectItem value="4">4.0 + estrelas</SelectItem>
                    <SelectItem value="4.5">4.5 + estrelas</SelectItem>
                 </SelectContent>
              </Select>

              <div className="ml-auto flex items-center gap-4">
                 {hasAnyFilter && (
                   <Button variant="ghost" onClick={clearFilters} className="text-[10px] font-black uppercase text-destructive hover:bg-destructive/5">Limpar Tudo</Button>
                 )}
              </div>
           </div>

           <AnimatePresence>
             {hasAnyFilter && (
               <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex flex-wrap gap-2 pt-2"
               >
                  {selectedCategorySlug !== 'all' && (
                    <FilterChip label={activeCategory?.name || selectedCategorySlug} onRemove={() => removeFilter('categoria')} />
                  )}
                  {searchCity && (
                    <FilterChip label={searchCity} onRemove={() => removeFilter('cidade')} />
                  )}
                  {search && (
                    <FilterChip label={`Busca: ${search}`} onRemove={() => removeFilter('q')} />
                  )}
                  {selectedDate && (
                    <FilterChip label={format(selectedDate, "dd/MM")} onRemove={() => removeFilter('data')} />
                  )}
               </motion.div>
             )}
           </AnimatePresence>
        </div>
      </section>

      {/* VITRINES */}
      <main className="flex-1 space-y-24 py-16 bg-white overflow-hidden">
        {hasAnyFilter ? (
          <section className="container mx-auto px-6 space-y-12 animate-in fade-in">
             <div className="space-y-1">
                <div className="flex items-center gap-3">
                   <h2 className="text-4xl font-black italic uppercase tracking-tighter text-primary">Resultados</h2>
                   <Badge className="bg-secondary text-white font-black">{filteredExperiences.length}</Badge>
                </div>
                {searchCity && <p className="text-muted-foreground font-medium uppercase text-xs tracking-widest">Em {searchCity}</p>}
             </div>
             
             {filteredExperiences.length > 0 ? (
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                  {filteredExperiences.map(exp => (
                    <ExperienceCardPremium key={exp.id} experience={exp} />
                  ))}
               </div>
             ) : (
               <div className="py-32 text-center bg-muted/20 rounded-[3rem] border-2 border-dashed flex flex-col items-center gap-6">
                  <Inbox className="w-16 h-16 opacity-20" />
                  <div className="space-y-2">
                     <h3 className="text-xl font-bold">Nenhuma experiência localizada</h3>
                     <p className="text-muted-foreground max-w-xs mx-auto">Tente remover alguns filtros para encontrar mais opções disponíveis.</p>
                  </div>
                  <Button onClick={clearFilters} variant="outline" className="rounded-full px-8 h-12 font-black uppercase italic border-2">Limpar todos os filtros</Button>
               </div>
             )}
          </section>
        ) : (
          <>
            <section className="space-y-12">
              <div className="container mx-auto px-6 flex items-end justify-between">
                <div className="space-y-2">
                  <h2 className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter text-primary">Próximas Experiências</h2>
                  <p className="text-muted-foreground font-medium text-lg">Curadoria exclusiva Viby para você viver o agora.</p>
                </div>
              </div>
              <ExperienceCarousel experiences={filteredExperiences} ads={ads} />
            </section>

            <section className="space-y-12">
              <div className="container mx-auto px-6 flex items-end justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                     <h2 className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter text-primary">As Mais Reservadas</h2>
                     <Badge className="bg-secondary text-white border-none font-black h-8 px-4 rounded-xl text-[10px] animate-pulse">Trending</Badge>
                  </div>
                  <p className="text-muted-foreground font-medium text-lg">As vivências que estão conquistando o Brasil nesta temporada.</p>
                </div>
              </div>
              <ExperienceCarousel experiences={mostReserved} variant="sophisticated" />
            </section>
          </>
        )}
      </main>

      <div className="container mx-auto px-6 py-20 border-t border-muted/50">
         <p className="text-center text-muted-foreground font-medium text-lg max-w-2xl mx-auto">
            Descubra passeios, atrações e experiências selecionadas em todo o Brasil.
         </p>
      </div>
    </div>
  );
}

function FilterChip({ label, onRemove }: { label: string, onRemove: () => void }) {
  return (
    <Badge 
      variant="secondary" 
      className="bg-secondary/5 text-primary border-none pl-4 pr-1 h-9 rounded-xl flex items-center gap-2 group transition-all hover:bg-secondary/10"
    >
      <span className="text-[10px] font-black uppercase tracking-tight italic">{label}</span>
      <button 
        onClick={onRemove}
        className="p-1.5 rounded-lg hover:bg-secondary hover:text-white transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </Badge>
  );
}
