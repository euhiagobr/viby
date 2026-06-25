'use client';

import * as React from "react";
import { useState, useEffect } from "react";
import { getCurrentLocation, type Coordinates } from "@/lib/location-utils";
import { useTranslation } from "@/i18n/i18n-context";
import { PublicHeader } from "@/components/layout/PublicHeader";
import Footer from "@/components/layout/Footer";
import { cn } from "@/lib/utils";

// Hooks de Home
import { useHomeFeed } from "@/hooks/home/useHomeFeed";

// Componentes de Home
import { HomeHero } from "@/components/home/HomeHero";
import { HomeSection } from "@/components/home/HomeSection";
import { HomeFeed } from "@/components/home/HomeFeed";
import { Button } from "@/components/ui/button";

export default function LandingPageClient({ initialEvents = [] }: { initialEvents?: any[] }) {
  const { t } = useTranslation();
  
  // Estado de Filtros e Localização
  const [searchName, setSearchName] = useState("");
  const [searchCity, setSearchCity] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);

  useEffect(() => {
    getCurrentLocation().then(loc => { if (loc) setUserLocation(loc); }).catch(() => {});
  }, []);

  /**
   * Hook Mestre de Dados - FILTRO CENTRAL: Apenas 'published'.
   * O hook useHomeFeed gerencia a filtragem de categorias e busca inteligente.
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

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      <PublicHeader />

      <HomeHero 
        searchName={searchName}
        setSearchName={setSearchName}
        searchCity={searchCity}
        setSearchCity={setSearchCity}
      />

      {/* SEÇÃO DE CATEGORIAS DINÂMICAS - Scroll Horizontal Oculto */}
      {!isInitialLoad && dynamicCategories.length > 0 && (
        <section className="bg-white border-b sticky top-16 z-30 shadow-sm overflow-hidden">
           <div className="container mx-auto px-4 py-4">
              <div className="flex items-center gap-4 overflow-x-auto scrollbar-hide py-1 flex-nowrap cursor-grab active:cursor-grabbing">
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

      <Footer />
    </div>
  );
}
