'use client';

import * as React from "react";
import { MapPin, Navigation, Sparkles, ArrowRight, Tag, BadgeCheck, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import Image from "next/image";
import { cn, normalizeText } from "@/lib/utils";
import { calculateDistanceMeters } from "@/lib/event-scoring-utils";
import { useCurrency, CurrencyCode } from "@/contexts/CurrencyContext";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { RichText } from "@/components/ui/rich-text";
import Link from "next/link";
import { format, isSameDay } from "date-fns";

interface ExperienceCardProps {
  experience: any;
  userLocation?: any;
  selectedDate?: Date;
  className?: string;
}

export function ExperienceCard({ experience, userLocation, selectedDate, className }: ExperienceCardProps) {
  const { formatPriceWithOriginal } = useCurrency();
  const db = useFirestore();
  const [nextSession, setNextSession] = React.useState<any>(null);
  const [loadingPrice, setLoadingPrice] = React.useState(true);
  const [isVisible, setIsVisible] = React.useState(true);

  React.useEffect(() => {
    if (!db || !experience.id) return;

    const fetchSessions = async () => {
      setLoadingPrice(true);
      try {
        const now = new Date();
        const nowStr = format(now, "yyyy-MM-dd'T'HH:mm");
        
        const q = query(
          collection(db, "experiences", experience.id, "slots"),
          where("status", "==", "active"),
          orderBy("datetime", "asc")
        );
        
        const snap = await getDocs(q);
        const slots = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        if (slots.length === 0) {
          setIsVisible(false);
          setLoadingPrice(false);
          return;
        }

        // Regra de Expiração: Some 30 min após o ÚLTIMO slot da série
        const lastSlot = [...slots].sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime())[0];
        const expirationTime = new Date(new Date(lastSlot.datetime).getTime() + 30 * 60000);
        if (now > expirationTime) {
          setIsVisible(false);
          setLoadingPrice(false);
          return;
        }

        // Filtro por data do calendário (se selecionada no pai)
        if (selectedDate) {
          const slotOnDay = slots.find(s => isSameDay(new Date(s.datetime), selectedDate));
          if (!slotOnDay) {
            setIsVisible(false);
            setLoadingPrice(false);
            return;
          }
          setNextSession(slotOnDay);
        } else {
          // Próximo slot futuro a partir de agora
          const future = slots.find(s => new Date(s.datetime) >= now);
          setNextSession(future || slots[0]);
          setIsVisible(true);
        }
      } catch (e) {
        console.warn("[ExperienceCard] Error loading sessions:", e);
      } finally {
        setLoadingPrice(false);
      }
    };

    fetchSessions();
  }, [db, experience.id, selectedDate]);

  const distanceMeters = React.useMemo(() => {
    if (userLocation && typeof experience.latitude === 'number' && typeof experience.longitude === 'number') {
      return calculateDistanceMeters(userLocation, { latitude: experience.latitude, longitude: experience.longitude });
    }
    return null;
  }, [userLocation, experience.latitude, experience.longitude]);

  const pricingDisplay = React.useMemo(() => {
    const currency = (experience.currency || 'BRL') as CurrencyCode;
    
    if (loadingPrice) {
       return <div className="h-6 w-20 bg-muted animate-pulse rounded-lg" />;
    }

    if (nextSession) {
      const price = nextSession.hasPromo ? nextSession.promoPrice : nextSession.price;
      if (price > 0) {
        return (
          <div className="flex flex-col items-end">
            <p className="text-[8px] font-black uppercase text-muted-foreground opacity-60 leading-none mb-1">A partir de</p>
            {formatPriceWithOriginal(price, currency)}
          </div>
        );
      }
      return <span className="text-green-600 font-black italic uppercase text-[10px]">Grátis</span>;
    }

    return <span className="text-muted-foreground font-black italic uppercase text-[10px]">Esgotado</span>;
  }, [nextSession, experience.currency, formatPriceWithOriginal, loadingPrice]);

  if (!isVisible) return null;

  const experienceUrl = `/${experience.organizer?.username || 'experiencia'}/experiencia/${experience.slug || experience.id}`;

  return (
    <Link 
      href={experienceUrl}
      className={cn(
        "group flex flex-col h-full overflow-hidden border-none shadow-md bg-card transition-all hover:-translate-y-1 hover:shadow-xl rounded-[2.5rem] cursor-pointer relative bg-white",
        className
      )}
    >
      <div className="relative aspect-[16/10] w-full bg-muted overflow-hidden shrink-0">
        {experience.image && (
          <Image 
            src={experience.image} 
            alt={experience.title} 
            fill 
            className="object-cover transition-transform duration-700 group-hover:scale-105" 
            unoptimized 
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
        
        <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
           <Badge className="bg-secondary text-white border-none shadow-lg px-3 py-1 text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 fill-current" /> Experiência
           </Badge>
        </div>

        <div className="absolute bottom-4 right-4 flex items-center gap-1.5 z-10">
          {experience.category && (
            <Badge className="bg-white/90 text-primary border-none shadow-md px-3 py-1.5 text-[9px] font-black uppercase flex items-center gap-1">
              <Tag className="w-2.5 h-2.5" /> {experience.category}
            </Badge>
          )}
          {distanceMeters !== null && (
            <Badge className="bg-white/95 text-secondary border-none shadow-md px-3 py-1.5 text-[10px] font-black uppercase flex items-center gap-1">
              <Navigation className="w-3 h-3 fill-secondary" /> {distanceMeters < 1000 ? `${distanceMeters} m` : `${(distanceMeters/1000).toFixed(1)} km`}
            </Badge>
          )}
        </div>
      </div>

      <CardContent className="p-6 flex flex-col flex-1 gap-4">
        <div className="space-y-1">
          <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary group-hover:text-secondary transition-colors leading-tight line-clamp-1">
            {experience.title}
          </h3>
          <div className="flex items-center gap-1.5">
             <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest line-clamp-1">
               {experience.organizer?.name || "Organizador"}
             </p>
             {(experience.organizer?.verified || experience.organizer?.isVerified) && (
               <BadgeCheck className="w-3.5 h-3.5 fill-blue-500 text-white shrink-0" />
             )}
          </div>
        </div>

        <div className="py-4 border-y border-dashed border-border/60">
           <div className="text-xs font-medium text-muted-foreground line-clamp-2 leading-relaxed italic">
             <RichText content={experience.shortDescription || "Descubra uma nova experiência cultural única com a Viby."} />
           </div>
        </div>

        <div className="flex items-center justify-between mt-auto">
           <div className="flex items-center gap-2">
              <div className="p-2 bg-muted rounded-xl text-secondary"><MapPin className="w-4 h-4" /></div>
              <span className="text-[10px] font-black uppercase text-primary truncate max-w-[120px]">{experience.city || "Sua Cidade"}</span>
           </div>
           <div className="text-right">
              {pricingDisplay}
           </div>
        </div>

        <div className="w-full h-11 flex items-center justify-center font-black bg-primary text-white rounded-2xl uppercase italic text-[10px] gap-2 shadow-lg group-hover:bg-secondary transition-colors shrink-0">
           Ver Disponibilidade <ArrowRight className="w-4 h-4" />
        </div>
      </CardContent>
    </Link>
  );
}
