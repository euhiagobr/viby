'use client';

import React from 'react';
import { Calendar } from 'lucide-react';
import { EventCard } from '@/components/events/EventCard';
import { CityModuleSection } from './CityModuleSection';

interface CityEventsModuleProps {
  events: any[];
  citySlug: string;
  regionSlug: string;
}

export function CityEventsModule({ events, citySlug, regionSlug }: CityEventsModuleProps) {
  if (!events || events.length === 0) return null;

  return (
    <CityModuleSection
      title="Próximos Eventos"
      description="Confira os eventos imperdíveis na cidade"
      icon={<Calendar className="w-6 h-6" />}
      viewAllHref={`/o-que-fazer-em/${regionSlug}/${citySlug}`}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {events.slice(0, 6).map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>
    </CityModuleSection>
  );
}
