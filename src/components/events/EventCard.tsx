
"use client"

import * as React from "react"
import { Calendar, MapPin, Clock, Navigation, Megaphone, BadgeCheck, Zap, ArrowRight, Tag } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { calculateDistance, type Coordinates } from "@/lib/location-utils"
import { useFirestore, useAuth, useUser } from "@/firebase"
import { AgeRatingBadge } from "@/lib/age-rating"
import { EventInterest } from "./EventInterest"
import { getVersionedImageUrl } from "@/lib/image-utils"
import { useCurrency } from "@/contexts/CurrencyContext"
import { useTranslation } from "@/i18n/i18n-context"

interface EventCardProps {
  event: any 
  userLocation?: Coordinates | null
  isSponsored?: boolean
}

export function EventCard({ event, userLocation, isSponsored }: EventCardProps) {
  const router = useRouter()
  const { user } = useUser(useAuth())
  const { formatPriceWithOriginal } = useCurrency()
  const { t } = useTranslation()
  const cardRef = React.useRef<HTMLDivElement>(null)

  const [liveStatus, setLiveStatus] = React.useState<{ label: string; colorClass: string; icon?: any } | null>(null);
  const [currentDisplayPrice, setCurrentDisplayPrice] = React.useState<any>(null);

  const eventDates = React.useMemo(() => {
    const parseDate = (val: any) => {
      if (!val) return null;
      if (val.toDate) return val.toDate();
      const d = new Date(val);
      return isNaN(d.getTime()) ? null : d;
    };
    const start = parseDate(event.date) || new Date();
    const end = parseDate(event.endDate) || new Date(start.getTime() + 4 * 60 * 60 * 1000);
    return { start, end };
  }, [event.date, event.endDate]);

  const isEnded = React.useMemo(() => eventDates.end < new Date(), [eventDates.end]);

  React.useEffect(() => {
    const update = () => {
      const now = new Date();
      const { start, end } = eventDates;
      const diffStart = start.getTime() - now.getTime();
      const isToday = now.toDateString() === start.toDateString();

      if (end < now) {
        setLiveStatus({ label: t('event.finished'), colorClass: "bg-muted text-muted-foreground border-none" });
      } else if (now >= start && now < end) {
        setLiveStatus({ label: t('event.live_now'), colorClass: "bg-green-600 animate-pulse text-white shadow-lg", icon: Zap });
      } else if (diffStart <= 2 * 60 * 60 * 1000 && diffStart > 0) {
        setLiveStatus({ label: t('event.starting_soon'), colorClass: "bg-secondary text-white shadow-lg", icon: Clock });
      } else if (isToday) {
        setLiveStatus({ label: t('event.today'), colorClass: "bg-secondary text-white" });
      } else {
        setLiveStatus(null);
      }

      if (event.type === 'divulgacao' && event.disclosurePrices?.length > 0) {
        let activePrice = null;
        let lastLimit = new Date(start.getTime());

        for (const p of event.disclosurePrices) {
          const [h, m] = p.untilTime.split(':').map(Number);
          let limitDate = new Date(lastLimit.getTime());
          limitDate.setHours(h, m, 0, 0);

          if (limitDate <= lastLimit) {
            limitDate.setDate(limitDate.getDate() + 1);
          }

          if (now < limitDate) {
            activePrice = p;
            break;
          }
          lastLimit = limitDate;
        }

        setCurrentDisplayPrice(activePrice || event.disclosurePrices[event.disclosurePrices.length - 1]);
      }
    };
    
    update();
    const interval = setInterval(update, 10000); 
    return () => clearInterval(interval);
  }, [eventDates, t, event.disclosurePrices, event.type]);

  const distance = React.useMemo(() => {
    if (userLocation && typeof event.latitude === 'number' && typeof event.longitude === 'number') {
      const distanceKm = calculateDistance(userLocation, { latitude: event.latitude, longitude: event.longitude });
      return distanceKm;
    }
    return null;
  }, [userLocation, event.latitude, event.longitude]);

  const pricingDisplay = React.useMemo(() => {
    if (event.type === 'divulgacao') {
      if (!currentDisplayPrice) {
        return <span className="text-green-600 font-black italic uppercase text-[10px]">{t('event.no_tickets')}</span>;
      }

      return (
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-1">
             {formatPriceWithOriginal(currentDisplayPrice.price, event.currency || 'BRL')}
          </div>
          <div className="flex items-center gap-1 text-[8px] font-black uppercase text-muted-foreground opacity-60">
             <Clock className="w-2.5 h-2.5" /> Até {currentDisplayPrice.untilTime}
          </div>
        </div>
      );
    }

    if (!event.batches || event.batches.length === 0) return <span className="text-green-600 italic uppercase text-xs">{t('event.no_tickets')}</span>;
    
    let min = Infinity;
    event.batches.forEach((b: any) => {
      b.ticketTypes?.forEach((t: any) => {
        if (t.price < min) min = t.price;
      });
    });
    
    if (min === Infinity || min <= 0) return <span className="text-green-600 italic uppercase text-xs">{t('event.no_tickets')}</span>;
    
    return (
      <div className="flex flex-col items-end">
        <p className="text-[9px] font-black uppercase text-muted-foreground opacity-60 leading-none mb-1">{t('event.from')}</p>
        {formatPriceWithOriginal(min, event.currency || 'BRL')}
      </div>
    );
  }, [event, t, formatPriceWithOriginal, currentDisplayPrice]);

  const versionedImageUrl = getVersionedImageUrl(event.image, event.imageVersion);
  const displayCategory = event.categoryName || event.category || event.categoryLabel || event.categoria;

  return (
    <Card 
      ref={cardRef}
      className={cn(
        "group overflow-hidden border-none shadow-md bg-card transition-all hover:-translate-y-1 hover:shadow-xl rounded-2xl cursor-pointer relative",
        isSponsored && "ring-1 ring-secondary/20",
        isEnded && "opacity-60 grayscale"
      )}
      onClick={() => router.push(`/${event.organizer?.username || 'evento'}/${event.id}`)}
    >
      {isSponsored && !isEnded && (
        <div className="absolute top-0 right-0 z-20">
          <Badge className="bg-primary text-white rounded-none rounded-bl-xl font-black text-[8px] uppercase px-3 py-1.5 flex items-center gap-1 shadow-lg">
            <Megaphone className="w-2.5 h-2.5 text-secondary fill-secondary" /> {t('event.sponsored')}
          </Badge>
        </div>
      )}

      <div className="relative h-48 w-full bg-muted">
        <Image src={versionedImageUrl || `https://picsum.photos/seed/${event.id}/600/400`} alt={event.title} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover transition-transform duration-700 group-hover:scale-105" unoptimized />
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
          {liveStatus && (
            <Badge className={cn("border-none shadow-md px-3 py-1 text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5", liveStatus.colorClass)}>
              {liveStatus.icon && <liveStatus.icon className="w-3 h-3" />} {liveStatus.label}
            </Badge>
          )}
          {!isEnded && (
            <div className="flex items-center gap-1.5">
               <AgeRatingBadge code={event.ageRating?.code || "free"} className="bg-white/95 p-1 rounded-lg shadow-md" />
            </div>
          )}
        </div>
        
        {!isEnded && (
          <div className="absolute bottom-3 right-3 flex items-center gap-1.5 z-10">
            {displayCategory && (
              <Badge className="bg-white/90 text-primary border-none shadow-md px-3 py-1.5 text-[9px] font-black uppercase flex items-center gap-1">
                <Tag className="w-2.5 h-2.5" /> {displayCategory}
              </Badge>
            )}
            {distance !== null && (
              <Badge className="bg-white/95 text-secondary border-none shadow-md px-3 py-1.5 text-[10px] font-black uppercase flex items-center gap-1">
                <Navigation className="w-3 h-3 fill-secondary" /> {distance < 1 ? `${(distance * 1000).toFixed(0)}m` : `${distance.toFixed(1)}km`}
              </Badge>
            )}
          </div>
        )}
      </div>

      <CardContent className="p-5 space-y-4">
        <div className="space-y-1">
          <div className="flex justify-between items-start gap-2">
            <h3 className="text-lg font-black uppercase italic tracking-tighter text-primary group-hover:text-secondary transition-colors line-clamp-1 leading-tight">{event.title}</h3>
            <EventInterest event={event} showButton={false} variant="compact" />
          </div>
          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest line-clamp-1">{event.organizer?.name}</p>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-dashed border-border/60">
           <div className="flex flex-col gap-0.5">
              <p className="text-[8px] font-black uppercase text-muted-foreground opacity-60">{t('event.when')}</p>
              <div className="flex items-center gap-1 text-[11px] font-black text-primary">
                 <Calendar className="w-3 h-3 text-secondary" />
                 {eventDates.start.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
                 <span className="mx-0.5 opacity-20">|</span>
                 <Clock className="w-3 h-3 text-secondary/80" />
                 {eventDates.start.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
              </div>
           </div>
           <div className="text-right">
              {pricingDisplay}
           </div>
        </div>

        <Button className="w-full h-10 bg-primary text-white font-black rounded-xl uppercase italic text-[10px] gap-2 shadow-md group-hover:bg-secondary">
           {event.type === 'divulgacao' ? "Ver Detalhes" : t('event.guarantee_presence')} <ArrowRight className="w-3.5 h-3.5" />
        </Button>
      </CardContent>
    </Card>
  )
}
