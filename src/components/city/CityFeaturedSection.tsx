'use client';

import React from 'react';
import { CitySection } from './CitySection';
import { EventsGroupedByDate } from './EventsGroupedByDate';
import { ExperienceCardPremium } from '@/components/experiences/ExperienceCardPremium';

interface CityFeaturedSectionProps {
  events: any[];
  experiences: any[];
}

export function CityFeaturedSection({ events = [], experiences = [] }: CityFeaturedSectionProps) {
  const hasContent = (events && events.length > 0) || (experiences && experiences.length > 0);
  
  if (!hasContent) return null;

  return (
    <CitySection
      title="Imperdíveis"
      subtitle="Os melhores eventos e experiências da cidade"
      icon="⭐"
      dark
    >
      <div className="space-y-16">
        {/* Melhores eventos organizados por data */}
        {events && events.length > 0 && (
          <EventsGroupedByDate events={events.slice(0, 8)} maxEventsPerDate={12} />
        )}

        {/* Melhores experiências */}
        {experiences && experiences.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🎯</span>
              <h3 className="text-xl font-bold text-white">Experiências em Destaque</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {experiences.slice(0, 3).map((exp) => (
                <ExperienceCardPremium key={`featured-exp-${exp.id}`} experience={exp} />
              ))}
            </div>
          </div>
        )}
      </div>
    </CitySection>
  );
}
