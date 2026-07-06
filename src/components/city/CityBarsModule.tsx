'use client';

import React from 'react';
import { Wine } from 'lucide-react';
import { CityBusinessCard } from './CityBusinessCard';
import { CityModuleSection } from './CityModuleSection';

interface CityBarsModuleProps {
  bars: any[];
  cityName: string;
}

export function CityBarsModule({ bars, cityName }: CityBarsModuleProps) {
  if (!bars || bars.length === 0) return null;

  return (
    <CityModuleSection
      title="Bares & Vida Noturna"
      description="Noites memoráveis e encontros especiais"
      icon={<Wine className="w-6 h-6" />}
      viewAllHref={`/empresas/${cityName.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {bars.slice(0, 6).map((bar) => (
          <CityBusinessCard
            key={bar.id}
            id={bar.id}
            name={bar.name || bar.nome}
            avatar={bar.avatar || bar.logoUrl}
            city={bar.city || cityName}
            type="Bar"
            phone={bar.phone || bar.telefone}
            website={bar.website}
            href={`/${bar.username}`}
          />
        ))}
      </div>
    </CityModuleSection>
  );
}
