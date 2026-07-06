'use client';

import * as React from "react";
import { useState, useEffect, useRef } from "react";
import { getCurrentLocation, type Coordinates } from "@/lib/location-utils";
import { useTranslation } from "@/i18n/i18n-context";
import Footer from "@/components/layout/Footer";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

// Hooks de Home
import { useHomeFeed } from "@/hooks/home/useHomeFeed";

// Componentes de Home
import { HomeHero } from "@/components/home/HomeHero";
import { HomeSection } from "@/components/home/HomeSection";
import { HomeFeed } from "@/components/home/HomeFeed";
import { Button } from "@/components/ui/button";

export default function LandingPageClient({ initialEvents = [] }: { initialEvents?: any[] }) {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  
  // Estado de Filtros e Localização
  const [searchName, setSearchName] = useState("");
  const [searchCity, setSearchCity] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);

  // Estados para Drag-to-Scroll
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  useEffect(() => {
    setMounted(true);
    getCurrentLocation().then(loc => { if (loc) setUserLocation(loc); }).catch(() => {});
  }, []);

  /**
   * Hook Mestre de Dados
   */
  const { 
    feed, 
    dynamicCategories,
    isFetching, 
    isInitialLoad, 
    hasMore, 
    fetchMore 
  } = useHomeFeed(initialEvents, { searchName, searchCity, selectedCategory, userLocation });

  const handleClearFilters = () => {
    setSearchName("");
    setSearchCity("");
    setSelectedCategory("all");
  };

  // Handlers para simular arraste com o mouse
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    setIsMouseDown(true);
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeft(scrollRef.current.scrollLeft);
  };

  const handleMouseLeave = () => setIsMouseDown(false);
  const handleMouseUp = () => setIsMouseDown(false);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDown || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 2; 
    scrollRef.current.scrollLeft = scrollLeft - walk;
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      <HomeHero 
        searchName={searchName}
        setSearchName={setSearchName}
        searchCity={searchCity}
        setSearchCity={setSearchCity}
      />

      {/* 
         PREVENÇÃO DE ERRO DE HIDRATAÇÃO:
         O conteúdo dinâmico que depende de estados locais (mounted, window, etc)
         deve ser renderizado apenas após o mount inicial para garantir paridade com o servidor.
      */}
      {!mounted ? (
        <div className="py-32 flex flex-col items-center justify-center gap-4">
           <Loader2 className="w-10 h-10 animate-spin text-secondary opacity-20" />
           <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground animate-pulse">Sincronizando...</p>
        </div>
      ) : (
        <>
          {dynamicCategories.length > 0 && (
            <section className="bg-white border-b sticky top-16 z-30 shadow-sm overflow-hidden select-none">
              <div className="container mx-auto px-4 py-4">
                  <div 
                    ref={scrollRef}
                    onMouseDown={handleMouseDown}
                    onMouseLeave={handleMouseLeave}
                    onMouseUp={handleMouseUp}
                    onMouseMove={handleMouseMove}
                    className={cn(
                      "flex items-center gap-4 overflow-x-auto scrollbar-hide py-1 flex-nowrap",
                      isMouseDown ? "cursor-grabbing" : "cursor-grab"
                    )}
                  >
                    <Button
                        variant={selectedCategory === 'all' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setSelectedCategory('all')}
                        className={cn(
                          "rounded-full px-6 font-black uppercase text-[10px] tracking-widest shrink-0 transition-all",
                          selectedCategory === 'all' ? "bg-secondary text-white shadow-lg" : "text-muted-foreground hover:bg-muted"
                        )}
                    >
                        Ver Tudo
                    </Button>
                    {dynamicCategories.map((cat) => (
                      <Button
                          key={cat}
                          variant={selectedCategory === cat ? 'default' : 'ghost'}
                          size="sm"
                          onClick={() => setSelectedCategory(cat)}
                          className={cn(
                            "rounded-full px-6 font-black uppercase text-[10px] tracking-widest shrink-0 transition-all",
                            selectedCategory === cat ? "bg-secondary text-white shadow-lg" : "text-muted-foreground hover:bg-muted"
                          )}
                      >
                          {cat}
                      </Button>
                    ))}
                  </div>
              </div>
            </section>
          )}

          <HomeSection 
            title={t('home.upcoming_title')}
            subtitle={t('home.upcoming_subtitle')}
          >
            <HomeFeed 
              feed={feed}
              isInitialLoad={isInitialLoad}
              isFetching={isFetching}
              hasMore={hasMore}
              onFetchMore={fetchMore}
              userLocation={userLocation}
              onClearFilters={handleClearFilters}
            />
          </HomeSection>
        </>
      )}

      <Footer />
    </div>
  );
}
