'use client';

import React from 'react';
import { CitySection } from './CitySection';
import { CityBusinessCard } from './CityBusinessCard';

interface CityWhereToEatSectionProps {
  restaurants: any[];
  bars: any[];
  cafes: any[];
}

export function CityWhereToEatSection({
  restaurants = [],
  bars = [],
  cafes = []
}: CityWhereToEatSectionProps) {
  const hasAnyPlace = (restaurants && restaurants.length > 0) || (bars && bars.length > 0) || (cafes && cafes.length > 0);
  if (!hasAnyPlace) return null;

  // Combina restaurantes, bares e cafés
  const combined = [
    ...restaurants.map(r => ({ ...r, type: 'restaurant' })),
    ...bars.map(b => ({ ...b, type: 'bar' })),
    ...cafes.map(c => ({ ...c, type: 'cafe' }))
  ].slice(0, 9);

  return (
    <CitySection
      title="Onde Comer"
      subtitle="Descubra os melhores lugares para comer, beber e aproveitar"
      icon="🍴"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {combined.map((place) => (
          <CityBusinessCard
            key={place.id}
            id={place.id}
            name={place.name}
            avatar={place.avatar || place.image}
            city={place.city}
            type={place.type}
            rating={place.rating}
            reviewCount={place.reviewCount}
            phone={place.phone}
            website={place.website}
            href={place.href || '#'}
          />
        ))}
      </div>
    </CitySection>
  );
}
