'use client';

import React, { useState, useMemo } from 'react';
import { ExperienceHero } from '@/components/experience-discovery/ExperienceHero';
import { ExperienceChips } from '@/components/experience-discovery/ExperienceChips';
import { ExperienceCard } from '@/components/experience-discovery/ExperienceCard';
import { ExperienceSection } from '@/components/experience-discovery/ExperienceSection';

const CHIPS = [
  { id: 'today', label: 'Hoje' },
  { id: 'tomorrow', label: 'Amanhã' },
  { id: 'weekend', label: 'Fim de semana' },
  { id: 'events', label: 'Eventos' },
  { id: 'eat', label: 'Comer' },
  { id: 'tours', label: 'Passeios' },
  { id: 'couple', label: 'Casal' },
  { id: 'family', label: 'Família' },
  { id: 'free', label: 'Gratuito' },
  { id: 'budget', label: 'Até R$50' }
];

function getDateRange(type: 'today' | 'tomorrow' | 'weekend') {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (type === 'today') {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return { start: today, end: tomorrow };
  } else if (type === 'tomorrow') {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);
    return { start: tomorrow, end: dayAfter };
  } else {
    const weekend = new Date(today);
    const daysUntilSaturday = (6 - today.getDay() + 7) % 7;
    weekend.setDate(weekend.getDate() + daysUntilSaturday);
    const endOfWeekend = new Date(weekend);
    endOfWeekend.setDate(endOfWeekend.getDate() + 2);
    return { start: weekend, end: endOfWeekend };
  }
}

interface ExperienceDiscoveryPageClientProps {
  cityName: string;
  regionLabel: string;
  stateCode: string;
  citySlug: string;
  heroImage: string;
  allData: {
    trending: any[];
    nearYou: any[];
    dateNight: any[];
    tonight: any[];
    family: any[];
    restaurants: any[];
    events: any[];
    experiences: any[];
  };
}

export function ExperienceDiscoveryPageClient({
  cityName,
  regionLabel,
  stateCode,
  citySlug,
  heroImage,
  allData
}: ExperienceDiscoveryPageClientProps) {
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

  // Track used items to avoid repetition
  const usedItemIds = new Set<string>();

  const getUniqueItems = (items: any[], limit: number) => {
    const result = [];
    for (const item of items) {
      if (!usedItemIds.has(item.id) && result.length < limit) {
        result.push(item);
        usedItemIds.add(item.id);
      }
    }
    return result;
  };

  const filteredData = useMemo(() => {
    let results = { ...allData };

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      Object.keys(results).forEach((key) => {
        results[key as keyof typeof results] = results[key as keyof typeof results].filter(
          (item: any) =>
            item.title?.toLowerCase().includes(query) ||
            item.location?.toLowerCase().includes(query)
        );
      });
    }

    // Filter by selected chips
    if (selectedChips.length > 0) {
      const filtered: any = {};
      
      Object.keys(results).forEach((key) => {
        filtered[key] = results[key as keyof typeof results].filter((item: any) => {
          let matches = false;

          // Date filters
          if (selectedChips.includes('today') || selectedChips.includes('tomorrow') || selectedChips.includes('weekend')) {
            if (!item.eventDate) return false;
            const itemDate = new Date(item.eventDate);
            itemDate.setHours(0, 0, 0, 0);

            if (selectedChips.includes('today')) {
              const { start, end } = getDateRange('today');
              if (itemDate >= start && itemDate < end) matches = true;
            }
            if (selectedChips.includes('tomorrow')) {
              const { start, end } = getDateRange('tomorrow');
              if (itemDate >= start && itemDate < end) matches = true;
            }
            if (selectedChips.includes('weekend')) {
              const { start, end } = getDateRange('weekend');
              if (itemDate >= start && itemDate < end) matches = true;
            }
          }

          // Type filters
          if (selectedChips.includes('events')) {
            if (item.type === 'evento') matches = true;
          }
          if (selectedChips.includes('eat')) {
            if (item.type === 'restaurante' || item.type === 'bar' || item.type === 'café') matches = true;
          }
          if (selectedChips.includes('tours')) {
            if (item.type === 'passeio' || item.type === 'experiência') matches = true;
          }

          // Vibe filters
          if (selectedChips.includes('couple')) {
            if (item.type === 'restaurante' || item.type === 'experiência') matches = true;
          }
          if (selectedChips.includes('family')) {
            if (item.type !== 'bar') matches = true; // Everything except bars
          }

          // Price filters
          if (selectedChips.includes('free')) {
            if (item.price === 0 || item.isFree) matches = true;
          }
          if (selectedChips.includes('budget')) {
            if (item.price && item.price <= 50) matches = true;
          }

          // If multiple chips selected, use OR logic
          return matches;
        });
      });
      
      return filtered;
    }

    return results;
  }, [selectedChips, searchQuery, allData]);

  const createCardItem = (item: any) => (
    <ExperienceCard
      key={item.id}
      id={item.id}
      title={item.title}
      image={item.image || item.imageUrl || '/images/placeholder.jpg'}
      location={item.location || item.city || ''}
      category={item.category || item.type || ''}
      price={item.price}
      isFree={item.price === 0 || item.isFree}
      rating={item.rating}
      reviewCount={item.reviewCount}
      link={`/${item.type || 'evento'}/${item.id}`}
      eventDate={item.eventDate}
      eventTime={item.eventTime}
    />
  );

  return (
    <div className="w-full bg-white">
      {/* Hero */}
      <div style={{ paddingTop: '32px', paddingBottom: '32px' }}>
        <ExperienceHero
          cityName={cityName}
          regionLabel={regionLabel}
          heroImage={heroImage}
          onSearch={handleSearch}
        />
      </div>

      {/* Chips */}
      <ExperienceChips
        chips={CHIPS}
        selectedChips={selectedChips}
        onChipChange={handleChipChange}
      />

      {/* Main Content */}
      <main>
        {filteredData.trending.length > 0 && (
          <ExperienceSection
            title="Em alta"
            description="Os lugares que estão fazendo sucesso"
            icon="🔥"
            items={getUniqueItems(filteredData.trending.sort((a, b) => (b.viewsCount || 0) - (a.viewsCount || 0)), 12).map(createCardItem)}
            viewAllLink={`/o-que-fazer-em/${stateCode}/search?sort=trending`}
          />
        )}

        {filteredData.nearYou.length > 0 && (
          <ExperienceSection
            title="Perto de você"
            description="Descubra lugares próximos"
            icon="📍"
            items={getUniqueItems(filteredData.nearYou, 12).map(createCardItem)}
            viewAllLink={`/o-que-fazer-em/${stateCode}/search?sort=distance`}
          />
        )}

        {(filteredData.restaurants.length > 0 || filteredData.experiences.length > 0) && (
          <ExperienceSection
            title="Para um encontro"
            description="Experiências para duas pessoas"
            icon="❤️"
            items={getUniqueItems(
              [...filteredData.experiences, ...filteredData.restaurants].filter(i => i.type !== 'evento'),
              12
            ).map(createCardItem)}
            viewAllLink={`/o-que-fazer-em/${stateCode}/search?sort=datenight`}
          />
        )}

        {filteredData.tonight.length > 0 && (
          <ExperienceSection
            title="Hoje à noite"
            description="Programação para esta noite"
            icon="🌙"
            items={getUniqueItems(
              filteredData.tonight.filter((item: any) => item.eventTime && parseInt(item.eventTime.split(':')[0]) >= 19),
              12
            ).map(createCardItem)}
            viewAllLink={`/o-que-fazer-em/${stateCode}/search?sort=tonight`}
          />
        )}

        {filteredData.family.length > 0 && (
          <ExperienceSection
            title="Para fazer em família"
            description="Diversão para todas as idades"
            icon="👨‍👩‍👧"
            items={getUniqueItems(
              filteredData.family.filter((i: any) => i.type !== 'bar'),
              12
            ).map(createCardItem)}
            viewAllLink={`/o-que-fazer-em/${stateCode}/search?sort=family`}
          />
        )}

        {filteredData.events.length > 0 && (
          <ExperienceSection
            title="Eventos desta semana"
            description="Programação cultural"
            icon="🎭"
            items={getUniqueItems(
              filteredData.events.filter((i: any) => i.type === 'evento'),
              12
            ).map(createCardItem)}
            viewAllLink={`/o-que-fazer-em/${stateCode}/search?sort=events`}
          />
        )}

        {filteredData.experiences.length > 0 && (
          <ExperienceSection
            title="Experiências imperdíveis"
            description="Viva momentos únicos"
            icon="🌿"
            items={getUniqueItems(
              filteredData.experiences.filter((i: any) => i.type === 'experiência'),
              12
            ).map(createCardItem)}
            viewAllLink={`/o-que-fazer-em/${stateCode}/search?sort=experiences`}
          />
        )}
      </main>

      {/* Footer Spacing */}
      <div style={{ height: '72px' }} />
    </div>
  );
}
