'use client';

import React, { useState, useMemo } from 'react';
import { CityGuideHero } from '@/components/city-guide/CityGuideHero';
import { FilterChips, FilterChip } from '@/components/city-guide/FilterChips';
import {
  TrendingSection,
  NearYouSection,
  DateNightSection,
  FamilySection,
  TonightSection,
  RestaurantsSection,
  EventsSection,
  ExperiencesSection
} from '@/components/city-guide/CityGuideSections';
import { ExploreByCategory } from '@/components/city-guide/ExploreByCategory';
import { CityGuideCTA } from '@/components/city-guide/CityGuideCTA';
import { motion } from 'framer-motion';

const FILTER_CHIPS: FilterChip[] = [
  { id: 'today', label: 'Hoje', icon: '📅' },
  { id: 'tomorrow', label: 'Amanhã', icon: '📆' },
  { id: 'weekend', label: 'Este fim de semana', icon: '🎉' },
  { id: 'eat', label: 'Comer', icon: '🍴' },
  { id: 'events', label: 'Eventos', icon: '🎭' },
  { id: 'tours', label: 'Passeios', icon: '🚶' },
  { id: 'couple', label: 'Casal', icon: '👫' },
  { id: 'family', label: 'Família', icon: '👨‍👩‍👧' },
  { id: 'budget-50', label: 'Até R$50', icon: '💰' },
  { id: 'free', label: 'Gratuito', icon: '🎁' }
];

interface CityGuidePageClientProps {
  cityName: string;
  regionLabel: string;
  countryCode: string;
  stateCode: string;
  citySlug: string;
  heroImage?: string;
  allItems: {
    trending: any[];
    nearYou: any[];
    dateNight: any[];
    family: any[];
    tonight: any[];
    restaurants: any[];
    events: any[];
    experiences: any[];
  };
}

export function CityGuidePageClient({
  cityName,
  regionLabel,
  countryCode,
  stateCode,
  citySlug,
  heroImage,
  allItems
}: CityGuidePageClientProps) {
  const [selectedChips, setSelectedChips] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const handleChipChange = (chipId: string) => {
    setSelectedChips((prev) =>
      prev.includes(chipId) ? prev.filter((id) => id !== chipId) : [...prev, chipId]
    );
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const filteredItems = useMemo(() => {
    let results = { ...allItems };

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      Object.keys(results).forEach((key) => {
        results[key as keyof typeof results] = results[key as keyof typeof results].filter(
          (item: any) =>
            item.title?.toLowerCase().includes(query) ||
            item.location?.toLowerCase().includes(query) ||
            item.category?.toLowerCase().includes(query)
        );
      });
    }

    // Apply chip filters
    if (selectedChips.length > 0) {
      // Filter by time
      if (selectedChips.includes('today')) {
        Object.keys(results).forEach((key) => {
          results[key as keyof typeof results] = results[key as keyof typeof results].filter(
            (item: any) => item.isToday
          );
        });
      }

      if (selectedChips.includes('tomorrow')) {
        Object.keys(results).forEach((key) => {
          results[key as keyof typeof results] = results[key as keyof typeof results].filter(
            (item: any) => item.isTomorrow
          );
        });
      }

      // Filter by category
      if (selectedChips.includes('eat')) {
        Object.keys(results).forEach((key) => {
          results[key as keyof typeof results] = results[key as keyof typeof results].filter(
            (item: any) =>
              item.category?.toLowerCase().includes('restaurante') ||
              item.category?.toLowerCase().includes('bar') ||
              item.category?.toLowerCase().includes('café')
          );
        });
      }

      if (selectedChips.includes('events')) {
        Object.keys(results).forEach((key) => {
          results[key as keyof typeof results] = results[key as keyof typeof results].filter(
            (item: any) => item.type?.toLowerCase() === 'evento'
          );
        });
      }

      // Filter by price
      if (selectedChips.includes('free')) {
        Object.keys(results).forEach((key) => {
          results[key as keyof typeof results] = results[key as keyof typeof results].filter(
            (item: any) => item.isFree || item.price === 0
          );
        });
      }

      if (selectedChips.includes('budget-50')) {
        Object.keys(results).forEach((key) => {
          results[key as keyof typeof results] = results[key as keyof typeof results].filter(
            (item: any) => item.price && item.price <= 50
          );
        });
      }
    }

    return results;
  }, [selectedChips, searchQuery, allItems]);

  return (
    <div className="w-full">
      {/* Hero */}
      <CityGuideHero
        cityName={cityName}
        regionLabel={regionLabel}
        imageUrl={heroImage}
        onSearch={handleSearch}
      />

      {/* Filter Chips */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gray-50 border-b border-gray-200 py-6 md:py-8 px-4 md:px-8 lg:px-16 sticky top-0 z-20"
      >
        <div className="max-w-7xl mx-auto">
          <FilterChips
            chips={FILTER_CHIPS}
            selectedChips={selectedChips}
            onChipChange={handleChipChange}
          />
        </div>
      </motion.div>

      {/* Content Sections */}
      <main className="w-full">
        {/* Editorial Sections */}
        {filteredItems.trending.length > 0 && (
          <TrendingSection items={filteredItems.trending} />
        )}

        {filteredItems.nearYou.length > 0 && (
          <NearYouSection items={filteredItems.nearYou} />
        )}

        {filteredItems.dateNight.length > 0 && (
          <DateNightSection items={filteredItems.dateNight} />
        )}

        {filteredItems.family.length > 0 && (
          <FamilySection items={filteredItems.family} />
        )}

        {filteredItems.tonight.length > 0 && (
          <TonightSection items={filteredItems.tonight} />
        )}

        {/* Explore by Category */}
        <ExploreByCategory
          stats={{
            restaurantes: allItems.restaurants.length,
            eventos: allItems.events.length,
            experiencias: allItems.experiences.length,
            promocoes: 0
          }}
        />

        {/* Category-specific Sections */}
        {filteredItems.restaurants.length > 0 && (
          <RestaurantsSection items={filteredItems.restaurants} />
        )}

        {filteredItems.events.length > 0 && (
          <EventsSection items={filteredItems.events} />
        )}

        {filteredItems.experiences.length > 0 && (
          <ExperiencesSection items={filteredItems.experiences} />
        )}

        {/* CTA Section */}
        <CityGuideCTA />
      </main>
    </div>
  );
}
