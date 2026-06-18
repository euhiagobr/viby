"use client"

import * as React from "react"
import { Calendar, MapPin, Clock, Navigation, Megaphone, BadgeCheck, Zap, ArrowRight, Tag, RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { cn, safeParseDate } from "@/lib/utils"
import { type Coordinates } from "@/lib/location-utils"
import { calculateDistanceMeters, isEventVisible } from "@/lib/event-scoring-utils"
import { useAuth, useUser } from "@/firebase"
import { AgeRatingBadge } from "@/lib/age-rating"
import { EventInterest } from "./EventInterest"
import { getVersionedImageUrl } from "@/lib/image-utils"
import { useCurrency } from "@/contexts/CurrencyContext"
import { useTranslation } from "@/i18n/i18n-context"
import Link from "next/link"
import { slugify } from "@/lib/slug-utils"

const VIBY_OFFICIAL_UID = "dd9665af-ad6d-405c-a51d-08220fecf96f";

interface EventCardProps {
  event: any 
  userLocation?: Coordinates | null
  isSponsored?: boolean
}

export function EventCard({ event, userLocation, isSponsored }: EventCardProps) {
  const router = useRouter()
  const { user } = useUser(useAuth())
  const { formatPriceWithOriginal } = useCurrency()
  const { t, language } = useTranslation()

  const [mounted, setMounted] = React.useState(false);
  const [liveStatus, setLiveStatus] = React.useState<{ label: string; colorClass: string; icon?: any } | null>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const eventDates = React.useMemo(() => {
    const start = safeParseDate(event.date) || new Date();
    let end = safeParseDate(event.endDate);
    
    if (end && start && end <= start) {
      if (start.toDateString() === end.toDateString()) {
        end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
      }
    }

    if (!end && start) {
      end = new Date(start.getTime() + 4 * 60 * 60 * 1000);
    }
    
    return { start, end: end || start };
  }, [event.date, event.endDate]);

  const isEnded = React.useMemo(() => {
    if (!mounted) return false;
    
    // Se for recorrente, só consideramos encerrado se a DATA FINAL DA SÉRIE já passou
    if (event.isRecurring && event.recurringEndDate) {
      const seriesEnd = safeParseDate(event.recurringEndDate);
      if (seriesEnd) {
        const seriesThreshold = new Date(seriesEnd.getTime() + 6 * 60 * 60 * 1000);
        if (new Date() < seriesThreshold) return false;
      }
    }

    const threshold = new Date(eventDates.end.getTime() + 6 * 60 * 60 * 1000);
    return new Date() > threshold;
  }, [eventDates.end, mounted, event.isRecurring, event.recurringEndDate]);

  const isCuradoria = event.curationType === 'curadoria' || 
                      event.curatorProfile === 'viby' || 
                      (event.organizationId === VIBY_OFFICIAL_UID && (event.type === 'divulgacao' || event.type === 'externo'));

  React.useEffect(() => {
    if (!mounted) return;
    const update = () => {
      const now = new Date();
      const { start, end } = eventDates;
      
      const diffStart = start.getTime() - now.getTime();
      const isToday = now.toDateString() === start.toDateString();

      if (isEnded) {
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
    };
    
    update();
    const interval = setInterval(update, 30000); 
    return () => clearInterval(interval);
  }, [eventDates, t, mounted, isEnded]);

  const distanceMeters = React.useMemo(() => {
    if (userLocation && typeof event.latitude === 'number' && typeof event.longitude === 'number') {
      return calculateDistanceMeters(userLocation, { latitude: event.latitude, longitude: event.longitude });
    }
    return null;
  }, [userLocation, event.latitude, event.longitude]);

  const pricingDisplay = React.useMemo(() => {
    const currency = event.currency || 'BRL';

    if (event.type === 'externo' && !event.startingPrice) {
      return <span className="text-secondary font-black italic uppercase text-[10px]">{t('event.under_consultation')}</span>;
    }

    if (event.type === 'divulgacao' || event.type === 'externo' || isCuradoria) {
      if (typeof event.startingPrice === 'number' && event.startingPrice > 0) {
        return (
          <div className="flex flex-col items-end">
            <p className="text-[9px] font-black uppercase text-muted-foreground opacity-60 leading-none mb-1">{t('event.from')}</p>
            {formatPriceWithOriginal(event.startingPrice, currency)}
          </div>
        );
      } else if (event.startingPrice === 0) {
        return <span className="text-green-600 font-black italic uppercase text-[10px]">{t('event.free')}</span>;
      }
      return <span className="text-green-600 font-black italic uppercase text-[10px]">{t('event.free')}</span>;
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
        {formatPriceWithOriginal(min, currency)}
      </div>
    );
  }, [event, t, formatPriceWithOriginal, isCuradoria]);

  const versionedImageUrl = getVersionedImageUrl(event.image, event.imageVersion);
  const displayCategory = event.categoryName || event.category || event.categoryLabel || event.categoria;
  
  // GARANTIA DE URL CANÔNICA: /username/slug (Nunca usar ID)
  const slug = event.slug || slugify(event.title || 'evento');
  const username = event.organizer?.username || 'evento';
  const canonicalPath = `/${username}/${slug}`;

  return (
    <Link 
      href={canonicalPath}
      className={cn(
        "group flex flex-col h-full overflow-hidden border-none shadow-md bg-card transition-all hover:-translate-y-1 hover:shadow-xl rounded-2xl cursor-pointer relative",
        isSponsored && "ring-1 ring-secondary/20",
        isEnded && "opacity-60 grayscale"
      )}
    >
      <Card className="flex flex-col h-full border-none shadow-none bg-transparent">
        {isSponsored && !isEnded && (
          <div className="absolute top-0 right-0 z-20">
            <Badge className="bg-primary text-white rounded-none rounded-bl-xl font-black text-[8px] uppercase px-3 py-1.5 flex items-center gap-1 shadow-lg">
              <Megaphone className="w-2.5 h-2.5 text-secondary fill-secondary" /> {t('event.sponsored')}
            </Badge>
          </div>
        )}

        <div className="relative aspect-[16/10] w-full bg-muted overflow-hidden shrink-0">
          <Image src={versionedImageUrl || `https://picsum.photos/seed/${event.id}/600/400`} alt={event.title} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover transition-transform duration-700 group-hover:scale-105" unoptimized />
          <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
            {liveStatus && (
              <Badge className={cn("border-none shadow-md px-3 py-1 text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5", liveStatus.colorClass)}>
                {liveStatus.icon && <liveStatus.icon className="w-3 h-3" />} {liveStatus.label}
              </Badge>
            )}
            {!isEnded && (
              <div className="flex items-center gap-1.5">
                 <AgeRatingBadge code={event.ageRating?.code || "free"} className="bg-white/90 p-1.5 rounded-lg shadow-md" />
                 {event.isRecurring && (
                   <Badge className="bg-secondary text-white border-none shadow-md px-1.5 h-5">
                      <RefreshCw className="w-2.5 h-2.5 animate-spin-slow" />
                   </Badge>
                 )}
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
              {distanceMeters !== null && (
                <Badge className="bg-white/95 text-secondary border-none shadow-md px-3 py-1.5 text-[10px] font-black uppercase flex items-center gap-1">
                  <Navigation className="w-3 h-3 fill-secondary" /> {distanceMeters < 1000 ? `${distanceMeters} m` : `${(distanceMeters/1000).toFixed(1)} km`}
                </Badge>
              )}
            </div>
          )}
        </div>

        <CardContent className="p-5 flex flex-col flex-1 gap-4">
          <div className="space-y-1">
            <div className="flex justify-between items-start gap-2">
              <h3 className="text-lg font-black uppercase italic tracking-tighter text-primary group-hover:text-secondary transition-colors line-clamp-1 leading-tight">{event.title}</h3>
              <EventInterest event={event} showButton={false} variant="compact" />
            </div>
            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest line-clamp-1">{event.organizer?.name}</p>
          </div>

          <div className="flex items-center justify-between pt-3 mt-auto border-t border-dashed border-border/60">
             <div className="flex flex-col gap-0.5">
                <p className="text-[8px] font-black uppercase text-muted-foreground opacity-60">{t('event.when')}</p>
                <div className="flex items-center gap-1 text-[11px] font-black text-primary">
                   <Calendar className="w-3 h-3 text-secondary" />
                   <span className="whitespace-nowrap">{eventDates.start.toLocaleDateString(language, { day: '2-digit', month: 'short' })}</span>
                   <span className="mx-0.5 opacity-20">|</span>
                   <Clock className="w-3 h-3 text-secondary/80" />
                   {eventDates.start.toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' })}
                </div>
             </div>
             <div className="text-right">
                {pricingDisplay}
             </div>
          </div>

          <div className="w-full h-10 bg-primary text-white flex items-center justify-center font-black rounded-xl uppercase italic text-[10px] gap-2 shadow-md group-hover:bg-secondary shrink-0">
             {isCuradoria ? "Ver Detalhes" : t('event.guarantee_presence')} <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
