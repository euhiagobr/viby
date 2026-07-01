
'use client';

import * as React from "react";
import { MapPin, Star, BadgeCheck, Zap, Heart, Info, Clock, CheckCircle2, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useCurrency, CurrencyCode } from "@/contexts/CurrencyContext";
import { useFirestore } from "@/firebase";
import { collection, query, where, orderBy, getDocs, limit } from "firebase/firestore";
import Link from "next/link";
import { RichText } from "@/components/ui/rich-text";

interface ExperienceCardPremiumProps {
  experience: any;
  userLocation?: any;
}

export function ExperienceCardPremium({ experience }: ExperienceCardPremiumProps) {
  const { formatPriceWithOriginal } = useCurrency();
  const db = useFirestore();
  const [minPrice, setMinPrice] = React.useState<number | null>(null);
  const [isAvailableToday, setIsAvailableToday] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!db || !experience.id) return;

    const fetchPriceAndStatus = async () => {
      try {
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        
        const q = query(
          collection(db, "experiences", experience.id, "slots"),
          where("status", "==", "active"),
          orderBy("datetime", "asc"),
          limit(50)
        );
        
        const snap = await getDocs(q);
        const slots = snap.docs.map(d => d.data());

        if (slots.length > 0) {
          const prices = slots.map((s: any) => s.hasPromo ? s.promoPrice : s.price);
          setMinPrice(Math.min(...prices));
          setIsAvailableToday(slots.some((s: any) => s.datetime.startsWith(todayStr)));
        }
      } catch (e) {
        console.warn("[ExperienceCardPremium] Error:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchPriceAndStatus();
  }, [db, experience.id]);

  const rating = experience.averageRating || 5.0;
  const reviewCount = experience.reviewCount || 0;

  const experienceUrl = `/${experience.organizer?.username || 'experiencia'}/experiencia/${experience.slug || experience.id}`;

  return (
    <Link 
      href={experienceUrl}
      className="group block relative w-full h-full animate-in fade-in"
    >
      <div className="flex flex-col h-full bg-white transition-all duration-500 ease-in-out group-hover:translate-y-[-4px]">
        {/* IMAGE CONTAINER */}
        <div className="relative aspect-[4/5] w-full rounded-[2.5rem] overflow-hidden bg-muted shadow-sm group-hover:shadow-2xl transition-all duration-500">
          {experience.image && (
            <Image 
              src={experience.image} 
              alt={experience.title} 
              fill 
              className="object-cover transition-transform duration-1000 group-hover:scale-105" 
              unoptimized 
            />
          )}
          
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/10 opacity-60" />

          {/* BADGES */}
          <div className="absolute top-5 left-5 flex flex-col gap-2 z-10">
            {isAvailableToday && (
              <Badge className="bg-green-500/90 backdrop-blur-md text-white border-none shadow-xl px-3 py-1 text-[9px] font-black uppercase tracking-widest">
                Disponível Hoje
              </Badge>
            )}
            {experience.isFeatured && (
              <Badge className="bg-secondary/90 backdrop-blur-md text-white border-none shadow-xl px-3 py-1 text-[9px] font-black uppercase tracking-widest">
                Mais Reservado
              </Badge>
            )}
          </div>

          <button className="absolute top-5 right-5 p-2 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white hover:text-red-500 transition-all z-10 shadow-lg" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
             <Heart className="w-5 h-5" />
          </button>

          <div className="absolute bottom-5 left-5 right-5 flex justify-between items-end z-10">
             <div className="flex items-center gap-2 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full shadow-lg border border-white/20">
                <Star className="w-3 h-3 fill-orange-400 text-orange-400" />
                <span className="text-[10px] font-black text-primary">{Number(rating).toFixed(1)} <span className="opacity-40 font-bold">({reviewCount})</span></span>
             </div>
          </div>
        </div>

        {/* CONTENT */}
        <div className="py-6 px-2 space-y-3">
          <div className="flex items-center justify-between gap-4">
             <span className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary">{experience.category || "Experiência"}</span>
             <div className="flex items-center gap-1.5 max-w-[150px]">
                <span className="text-[9px] font-bold text-muted-foreground uppercase truncate">{experience.organizer?.name}</span>
                {(experience.organizer?.verified || experience.organizer?.isVerified) && <BadgeCheck className="w-3.5 h-3.5 fill-blue-500 text-white shrink-0" />}
             </div>
          </div>

          <h3 className="text-xl md:text-2xl font-black uppercase italic tracking-tighter text-primary leading-tight line-clamp-2">
            {experience.title}
          </h3>

          <div className="text-xs text-muted-foreground line-clamp-2 leading-relaxed italic">
             <RichText content={experience.shortDescription || ""} />
          </div>

          <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
             <MapPin className="w-3 h-3 text-secondary" /> {experience.city}
          </div>

          <div className="pt-2 flex items-end justify-between">
             <div className="flex flex-col">
                <p className="text-[9px] font-black uppercase text-muted-foreground opacity-60 leading-none mb-1">A partir de</p>
                {loading ? (
                   <div className="h-6 w-20 bg-muted animate-pulse rounded-lg" />
                ) : minPrice !== null ? (
                  <div className="text-lg font-black text-primary italic uppercase tracking-tighter">
                     {minPrice === 0 ? "Grátis" : formatPriceWithOriginal(minPrice, (experience.currency || 'BRL') as CurrencyCode)}
                  </div>
                ) : (
                  <div className="text-[10px] font-black text-secondary uppercase italic">Consulte horários</div>
                )}
             </div>
             <Button variant="ghost" size="icon" className="rounded-full bg-muted/50 hover:bg-secondary hover:text-white transition-all">
                <ArrowRight className="w-4 h-4" />
             </Button>
          </div>
        </div>
      </div>
    </Link>
  );
}
