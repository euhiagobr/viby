'use client';

import React from 'react';
import { UtensilsCrossed } from 'lucide-react';
import { CityBusinessCard } from './CityBusinessCard';
import { CityModuleSection } from './CityModuleSection';

interface CityRestaurantsModuleProps {
  restaurants: any[];
  cityName: string;
}

export function CityRestaurantsModule({ restaurants, cityName }: CityRestaurantsModuleProps) {
  if (!restaurants || restaurants.length === 0) return null;

  return (
    <CityModuleSection
      title="Restaurantes"
      description="Os melhores sabores da cidade"
      icon={<UtensilsCrossed className="w-6 h-6" />}
      viewAllHref={`/empresas/${cityName.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {restaurants.slice(0, 6).map((restaurant) => (
          <CityBusinessCard
            key={restaurant.id}
            id={restaurant.id}
            name={restaurant.name || restaurant.nome}
            avatar={restaurant.avatar || restaurant.logoUrl}
            city={restaurant.city || cityName}
            type="Restaurante"
            phone={restaurant.phone || restaurant.telefone}
            website={restaurant.website}
            href={`/${restaurant.username}`}
          />
        ))}
      </div>
    </CityModuleSection>
  );
}
