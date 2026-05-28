"use client"

import * as React from "react"
import { Calendar, MapPin, Clock, Ticket, Navigation, Megaphone, BadgeCheck, Zap, ArrowRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { calculateDistance, type Coordinates } from "@/lib/location-utils"
import { useFirestore, useDoc, useCollection, useMemoFirebase, useAuth, useUser } from "@/firebase"
import { doc, updateDoc, increment, serverTimestamp, getDoc, setDoc } from "firebase/firestore"
import { AgeRatingBadge } from "@/lib/age-rating"

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
  const cardRef = React.useRef<HTMLDivElement>(null)
  const hasTrackedImpression = React.useRef(false)

  const adId = event.adId;

  const userDocRef = React.useMemo(() => (db && user) ? doc(db, "users", user.uid) : null, [db, user])
  const { data: userProfile } = useDoc<any>(userDocRef)

  const adsSettingsRef = React.useMemo(() => db ? doc(db, 'settings', 'ads') : null, [db])
  const { data: adsSettings } = useDoc<any>(adsSettingsRef)
  
  const [liveStatus, setLiveStatus] = React.useState<{ label: string; colorClass: string; icon?: any } | null>(null);

  const eventDates = React.useMemo(() => {
    const start = event.date?.toDate ? event.date.toDate() : new Date(event.date);
    const end = event.endDate?.toDate ? event.endDate.toDate() : (event.endDate ? new Date(event.endDate) : new Date(start.getTime() + 4 * 60 * 60 * 1000));
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
        setLiveStatus({ label: "Finalizado", colorClass: "bg-muted text-muted-foreground border-none" });
      } else if (now >= start && now < end) {
        setLiveStatus({ label: "Acontecendo agora", colorClass: "bg-green-600 animate-pulse text-white shadow-lg shadow-green-500/20", icon: Zap });
      } else if (diffStart <= 2 * 60 * 60 * 1000 && diffStart > 0) {
        setLiveStatus({ label: "Começa em breve", colorClass: "bg-secondary text-white shadow-lg shadow-secondary/20", icon: Clock });
      } else if (isToday) {
        setLiveStatus({ label: "Hoje", colorClass: "bg-secondary text-white" });
      } else {
        setLiveStatus(null);
      }
    };

    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [eventDates]);

  const getAgeGroup = (birthDate: string) => {
    if (!birthDate) return "desconhecido";
    try {
      const birth = new Date(birthDate);
      const age = new Date().getFullYear() - birth.getFullYear();
      if (age <= 18) return "0_18";
      if (age <= 24) return "19_24";
      if (age <= 30) return "25_30";
      if (age <= 34) return "31_34";
      if (age <= 40) return "35_40";
      if (age <= 44) return "41_44";
      if (age <= 50) return "45_50";
      if (age <= 75) return "51_75";
      return "75plus";
    } catch (e) { return "desconhecido"; }
  }

  const getDemographicsUpdate = () => {
    const update: any = {}
    if (userProfile) {
      const rawGender = (userProfile.gender || "desconhecido").toLowerCase().trim();
      const ageGroup = getAgeGroup(userProfile.birthDate);
      
      let genderKey = 'desconhecido';
      if (rawGender === 'masculino') genderKey = 'masculino';
      else if (rawGender === 'feminino') genderKey = 'feminino';
      else if (rawGender === 'homem trans') genderKey = 'homem_trans';
      else if (rawGender === 'mulher trans') genderKey = 'mulher_trans';
      else if (rawGender === 'agênero') genderKey = 'agenero';
      else if (rawGender === 'outro') genderKey = 'outro';
      
      update[`stats_gender_${genderKey}`] = increment(1);
      update[`stats_age_${ageGroup}`] = increment(1);
    }
    return update;
  }
  
  React.useEffect(() => {
    if (!isSponsored || !adId || !db || !adsSettings || hasTrackedImpression.current || (user && !userProfile)) return

    const observer = new IntersectionObserver(
      async (entries) => {
        if (entries[0].isIntersecting && !hasTrackedImpression.current) {
          hasTrackedImpression.current = true
          
          const cpmValue = adsSettings.cpmValue || 0
          const costPerImpression = cpmValue / 1000

          const adRef = doc(db, "ads", adId)
          const updateData: any = { 
            reach: increment(1),
            remainingBudget: increment(-costPerImpression),
            updatedAt: serverTimestamp()
          };

          if (user) {
            const viewerRef = doc(db, "ads", adId, "viewers", user.uid);
            const viewerSnap = await getDoc(viewerRef);
            if (!viewerSnap.exists()) {
              await setDoc(viewerRef, { timestamp: serverTimestamp() });
              updateData.uniqueReach = increment(1);
              const demoUpdate = getDemographicsUpdate();
              Object.assign(updateData, demoUpdate);
            }
          }

          updateDoc(adRef, updateData).then(() => {
            if (event.organizationId) {
              updateDoc(doc(db, "organizations", event.organizationId), {
                blockedBalance: increment(-costPerImpression)
              });
            }
          });
          
          observer.disconnect()
        }
      },
      { threshold: 0.5 }
    )

    if (cardRef.current) observer.observe(cardRef.current)
    return () => observer.disconnect()
  }, [isSponsored, adId, db, adsSettings, userProfile, event.organizationId, user]);

  const formatDate = (dateValue: any) => {
    if (!dateValue) return "A definir";
    try {
      let d: Date = dateValue?.toDate ? dateValue.toDate() : new Date(dateValue);
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    } catch (e) { return "A definir"; }
  };

  const formatTime = (dateValue: any) => {
    if (!dateValue) return "";
    try {
      let d: Date = dateValue?.toDate ? dateValue.toDate() : new Date(dateValue);
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return ""; }
  };

  const distance = React.useMemo(() => {
    if (userLocation && typeof event.latitude === 'number' && typeof event.longitude === 'number') {
      return calculateDistance(userLocation, { latitude: event.latitude, longitude: event.longitude });
    }
    return null;
  }, [userLocation, event.latitude, event.longitude]);

  const handleCardClick = () => {
    if (isSponsored && adId && db && adsSettings) {
      const cpcValue = adsSettings.cpcValue || 0
      const adRef = doc(db, "ads", adId);
      const demoUpdate = getDemographicsUpdate();

      updateDoc(adRef, { 
        clicks: increment(1),
        remainingBudget: increment(-cpcValue),
        updatedAt: serverTimestamp(),
        ...Object.keys(demoUpdate).reduce((acc: any, key) => {
          acc[key.replace('stats_', 'click_stats_')] = increment(1);
          return acc;
        }, {})
      }).then(() => {
        if (event.organizationId) {
          updateDoc(doc(db, "organizations", event.organizationId), {
            blockedBalance: increment(-cpcValue)
          });
        }
      });
    }
    router.push(`/${event.organizer?.username || 'evento'}/${event.id}`)
  }

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
            <Megaphone className="w-3 h-3 text-secondary fill-secondary" /> Patrocinado
          </Badge>
        </div>
      )}

      <div className="relative h-56 w-full bg-muted">
        <Image
          src={event.image || `https://picsum.photos/seed/${event.id}/600/400`}
          alt={event.title}
          fill
          className="object-cover transition-transform duration-700 group-hover:scale-110"
          unoptimized
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
          <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary group-hover:text-secondary transition-colors line-clamp-1 leading-tight">
            {event.title}
          </h3>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest line-clamp-1">
            {event.organizer?.name}
          </p>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-dashed border-border/60">
           <div className="flex flex-col gap-0.5">
              <p className="text-[9px] font-black uppercase text-muted-foreground opacity-60">Quando</p>
              <div className="flex items-center gap-1.5 text-xs font-black text-primary">
                 <Calendar className="w-3.5 h-3.5 text-secondary" />
                 {formatDate(event.date)}
                 <span className="opacity-30">|</span>
                 <Clock className="w-3.5 h-3.5 text-secondary" />
                 {formatTime(event.date)}
              </div>
           </div>
           <div className="text-right">
              <p className="text-[9px] font-black uppercase text-muted-foreground opacity-60">Onde</p>
              <div className="flex items-center justify-end gap-1.5 text-xs font-black text-primary">
                 <MapPin className="w-3.5 h-3.5 text-secondary" />
                 <span className="truncate max-w-[120px]">{event.city}</span>
              </div>
           </div>
        </div>

        <Button className="w-full h-12 bg-primary text-white font-black rounded-2xl uppercase italic text-[11px] gap-2 shadow-lg transition-all group-hover:bg-secondary group-hover:scale-[1.02]">
           Garantir Presença <ArrowRight className="w-4 h-4" />
        </Button>
      </CardContent>
    </Card>
  )
}
