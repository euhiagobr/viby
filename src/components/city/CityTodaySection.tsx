'use client';

import React from 'react';
import { CitySection } from './CitySection';
import { EventsGroupedByDate } from './EventsGroupedByDate';
import { ExperienceCardPremium } from '@/components/experiences/ExperienceCardPremium';

interface CityTodaySectionProps {
  events: any[];
  experiences: any[];
}

export function CityTodaySection({ events = [], experiences = [] }: CityTodaySectionProps) {
  const hasEvents = events && events.length > 0;
  const hasExperiences = experiences && experiences.length > 0;

  if (!hasEvents && !hasExperiences) return null;

  return (
    <CitySection
      title="Acontecendo Hoje"
      subtitle="Explore o que está rolando agora na cidade"
      icon="🔥"
    >
      <div className="space-y-16">
        {/* Eventos organizados por data/hora */}
        {hasEvents && (
          <EventsGroupedByDate events={events.slice(0, 12)} />
        )}

        {/* Experiências */}
        {hasExperiences && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <span className="text-2xl">✨</span>
              <h3 className="text-xl font-bold text-primary">Experiências</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {experiences.slice(0, 3).map((exp) => (
                <ExperienceCardPremium key={`today-exp-${exp.id}`} experience={exp} />
              ))}
            </div>
          </div>
        )}
      </div>
    </CitySection>
  );
}
