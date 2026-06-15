
'use client';

import * as React from "react";
import { useState, useEffect } from "react";
import { getCurrentLocation, type Coordinates } from "@/lib/location-utils";
import { useTranslation } from "@/i18n/i18n-context";
import { PublicHeader } from "@/components/layout/PublicHeader";
import Footer from "@/components/layout/Footer";

// Hooks de Home
import { useHomeFeed } from "@/hooks/home/useHomeFeed";

// Componentes de Home
import { HomeHero } from "@/components/home/HomeHero";
import { HomeSection } from "@/components/home/HomeSection";
import { HomeFeed } from "@/components/home/HomeFeed";

export default function LandingPageClient({ initialEvents = [] }: { initialEvents?: any[] }) {
  const { t } = useTranslation();
  
  // Estado de Filtros e Localização
  const [searchName, setSearchName] = useState("");
  const [searchCity, setSearchCity] = useState("");
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);

  useEffect(() => {
    getCurrentLocation().then(loc => { if (loc) setUserLocation(loc); }).catch(() => {});
  }, []);

  // Hook Mestre de Dados
  const { 
    feed, 
    isFetching, 
    isInitialLoad, 
    hasMore, 
    fetchMore 
  } = useHomeFeed(initialEvents, { searchName, searchCity, userLocation });

  const handleClearFilters = () => {
    setSearchName("");
    setSearchCity("");
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
