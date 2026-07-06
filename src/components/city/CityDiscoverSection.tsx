'use client';

import React from 'react';
import { CitySection } from './CitySection';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin } from 'lucide-react';

interface CityDiscoverSectionProps {
  tourism: any[];
}

export function CityDiscoverSection({ tourism = [] }: CityDiscoverSectionProps) {
  if (!tourism || tourism.length === 0) return null;

  return (
    <CitySection
      title="Descubra Mais"
      subtitle="Pontos de interesse, bairros e atrações imperdíveis"
      icon="📍"
      dark
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {tourism.slice(0, 6).map((place) => (
          <Card
            key={place.id}
            className="overflow-hidden hover:shadow-xl transition-all duration-300 rounded-lg group cursor-pointer"
          >
            {/* Image */}
            {place.image && (
              <div className="relative h-48 overflow-hidden bg-gray-200">
                <img
                  src={place.image}
                  alt={place.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                {place.category && (
                  <Badge className="absolute top-3 right-3 bg-black/60">
                    {place.category}
                  </Badge>
                )}
              </div>
            )}

            {/* Content */}
            <div className="p-6 space-y-3">
              <div className="flex items-start gap-2">
                <MapPin className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="font-bold text-lg leading-tight">{place.name}</h4>
                </div>
              </div>

              {place.description && (
                <p className="text-sm text-gray-600 line-clamp-2">
                  {place.description}
                </p>
              )}

              {place.neighborhood && (
                <p className="text-xs text-gray-500 font-medium">
                  {place.neighborhood}
                </p>
              )}
            </div>
          </Card>
        ))}
      </div>
    </CitySection>
  );
}
