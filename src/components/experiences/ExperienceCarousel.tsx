
'use client';

import * as React from "react";
import { 
  Carousel, 
  CarouselContent, 
  CarouselItem, 
  CarouselNext, 
  CarouselPrevious 
} from "@/components/ui/carousel";
import { ExperienceCardPremium } from "./ExperienceCardPremium";
import { AdsRenderer } from "@/components/ads/AdsRenderer";

interface ExperienceCarouselProps {
  experiences: any[];
  ads?: any[];
  variant?: 'default' | 'sophisticated';
}

export function ExperienceCarousel({ experiences, ads = [], variant = 'default' }: ExperienceCarouselProps) {
  // Lógica de intercalação dinâmica (3 a 7)
  const items = React.useMemo(() => {
    const result: any[] = [];
    let adIdx = 0;
    
    // Inicia com um Ad
    if (ads.length > 0 && variant === 'default') {
      result.push({ type: 'ad', adIndex: adIdx % ads.length });
      adIdx++;
    }

    let expPointer = 0;
    const intervals = [3, 5, 4, 7, 6];
    let intervalPointer = 0;

    while (expPointer < experiences.length) {
      const currentInterval = intervals[intervalPointer % intervals.length];
      
      for (let i = 0; i < currentInterval && expPointer < experiences.length; i++) {
        result.push({ type: 'experience', data: experiences[expPointer] });
        expPointer++;
      }

      if (ads.length > 0 && expPointer < experiences.length) {
        result.push({ type: 'ad', adIndex: adIdx % ads.length });
        adIdx++;
        intervalPointer++;
      }
    }

    return result;
  }, [experiences, ads, variant]);

  if (experiences.length === 0) return null;

  return (
    <div className="relative container mx-auto px-6">
      <Carousel
        opts={{
          align: "start",
          loop: false,
        }}
        className="w-full overflow-visible"
      >
        <CarouselContent className="-ml-6 py-10">
          {items.map((item, idx) => (
            <CarouselItem key={idx} className="pl-6 basis-[85%] sm:basis-[45%] md:basis-[33%] lg:basis-[28%]">
              {item.type === 'ad' ? (
                <div className="h-full">
                  <AdsRenderer location="carousel" index={item.adIndex} googleSlotId="marketplace-carousel" />
                </div>
              ) : (
                <ExperienceCardPremium experience={item.data} />
              )}
            </CarouselItem>
          ))}
        </CarouselContent>
        <div className="hidden md:flex absolute -top-20 right-0 gap-2">
           <CarouselPrevious className="static translate-y-0 rounded-full h-12 w-12 border-muted bg-white hover:bg-secondary hover:text-white" />
           <CarouselNext className="static translate-y-0 rounded-full h-12 w-12 border-muted bg-white hover:bg-secondary hover:text-white" />
        </div>
      </Carousel>
    </div>
  );
}
