
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

/**
 * Carrossel premium para experiências.
 * Intercala anúncios entre os cards seguindo o padrão de 3 a 7 itens.
 */
export function ExperienceCarousel({ experiences, ads = [], variant = 'default' }: ExperienceCarouselProps) {
  const items = React.useMemo(() => {
    const result: any[] = [];
    let adIdx = 0;
    
    // Inicia com um Ad obrigatoriamente
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
    <div className="relative w-full h-full">
      <Carousel
        opts={{
          align: "start",
          loop: false,
        }}
        className="w-full overflow-visible"
      >
        <div className="container mx-auto px-6 relative">
          <CarouselContent className="-ml-8 py-10">
            {items.map((item, idx) => (
              <CarouselItem key={idx} className="pl-8 basis-[85%] sm:basis-[45%] md:basis-[33%] lg:basis-[23.5%] h-full">
                {item.type === 'ad' ? (
                  <div className="h-full">
                    <AdsRenderer 
                      location="carousel" 
                      index={item.adIndex} 
                      googleSlotId="marketplace-carousel" 
                      variant="premium"
                    />
                  </div>
                ) : (
                  <ExperienceCardPremium experience={item.data} />
                )}
              </CarouselItem>
            ))}
          </CarouselContent>
          
          <div className="hidden md:flex absolute -top-20 right-6 gap-2">
             <CarouselPrevious className="static translate-y-0 rounded-full h-12 w-12 border-muted bg-white hover:bg-secondary hover:text-white transition-all shadow-sm" />
             <CarouselNext className="static translate-y-0 rounded-full h-12 w-12 border-muted bg-white hover:bg-secondary hover:text-white transition-all shadow-sm" />
          </div>
        </div>
      </Carousel>
    </div>
  );
}
