'use client';

import * as React from "react";
import { EventCard } from "@/components/events/EventCard";
import { AdsRenderer } from "@/components/ads/AdsRenderer";
import { type Coordinates } from "@/lib/location-utils";

interface HomeEventsGridProps {
  feed: any[];
  userLocation: Coordinates | null;
}

export function HomeEventsGrid({ feed, userLocation }: HomeEventsGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {feed.map((item: any, idx: number) => (
        item.type === 'ad' ? (
          <AdsRenderer 
            key={`ad-${idx}`} 
            location="home" 
            index={item.adIndex} 
            googleSlotId="home-feed-slot" 
          />
        ) : (
          <EventCard 
            key={item.data.id} 
            event={{ 
              ...item.data, 
              userLocation, 
              isSponsored: item.data.isSponsored 
            }} 
          />
        )
      ))}
    </div>
  );
}
