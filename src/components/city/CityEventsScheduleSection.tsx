'use client';

import React from 'react';
import { CitySection } from './CitySection';
import { EventsGroupedByDate } from './EventsGroupedByDate';

interface CityEventsScheduleSectionProps {
  events: any[];
}

export function CityEventsScheduleSection({ events = [] }: CityEventsScheduleSectionProps) {
  if (!events || events.length === 0) return null;

  return (
    <CitySection
      title="Próximos Eventos"
      subtitle="Confira a programação completa organizada por data e hora"
      icon="📅"
    >
      <EventsGroupedByDate events={events} maxEventsPerDate={20} />
    </CitySection>
  );
}
