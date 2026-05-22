"use client"

import * as React from "react"
import { Calendar, MapPin, Clock, Ticket, Navigation, Megaphone, BadgeCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { calculateDistance, type Coordinates } from "@/lib/location-utils"
import { useFirestore, useDoc, useAuth, useUser } from "@/firebase"
import { doc, updateDoc, increment, serverTimestamp, getDoc, setDoc } from "firebase/firestore"

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

  const userDocRef = React.useMemo(() => (db && user) ? doc(db, "users", user.uid) : null, [db, user])
  const { data: userProfile } = useDoc<any>(userDocRef)

  const adsSettingsRef = React.useMemo(() => db ? doc(db, 'settings', 'ads') : null, [db])
  const { data: adsSettings } = useDoc<any>(adsSettingsRef)
  
  const [liveStatus, setLiveStatus] = React.useState<{ label: string; colorClass: string } | null>(null);
  const [isEnded, setIsEnded] = React.useState(false);

  React.useEffect(() => {
    const update = () => {
      const now = new Date();
      const start = event.date?.toDate ? event.date.toDate() : new Date(event.date);
      const end = event.endDate?.toDate ? event.endDate.toDate() : (event.endDate ? new Date(event.endDate) : new Date(start.getTime() + 4 * 60 * 60 * 1000));

      const hasEnded = end < now;
      setIsEnded(hasEnded);

      const diffEnd = end.getTime() - now.getTime();
      const diffStart = start.getTime() - now.getTime();
      const isToday = now.toDateString() === start.toDateString();

      if (hasEnded) {
        setLiveStatus({ label: "Evento já acabou", colorClass: "bg-gray-500/80" });
      } else if (diffEnd <= 1 * 60 * 60 * 1000 && now >= start) {
        setLiveStatus({ label: "Evento encerrando", colorClass: "bg-orange-600 animate-pulse" });
      } else if (now >= start && now < end) {
        setLiveStatus({ label: "Evento acontecendo", colorClass: "bg-green-600 animate-pulse shadow-lg shadow-green-500/20" });
      } else if (diffStart <= 2 * 60 * 60 * 1000 && diffStart > 0) {
        const totalMinutes = Math.floor(diffStart / (1000 * 60));
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        const countdown = hours > 0 ? `${hours}h${minutes.toString().padStart(2, '0')}` : `${minutes}min`;
        setLiveStatus({ label: `Começa em ${countdown}`, colorClass: "bg-secondary" });
      } else if (isToday) {
        setLiveStatus({ label: "Acontece hoje", colorClass: "bg-secondary" });
      } else {
        setLiveStatus(null);
      }
    };

    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [event.date, event.endDate]);

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
    if (!isSponsored || !event.adId || !db || !adsSettings || hasTrackedImpression.current || (user && !userProfile)) return

    const observer = new IntersectionObserver(
      async (entries) => {
        if (entries[0].isIntersecting && !hasTrackedImpression.current) {
          hasTrackedImpression.current = true
          
          const cpmValue = adsSettings.cpmValue || 0
          const costPerImpression = cpmValue / 1000

          const adRef = doc(db, "ads", event.adId)
          const updateData: any = { 
            reach: increment(1),
            remainingBudget: increment(-costPerImpression),
            updatedAt: serverTimestamp()
          };

          if (user) {
            const viewerRef = doc(db, "ads", event.adId, "viewers", user.uid);
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
          }).catch((err) => {
            console.error("Erro ao registrar impressão:", err)
          })
          
          observer.disconnect()
        }
      },
      { threshold: 0.5 }
    )

    if (cardRef.current) observer.observe(cardRef.current)
    return () => observer.disconnect()
  }, [isSponsored, event.adId, db, adsSettings, userProfile, event.organizationId, user]);

  const formatDate = (dateValue: any) => {
    if (!dateValue) return "A definir";
    try {
      let d: Date;
      if (dateValue?.toDate) d = dateValue.toDate();
      else if (dateValue instanceof Date) d = dateValue;
      else d = new Date(dateValue);
      if (isNaN(d.getTime())) return "A definir";
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    } catch (e) { return "A definir"; }
  };

  const formatTime = (dateValue: any) => {
    if (!dateValue) return "";
    try {
      let d: Date;
      if (dateValue?.toDate) d = dateValue.toDate();
      else if (dateValue instanceof Date) d = dateValue;
      else d = new Date(dateValue);
      if (isNaN(d.getTime())) return "";
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return ""; }
  };

  const formattedDate = formatDate(event.date);
  const formattedTime = formatTime(event.date);
  
  const username = event.organizer?.username || "evento";
  const eventLink = `/${username}/${event.id}`;
  const profileLink = `/${username}`;

  const getPriceDisplay = () => {
    if (event.isFree) return "Grátis";
    if (event.batches && event.batches.length > 0) {
      const prices = event.batches.map((b: any) => parseFloat(b.price) || 0);
      const minPrice = Math.min(...prices);
      return minPrice === 0 ? "Grátis" : `A partir de R$ ${minPrice.toFixed(2).replace('.', ',')}`;
    }
    return "Consulte";
  };

  const distance = React.useMemo(() => {
    if (userLocation && typeof event.latitude === 'number' && typeof event.longitude === 'number') {
      return calculateDistance(userLocation, { latitude: event.latitude, longitude: event.longitude });
    }
    return null;
  }, [userLocation, event.latitude, event.longitude]);

  const handleCardClick = () => {
    if (isSponsored && event.adId && db && adsSettings) {
      const cpcValue = adsSettings.cpcValue || 0
      const adRef = doc(db, "ads", event.adId);
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
    router.push(eventLink)
  }

  const handleOrganizerClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    router.push(profileLink)
  }

  const categoryDisplay = event.categoryName || "Geral";
  const isVerified = event.organizer?.verified === true || event.organizer?.isVerified === true;

  return (
    <Card 
      ref={cardRef}
      className={cn(
        "group overflow-hidden border-none shadow-lg bg-card transition-all hover:-translate-y-1 hover:shadow-xl rounded-[1.5rem] cursor-pointer relative",
        isSponsored && "ring-2 ring-secondary/20 shadow-secondary/10",
        isEnded && "opacity-80 grayscale-[0.8]"
      )}
      onClick={handleCardClick}
    >
      {isSponsored && !isEnded && (
        <div className="absolute top-0 right-0 z-20">
          <Badge className="bg-primary text-white rounded-none rounded-bl-xl font-black text-[9px] uppercase px-3 py-1.5 flex items-center gap-1.5">
            <Megaphone className="w-3 h-3 text-secondary" /> Patrocinado
          </Badge>
        </div>
      )}

      <div className="relative h-48 w-full bg-muted">
        <Image
          src={event.image || `https://picsum.photos/seed/${event.id}/600/400`}
          alt={event.title}
          fill
          className={cn(
            "object-cover transition-transform group-hover:scale-105",
            isEnded && "grayscale"
          )}
          unoptimized
        />
        
        <div className="absolute top-3 left-3 flex flex-col gap-2 z-10">
          {liveStatus && (
            <Badge className={cn("text-white border-none shadow-xl px-3 py-1 text-[10px] font-black uppercase tracking-wider", liveStatus.colorClass)}>
              {liveStatus.label}
            </Badge>
          )}
          {!isEnded && (
            <>
              <Badge className="bg-white/90 text-primary border-none shadow-md px-3 py-1 text-[10px] font-black uppercase tracking-wider">
                {categoryDisplay}
              </Badge>
              <Badge className={cn("text-white border-none shadow-md px-3 py-1 text-[10px] font-black uppercase tracking-wider", event.isFree ? "bg-green-500" : "bg-primary")}>
                {getPriceDisplay()}
              </Badge>
            </>
          )}
        </div>

        {distance !== null && !isEnded && (
          <div className="absolute bottom-3 right-3">
            <Badge className="bg-white/95 text-secondary border-none shadow-xl backdrop-blur-md px-3 py-1.5 text-[11px] font-black uppercase flex items-center gap-1.5 ring-2 ring-secondary/10">
              <Navigation className="w-3.5 h-3.5 fill-secondary" />
              {distance < 1 ? `${(distance * 1000).toFixed(0)}m de você` : `${distance.toFixed(1)}km de você`}
            </Badge>
          </div>
        )}
      </div>
      <CardHeader className="p-4 pb-2">
        <div className="flex justify-between items-start gap-2">
          <h3 className={cn(
            "text-lg font-bold line-clamp-1 group-hover:text-secondary transition-colors uppercase italic tracking-tight",
            isEnded && "text-muted-foreground"
          )}>
            {event.title}
          </h3>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-3">
        <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2.5rem] font-medium leading-relaxed">
          {event.shortDescription || event.description}
        </p>
        <div className="space-y-2">
          <div className="flex items-center gap-4 text-[10px] text-muted-foreground font-black uppercase tracking-tight">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-secondary" />
              {formattedDate}
            </span>
            {formattedTime && (
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-secondary" />
                {formattedTime}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-black uppercase tracking-tight">
            <MapPin className="w-3.5 h-3.5 text-secondary" />
            <span className="line-clamp-1">{event.city || "Local não definido"}</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="p-4 pt-2 border-t border-border flex items-center justify-between">
        <div 
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          onClick={handleOrganizerClick}
        >
          <Avatar className="h-6 w-6 border border-secondary/20">
            <AvatarImage src={event.organizer?.avatar} alt={event.organizer?.name} className="object-cover" />
            <AvatarFallback className="text-[10px] font-bold bg-muted">
              {event.organizer?.name?.charAt(0) || "O"}
            </AvatarFallback>
          </Avatar>
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase hover:text-secondary truncate max-w-[100px]">
              {event.organizer?.name || "Organizador"}
            </span>
            {isVerified && <VerifiedBadge />}
          </div>
        </div>
        
        <Button 
          variant="ghost" 
          size="sm" 
          className={cn(
            "h-8 text-[10px] font-black uppercase gap-1.5 text-secondary hover:bg-secondary/10",
            isEnded && "opacity-50"
          )}
        >
          <Ticket className="w-3.5 h-3.5" />
          {isEnded ? "Voucher" : "Detalhes"}
        </Button>
      </CardFooter>
    </Card>
  )
}
