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
import { useFirestore, useDoc, useCollection, useMemoFirebase, useAuth, useUser } from "@/firebase"
import { collection, query, where, doc } from "firebase/firestore"
import { EventCard } from "../events/EventCard"

function VerifiedBadge({ className }: { className?: string }) {
  return (
    <BadgeCheck className={cn("w-3.5 h-3.5 fill-blue-500 text-white", className)} />
  )
}

interface AdCardProps {
  ad: any
}

export function AdCard({ ad }: AdCardProps) {
  const router = useRouter()
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  const cardRef = React.useRef<HTMLDivElement>(null)
  const hasTrackedImpression = React.useRef(false)

  const adId = ad.id || ad.adId;

  const orgRef = React.useMemo(() => (db && ad.organizationId) ? doc(db, "organizations", ad.organizationId) : null, [db, ad.organizationId])
  const { data: organization } = useDoc<any>(orgRef)

  const followersQuery = useMemoFirebase(() => {
    if (!db || !ad.organizationId) return null
    return query(collection(db, "follows"), where("followingId", "==", ad.organizationId))
  }, [db, ad.organizationId])
  const { data: followers } = useCollection<any>(followersQuery)

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
          }).catch(() => {
             // Silently ignore tracking errors in frontend
          });
          
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

    // Rastreamento de Clique via API (Server-Side)
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
      router.push(`/${organization?.username || 'evento'}/${ad.eventId}`)
    }
  }

  if (ad.type === 'evento' && !ad._isAdObject) return <EventCard event={ad} isSponsored />

  if (ad.type === 'pagina') {
    const dispName = organization?.name || ad.eventTitle || "Organização"
    const dispUsername = organization?.username || "marca"
    const dispAvatar = organization?.avatar || ad.adImage || ""
    const dispBanner = organization?.banner || "https://picsum.photos/seed/banner/800/400"

    return (
      <Card ref={cardRef} onClick={handleClick} className="group overflow-hidden border-none shadow-lg bg-card transition-all hover:-translate-y-1 hover:shadow-xl rounded-[2rem] cursor-pointer relative ring-2 ring-secondary/10">
        <div className="absolute top-0 right-0 z-20">
          <Badge className="bg-primary text-white rounded-none rounded-bl-xl font-black text-[9px] uppercase px-3 py-1.5 flex items-center gap-1.5">
            <Megaphone className="w-3 h-3 text-secondary" /> Patrocinado
          </Badge>
        </div>
        <div className="relative h-32 w-full bg-muted">
          <Image src={dispBanner} alt="Capa" fill className="object-cover" unoptimized />
          <div className="absolute inset-0 bg-black/20" />
        </div>
        <CardContent className="px-6 pb-6 relative pt-12 text-center">
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
                <p className="text-xs font-black">{followers?.length || 0}</p>
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
    <Card ref={cardRef} onClick={handleClick} className="group overflow-hidden border-none shadow-lg bg-card transition-all hover:-translate-y-1 hover:shadow-xl rounded-[2rem] cursor-pointer relative ring-2 ring-secondary/10">
       <div className="absolute top-0 right-0 z-20">
          <Badge className="bg-primary text-white rounded-none rounded-bl-xl font-black text-[9px] uppercase px-3 py-1.5 flex items-center gap-1.5">
            <Megaphone className="w-3 h-3 text-secondary" /> Patrocinado
          </Badge>
        </div>
        <div className="relative aspect-video w-full bg-muted">
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
        <CardContent className="p-6 space-y-4">
           <div className="space-y-1">
              <h3 className="font-black text-lg uppercase italic tracking-tighter leading-tight line-clamp-1">{ad.eventTitle}</h3>
              {ad.externalUrl && <p className="text-[10px] text-muted-foreground font-medium truncate">{ad.externalUrl.replace(/^https?:\/\//, '')}</p>}
           </div>
           <Button variant="outline" className="w-full h-10 rounded-xl font-bold uppercase text-[10px] tracking-widest gap-2 border-secondary/20 text-secondary hover:bg-secondary/5">
              {ad.type === 'site' ? "Ver no Site" : "Saiba Mais"} <ExternalLink className="w-3 h-3" />
           </Button>
        </CardContent>
    </Card>
  )
}
