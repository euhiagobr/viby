"use client"

import * as React from "react"
import { ExternalLink, Globe, Megaphone, Navigation, Users, CheckCircle2, ArrowRight, ImageIcon, BadgeCheck, MousePointer2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { useFirestore, useDoc, useAuth, useUser } from "@/firebase"
import { doc } from "firebase/firestore"
import { EventCard } from "../events/EventCard"

function VerifiedBadge({ className }: { className?: string }) {
  return (
    <BadgeCheck className={cn("w-3.5 h-3.5 fill-blue-500 text-white", className)} />
  )
}

interface AdCardProps {
  ad: any;
  variant?: 'default' | 'premium';
}

export function AdCard({ ad, variant = 'default' }: AdCardProps) {
  const router = useRouter()
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  const cardRef = React.useRef<HTMLDivElement>(null)
  const hasTrackedImpression = React.useRef(false)

  const adId = ad.id || ad.adId;
  const isPremium = variant === 'premium';

  const orgRef = React.useMemo(() => (db && ad.organizationId) ? doc(db, "organizations", ad.organizationId) : null, [db, ad.organizationId])
  const { data: organization } = useDoc<any>(orgRef)

  // Rastreamento de Impressão via API (Server-Side)
  React.useEffect(() => {
    if (hasTrackedImpression.current || !adId) return

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
  }, [adId, user?.uid])

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    fetch('/api/ads/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        adId,
        eventType: 'click',
        userId: user?.uid || null
      })
    }).catch(() => {});

    if ((ad.type === 'site' || ad.type === 'banner') && ad.externalUrl) {
      window.open(ad.externalUrl, '_blank')
    } else if (ad.type === 'pagina' && organization) {
      router.push(`/${organization.username}`)
    } else if (ad.type === 'evento' && ad.eventId) {
      const eventSlug = ad.eventSlug || ad.eventId;
      const username = organization?.username || 'evento';
      router.push(`/${username}/${eventSlug}`);
    }
  }

  if (ad.type === 'evento' && !ad._isAdObject) return <EventCard event={ad} isSponsored />

  if (ad.type === 'pagina') {
    const dispName = organization?.name || ad.eventTitle || "Organização"
    const dispUsername = organization?.username || "marca"
    const dispAvatar = organization?.avatar || ad.adImage || ""
    const dispBanner = organization?.banner || "https://picsum.photos/seed/banner/800/400"

    return (
      <Card ref={cardRef} onClick={handleClick} className={cn(
        "group overflow-hidden border-none shadow-lg bg-card transition-all hover:-translate-y-1 hover:shadow-xl cursor-pointer relative ring-2 ring-secondary/10 h-full flex flex-col",
        isPremium ? "rounded-[2.5rem]" : "rounded-[2rem]"
      )}>
        <div className="absolute top-0 right-0 z-20">
          <Badge className="bg-primary text-white rounded-none rounded-bl-xl font-black text-[9px] uppercase px-3 py-1.5 flex items-center gap-1.5">
            <Megaphone className="w-3 h-3 text-secondary" /> Patrocinado
          </Badge>
        </div>
        <div className={cn("relative w-full bg-muted", isPremium ? "aspect-[4/5]" : "h-32")}>
          <Image src={dispBanner} alt="Capa" fill className="object-cover" unoptimized />
          <div className="absolute inset-0 bg-black/20" />
        </div>
        <CardContent className={cn(
          "relative text-center flex-1 flex flex-col justify-between",
          isPremium ? "p-8 pt-16" : "px-6 pb-6 pt-12"
        )}>
          <div className="absolute -top-12 left-1/2 -translate-x-1/2">
             <div className="p-1 bg-background rounded-full shadow-xl ring-4 ring-background">
                <Avatar className="h-20 w-20">
                   <AvatarImage src={dispAvatar} className="object-cover" />
                   <AvatarFallback className="font-bold text-xl">{dispName.charAt(0)}</AvatarFallback>
                </Avatar>
             </div>
          </div>
          <div className="space-y-1">
             <div className="flex items-center justify-center gap-1.5">
                <h3 className="text-lg font-black uppercase italic tracking-tighter leading-tight">{dispName}</h3>
                {organization?.verified && <VerifiedBadge />}
             </div>
             <p className="text-[10px] font-bold text-secondary uppercase tracking-widest">@{dispUsername}</p>
          </div>
          <div className="flex items-center justify-center gap-6 mt-6 py-4 border-y border-dashed border-border/60">
             <div className="text-center">
                <p className="text-xs font-black">{organization?.followersCount || 0}</p>
                <p className="text-[8px] font-bold text-muted-foreground uppercase">Seguidores</p>
             </div>
             <div className="w-px h-6 bg-border" />
             <div className="text-center">
                <p className="text-xs font-black truncate max-w-[80px]">{organization?.type || ad.type || "Marca"}</p>
                <p className="text-[8px] font-bold text-muted-foreground uppercase">Segmento</p>
             </div>
          </div>
          <Button className="w-full mt-6 bg-primary text-white font-black h-11 rounded-xl uppercase italic text-xs gap-2 group-hover:bg-secondary transition-colors">
             Acessar Página <ArrowRight className="w-4 h-4" />
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card ref={cardRef} onClick={handleClick} className={cn(
      "group overflow-hidden border-none shadow-lg bg-card transition-all hover:-translate-y-1 hover:shadow-xl cursor-pointer relative ring-2 ring-secondary/10 h-full flex flex-col",
      isPremium ? "rounded-[2.5rem]" : "rounded-[2.5rem]"
    )}>
       <div className="absolute top-0 right-0 z-20">
          <Badge className="bg-primary text-white rounded-none rounded-bl-xl font-black text-[8px] uppercase px-3 py-1.5 flex items-center gap-1.5">
            <Megaphone className="w-3 h-3 text-secondary" /> Patrocinado
          </Badge>
        </div>
        <div className={cn("relative w-full bg-muted overflow-hidden shrink-0", isPremium ? "aspect-[4/5]" : "aspect-video")}>
           {ad.adImage ? (
             <Image src={ad.adImage} alt="Anúncio" fill className="object-cover group-hover:scale-105 transition-transform duration-700" unoptimized />
           ) : (
             <div className="flex flex-col items-center justify-center h-full opacity-20"><ImageIcon className="w-12 h-12" /></div>
           )}
           {(ad.type === 'site' || ad.type === 'banner') && (
             <div className="absolute bottom-3 left-3">
                <Badge className="bg-white/90 text-primary border-none shadow-sm text-[9px] font-black uppercase flex items-center gap-1.5">
                   <Globe className="w-3 h-3 text-secondary" /> {ad.type === 'site' ? 'Link Externo' : 'Campanha de Mídia'}
                </Badge>
             </div>
           )}
        </div>
        <CardContent className={cn(
          "space-y-4 flex-1 flex flex-col justify-between",
          isPremium ? "p-8" : "p-6"
        )}>
           <div className="space-y-1 flex-1">
              <h3 className="font-black text-lg uppercase italic tracking-tighter leading-tight line-clamp-2">{ad.eventTitle}</h3>
              {ad.externalUrl && <p className="text-[10px] text-muted-foreground font-medium truncate">{ad.externalUrl.replace(/^https?:\/\//, '')}</p>}
           </div>
           <Button variant="outline" className="w-full h-11 rounded-2xl font-bold uppercase text-[10px] tracking-widest gap-2 border-secondary/20 text-secondary hover:bg-secondary/5">
              {ad.type === 'site' ? "Ver no Site" : "Saiba Mais"} <ExternalLink className="w-3 h-3" />
           </Button>
        </CardContent>
    </Card>
  )
}
