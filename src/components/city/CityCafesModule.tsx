'use client';

import React from 'react';
import { Coffee } from 'lucide-react';
import { CityBusinessCard } from './CityBusinessCard';
import { CityModuleSection } from './CityModuleSection';

interface CityItemCafesModuleProps {
  cafes: any[];
  cityName: string;
}

export function CityCafesModule({ cafes, cityName }: CityItemCafesModuleProps) {
  if (!cafes || cafes.length === 0) return null;

  return (
    <CityModuleSection
      title="Cafés"
      description="Encontros aconchegantes"
      icon={<Coffee className="w-6 h-6" />}
      viewAllHref={`/empresas/${cityName.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {cafes.slice(0, 6).map((cafe) => (
          <CityBusinessCard
            key={cafe.id}
            id={cafe.id}
            name={cafe.name || cafe.nome}
            avatar={cafe.avatar || cafe.logoUrl}
            city={cafe.city || cityName}
            type="Café"
            phone={cafe.phone || cafe.telefone}
            website={cafe.website}
            href={`/${cafe.username}`}
          />
        ))}
      </div>
    </CityModuleSection>
  );
}
