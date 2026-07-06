'use client';

import React from 'react';
import { EventCardAirbnb } from '@/components/events/EventCardAirbnb';
import { safeParseDate } from '@/lib/utils';
import { format, startOfDay, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Clock } from 'lucide-react';

interface EventsGroupedByDateProps {
  events: any[];
  maxEventsPerDate?: number;
}

interface GroupedEvents {
  date: Date;
  dateString: string;
  events: any[];
}

export function EventsGroupedByDate({ events, maxEventsPerDate = 12 }: EventsGroupedByDateProps) {
  const groupedEvents = React.useMemo(() => {
    if (!events || events.length === 0) return [];

    // Agrupa por data
    const groups: { [key: string]: GroupedEvents } = {};

    events.forEach((event) => {
      const eventDate = safeParseDate(event.date);
      if (!eventDate) return;

      const dateKey = format(eventDate, 'yyyy-MM-dd');
      const dateDisplay = format(eventDate, "EEEE, d 'de' MMMM", { locale: ptBR });

      if (!groups[dateKey]) {
        groups[dateKey] = {
          date: eventDate,
          dateString: dateDisplay,
          events: []
        };
      }

      groups[dateKey].events.push(event);
    });

    // Ordena por data e por hora dentro de cada data
    return Object.values(groups)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map(group => ({
        ...group,
        events: group.events.sort((a, b) => {
          const timeA = safeParseDate(a.date)?.getHours() || 0;
          const timeB = safeParseDate(b.date)?.getHours() || 0;
          return timeA - timeB;
        })
      }));
  }, [events]);

  if (groupedEvents.length === 0) return null;

  return (
    <div className="space-y-20">
      {groupedEvents.map((group, idx) => (
        <div key={group.dateString} className="space-y-8">
          {/* Date Header */}
          <div className="flex items-center gap-4 sticky top-24 bg-white/90 backdrop-blur-md z-10 py-4 -mx-4 px-4 rounded-lg">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-1 h-8 bg-primary rounded-full" />
              <div>
                <h3 className="text-xl font-bold text-gray-900 capitalize">
                  {group.dateString}
                </h3>
                <span className="text-xs text-gray-500 font-medium">
                  {group.events.length} {group.events.length === 1 ? 'evento' : 'eventos'}
                </span>
              </div>
            </div>
          </div>

          {/* Events Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {group.events.slice(0, maxEventsPerDate).map((event) => (
              <div key={event.id} className="relative">
                <EventCardAirbnb event={event} />
              </div>
            ))}
          </div>

          {group.events.length > maxEventsPerDate && (
            <div className="flex justify-center pt-8">
              <button className="px-6 py-3 border-2 border-primary text-primary font-bold rounded-lg hover:bg-primary/5 transition-colors">
                +{group.events.length - maxEventsPerDate} mais eventos neste dia
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
