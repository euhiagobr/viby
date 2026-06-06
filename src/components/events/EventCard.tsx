
"use client"

import * as React from "react"
import { Calendar, MapPin, Clock, Ticket, Navigation, Megaphone, BadgeCheck, Zap, ArrowRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { calculateDistance, type Coordinates } from "@/lib/location-utils"
import { useFirestore, useDoc, useAuth, useUser } from "@/firebase"
import { doc } from "firebase/firestore"
import { AgeRatingBadge } from "@/lib/age-rating"
import { EventInterest } from "./EventInterest"
import { getVersionedImageUrl } from "@/lib/image-utils"
import { useCurrency } from "@/contexts/CurrencyContext"
import { useTranslation } from "@/i18n/i18n-context"

function VerifiedBadge({ className }: { className?: string }) {
  return (
    <BadgeCheck className={cn("w-3.5 h-3.5 fill-blue-500 text-white", className)} />
  )
}

interface EventCardProps {
  event: any 
  userLocation?: Coordinates | null
  isSponsored?: boolean
}

export function EventCard({ event, userLocation, isSponsored }: EventCardProps) {
  const router = useRouter()
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  const { formatPrice } = useCurrency()
  const { t } = useTranslation()
  const cardRef = React.useRef<HTMLDivElement>(null)
  const hasTrackedImpression = React.useRef(false)

  const adId = event.adId;

  const [liveStatus, setLiveStatus] = React.useState<{ label: string; colorClass: string; icon?: any } | null>(null);

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

  const isEnded = React.useMemo(() => {
    const now = new Date();
    return eventDates.end < now;
  }, [eventDates.end]);

  React.useEffect(() => {
    const update = () => {
      const now = new Date();
      const { start, end } = eventDates;

      const hasEnded = end < now;
      const diffStart = start.getTime() - now.getTime();
      const isToday = now.toDateString() === start.toDateString();

      if (hasEnded) {
        setLiveStatus({ label: t('event.finished'), colorClass: "bg-muted text-muted-foreground border-none" });
      } else if (now >= start && now < end) {
        setLiveStatus({ label: t('event.live_now'), colorClass: "bg-green-600 animate-pulse text-white shadow-lg shadow-green-500/20", icon: Zap });
      } else if (diffStart <= 2 * 60 * 60 * 1000 && diffStart > 0) {
        setLiveStatus({ label: t('event.starting_soon'), colorClass: "bg-secondary text-white shadow-lg shadow-secondary/20", icon: Clock });
      } else if (isToday) {
        setLiveStatus({ label: t('event.today'), colorClass: "bg-secondary text-white" });
      } else {
        setLiveStatus(null);
      }
    };

    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [eventDates, t]);

  React.useEffect(() => {
    if (!isSponsored || !adId || hasTrackedImpression.current) return

    const observer = new IntersectionObserver(
      async (entries) => {
        if (entries[0].isIntersecting && !hasTrackedImpression.current) {
          hasTrackedImpression.current = true
          
          fetch('/api/ads/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              adId,
              eventType: 'impression',
              userId: user?.uid || null
            })
          }).catch(() => {});
          
          observer.disconnect()
        }
      },
      { threshold: 0.5 }
    )

    if (cardRef.current) observer.observe(cardRef.current)
    return () => observer.disconnect()
  }, [isSponsored, adId, user?.uid]);

  const formatDate = (dateValue: any) => {
    if (!dateValue) return t('common.loading');
    try {
      let d: Date;
      if (dateValue.toDate) {
        d = dateValue.toDate();
      } else {
        d = new Date(dateValue);
      }
      if (isNaN(d.getTime())) return t('common.loading');
      return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
    } catch (e) { return t('common.loading'); }
  };

  const formatTime = (dateValue: any) => {
    if (!dateValue) return "";
    try {
      let d: Date;
      if (dateValue.toDate) {
        d = dateValue.toDate();
      } else {
        d = new Date(dateValue);
      }
      if (isNaN(d.getTime())) return "";
      return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return ""; }
  };

  const distance = React.useMemo(() => {
    if (userLocation && typeof event.latitude === 'number' && typeof event.longitude === 'number') {
      return calculateDistance(userLocation, { latitude: event.latitude, longitude: event.longitude });
    }
    return null;
  }, [userLocation, event.latitude, event.longitude]);

  const handleCardClick = () => {
    if (isSponsored && adId) {
      fetch('/api/ads/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adId,
          eventType: 'click',
          userId: user?.uid || null
        })
      }).catch(() => {});
    }
    router.push(`/${event.organizer?.username || 'evento'}/${event.id}`)
  }

  const minPrice = React.useMemo(() => {
    if (!event.batches || event.batches.length === 0) return 0;
    let min = Infinity;
    event.batches.forEach((b: any) => {
      b.ticketTypes?.forEach((t: any) => {
        if (t.price < min) min = t.price;
      });
    });
    return min === Infinity ? 0 : min;
  }, [event.batches]);

  const versionedImageUrl = getVersionedImageUrl(event.image, event.imageVersion);

  return (
    <Card 
      ref={cardRef}
      className={cn(
        "group overflow-hidden border-none shadow-lg bg-card transition-all hover:-translate-y-2 hover:shadow-2xl rounded-[2rem] cursor-pointer relative",
        isSponsored && "ring-2 ring-secondary/20",
        isEnded && "opacity-60 grayscale"
      )}
      onClick={handleCardClick}
    >
      {isSponsored && !isEnded && (
        <div className="absolute top-0 right-0 z-20">
          <Badge className="bg-primary text-white rounded-none rounded-bl-2xl font-black text-[9px] uppercase px-4 py-2 flex items-center gap-1.5 shadow-lg">
            <Megaphone className="w-3 h-3 text-secondary fill-secondary" /> {t('event.sponsored')}
          </Badge>
        </div>
      )}

      <div className="relative h-56 w-full bg-muted">
        <Image
          src={versionedImageUrl || `https://picsum.photos/seed/${event.id}/600/400`}
          alt={event.title}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover transition-transform duration-700 group-hover:scale-110"
        />
        
        <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
          {liveStatus && (
            <Badge className={cn("border-none shadow-xl px-4 py-1.5 text-[10px] font-black uppercase tracking-widest flex items-center gap-2", liveStatus.colorClass)}>
              {liveStatus.icon && <liveStatus.icon className="w-3.5 h-3.5" />}
              {liveStatus.label}
            </Badge>
          )}
          {!isEnded && (
            <div className="flex items-center gap-2">
               <AgeRatingBadge code={event.ageRating?.code || "free"} className="bg-white/95 p-1.5 rounded-xl shadow-lg" />
               <Badge className="bg-white/90 text-primary border-none shadow-lg px-4 py-1.5 text-[10px] font-black uppercase tracking-widest">
                 {event.categoryName || "Geral"}
               </Badge>
            </div>
          )}
        </div>

        {distance !== null && !isEnded && (
          <div className="absolute bottom-4 right-4">
            <Badge className="bg-white/95 text-secondary border-none shadow-2xl px-4 py-2 text-[11px] font-black uppercase flex items-center gap-1.5 ring-2 ring-secondary/10">
              <Navigation className="w-3.5 h-3.5 fill-secondary" />
              {distance < 1 ? `${(distance * 1000).toFixed(0)}m` : `${distance.toFixed(1)}km`}
            </Badge>
          </div>
        )}
      </div>

      <CardContent className="p-6 space-y-4">
        <div className="space-y-1">
          <div className="flex justify-between items-start gap-2">
            <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary group-hover:text-secondary transition-colors line-clamp-1 leading-tight">
              {event.title}
            </h3>
            <EventInterest event={event} showButton={false} variant="compact" />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest line-clamp-1">
              {event.organizer?.name}
            </p>
            {minPrice > 0 ? (
               <span className="text-[10px] font-black text-secondary uppercase italic">{t('event.from')} {formatPrice(minPrice)}</span>
            ) : (
               <span className="text-[10px] font-black text-green-600 uppercase italic">{t('event.no_tickets')}</span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-dashed border-border/60">
           <div className="flex flex-col gap-0.5">
              <p className="text-[9px] font-black uppercase text-muted-foreground opacity-60">{t('event.when')}</p>
              <div className="flex items-center gap-1.5 text-xs font-black text-primary">
                 <Calendar className="w-3.5 h-3.5 text-secondary" />
                 {formatDate(event.date)}
                 <span className="opacity-30 mx-1">|</span>
                 <Clock className="w-3.5 h-3.5 text-secondary" />
                 {formatTime(event.date)}
              </div>
           </div>
           <div className="text-right">
              <p className="text-[9px] font-black uppercase text-muted-foreground opacity-60">{t('event.where')}</p>
              <div className="flex items-center justify-end gap-1.5 text-xs font-black text-primary">
                 <MapPin className="w-3.5 h-3.5 text-secondary" />
                 <span className="truncate max-w-[120px]">{event.city}</span>
              </div>
           </div>
        </div>

        <Button className="w-full h-12 bg-primary text-white font-black rounded-2xl uppercase italic text-[11px] gap-2 shadow-lg transition-all group-hover:bg-secondary group-hover:scale-[1.02]">
           {t('event.guarantee_presence')} <ArrowRight className="w-4 h-4" />
        </Button>
      </CardContent>
    </Card>
  )
}
