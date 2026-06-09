
"use client";

import * as React from "react";
import { EventCard } from "@/components/events/EventCard";
import { Sparkles, History } from "lucide-react";
import { type Coordinates } from "@/lib/location-utils";

interface OrganizerEventsProps {
  events: any[];
  title: string;
  isPast?: boolean;
  userLocation?: Coordinates | null;
}

export function OrganizerEvents({ events, title, isPast = false, userLocation }: OrganizerEventsProps) {
  return (
    <section className="space-y-8">
      <div className="space-y-1 px-2">
        <h2 className="text-3xl font-black uppercase italic tracking-tighter text-primary">{title}</h2>
        <p className="text-muted-foreground font-medium">
          {isPast ? "Reveja o que já aconteceu." : "Garanta seu lugar nas próximas experiências."}
        </p>
      </div>

      {events.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {events.map((event) => (
            <EventCard key={event.id} event={event} userLocation={userLocation} />
          ))}
        </div>
      ) : (
        <div className="py-24 text-center bg-white rounded-[3rem] border-2 border-dashed border-border/60 flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
            {isPast ? <History className="w-8 h-8 text-muted-foreground opacity-20" /> : <Sparkles className="w-8 h-8 text-muted-foreground opacity-20" />}
          </div>
          <p className="text-muted-foreground font-black uppercase tracking-widest text-[10px]">
            {isPast ? "Nenhum evento no histórico." : "Sem eventos agendados no momento."}
          </p>
        </div>
      )}
    </section>
  );
}
