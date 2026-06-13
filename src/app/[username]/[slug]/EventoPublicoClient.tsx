"use client"

import * as React from "react"
import { useDoc, useFirestore, useAuth, useUser, useCollection, useMemoFirebase } from "@/firebase"
import { doc, collection, query, where, orderBy } from "firebase/firestore"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { 
  Calendar, 
  MapPin, 
  ArrowLeft, 
  Info,
  BadgeCheck,
  Loader2,
  CheckCircle2,
  Clock,
  ShieldCheck,
  ArrowRight,
  Share2,
  Map as MapIcon,
  Navigation,
  Globe,
  ExternalLink,
  Copy,
  Tag,
  Users,
  ShieldAlert,
  InfoIcon,
  RefreshCw,
  ChevronRight,
  EyeOff,
  Lock,
  MoreVertical,
  Trophy
} from "lucide-react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { BilheteriaPublic, EventInterest, EventSEO, EventCoOrganizers } from "@/components/events"
import { FollowButton } from "@/components/organizer/FollowButton"
import Footer from "@/components/layout/Footer"
import { AgeRatingBadge, AgeRatingWarning } from "@/lib/age-rating"
import { useCurrency } from "@/contexts/CurrencyContext"
import { UserNav } from "@/components/layout/UserNav"
import { ShareModal } from "@/components/sharing/ShareModal"
import { RichText } from "@/components/ui/rich-text"
import { toast } from "@/hooks/use-toast"
import dynamic from "next/dynamic"
import { format, startOfToday, addDays } from "date-fns"
import { ptBR } from "date-fns/locale"
import { EventActionModal } from "@/components/events/EventActionModal"

const VIBY_OFFICIAL_UID = "dd9665af-ad6d-405c-a51d-08220fecf96f";

const LocationMap = dynamic(() => import("@/components/events/LocationMap").then(mod => mod.LocationMap), { 
  ssr: false,
  loading: () => <div className="w-full h-full bg-muted animate-pulse flex items-center justify-center text-[10px] font-black uppercase opacity-20">Carregando Mapa...</div>
})

interface EventoPublicoClientProps {
  id: string
  username: string
}

export default function EventoPublicoClient({ id, username }: EventoPublicoClientProps) {
  const router = useRouter()
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  
  const [isShareModalOpen, setIsShareModalOpen] = React.useState(false)
  const [isActionModalOpen, setIsActionModalOpen] = React.useState(false)
  const [now, setNow] = React.useState<Date>(new Date())

  // Atualiza o relógio a cada minuto para manter sincronia de visibilidade
  React.useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  const eventRef = React.useMemo(() => (db && id) ? doc(db, "events", id) : null, [db, id])
  const { data: event, loading: eventLoading } = useDoc<any>(eventRef)

  const organizationRef = React.useMemo(() => 
    (db && event?.organizationId) ? doc(db, "organizations", event.organizationId) : null, 
    [db, event?.organizationId]
  )
  const { data: org } = useDoc<any>(organizationRef)

  const settingsRef = React.useMemo(() => (db ? doc(db, "settings", "site") : null), [db])
  const { data: settings } = useDoc<any>(settingsRef)
  
  const feesRef = React.useMemo(() => (db ? doc(db, 'settings', 'fees') : null), [db])
  const { data: globalFees } = useDoc<any>(feesRef)

  const promosRef = React.useMemo(() => (db ? doc(db, 'settings', 'promotions') : null), [db])
  const { data: promotions } = useDoc<any>( promosRef)

  const occurrencesQuery = useMemoFirebase(() => {
    if (!db || !id || !event?.isRecurring) return null;
    const yesterdayStr = format(addDays(startOfToday(), -1), 'yyyy-MM-dd')
    return query(
      collection(db, "recurring_occurrences"),
      where("parentId", "==", id),
      where("status", "==", "active"),
      where("date", ">=", yesterdayStr)
    )
  }, [db, id, event?.isRecurring]);

  const { data: rawOccurrences, loading: loadingOccurrences } = useCollection<any>(occurrencesQuery);

  const upcomingOccurrences = React.useMemo(() => {
    if (!rawOccurrences) return [];
    
    return rawOccurrences
      .map(o => ({ ...o, _dt: new Date(o.date + 'T' + (o.startTime || '00:00') + ':00') }))
      .filter(o => {
        const endThreshold = new Date(o._dt.getTime() + 6 * 60 * 60 * 1000);
        return now < endThreshold;
      })
      .sort((a: any, b: any) => a._dt.getTime() - b._dt.getTime());
  }, [rawOccurrences, now]);

  // Lógica de Identificação de Próxima Data para Evento Recorrente
  const effectiveEventData = React.useMemo(() => {
    if (!event) return null;
    if (!event.isRecurring || upcomingOccurrences.length === 0) return event;

    const nextOcc = upcomingOccurrences[0];
    const nextDateStr = nextOcc.date + 'T' + (nextOcc.startTime || '19:00') + ':00';
    
    return {
      ...event,
      date: nextDateStr,
      _isAutoUpdated: true
    };
  }, [event, upcomingOccurrences]);

  const siteName = settings?.siteName || "Viby"

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      toast({ title: "Link copiado!", description: "Compartilhe com sua rede." });
    }
  }

  if (eventLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <Loader2 className="w-10 h-10 animate-spin text-secondary" />
      </div>
    )
  }

  if (!event || !effectiveEventData) return null;

  // Lógica de Identificação de Curadoria
  const isCuradoria = event.curationType === 'curadoria' || 
                      event.curatorProfile === 'viby' || 
                      (event.organizationId === VIBY_OFFICIAL_UID && (event.type === 'divulgacao' || event.type === 'externo'));

  const dateValue = effectiveEventData.date || effectiveEventData.startDate;
  const dStart = dateValue ? (dateValue.toDate ? dateValue.toDate() : new Date(dateValue)) : new Date();
  let dEnd = effectiveEventData.endDate ? (effectiveEventData.endDate.toDate ? effectiveEventData.endDate.toDate() : new Date(effectiveEventData.endDate)) : null;
  
  if (event.isRecurring && dEnd && dEnd < dStart) {
    dEnd = null;
  }

  const isEnded = dEnd ? (dEnd < now) : false;
  
  return (
    <div className="min-h-screen bg-[#f8fafc] h-full flex flex-col selection:bg-secondary selection:text-white overflow-x-hidden w-full">
      <EventSEO event={effectiveEventData} username={username} />
      
      <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4 overflow-hidden">
             <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full shrink-0">
                <ArrowLeft className="w-5 h-5" />
             </Button>
             <Link href="/" className="flex items-center gap-2 group overflow-hidden">
                {settings?.logoUrl ? (
                  <Image 
                    src={settings.logoUrl} 
                    alt={siteName} 
                    width={120} 
                    height={40} 
                    style={{ height: 'auto' }}
                    className="h-8 w-auto object-contain" 
                    priority 
                    unoptimized 
                  />
                ) : (
                  <span className="text-lg sm:text-xl font-black tracking-tight italic uppercase text-primary truncate ml-1">{siteName}</span>
                )}
             </Link>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
             <Button asChild variant="outline" className="hidden md:flex rounded-full h-9 border-[#ffdf00] bg-[#ffdf00]/10 text-[#002776] font-black uppercase text-[9px] gap-2">
               <Link href="/copa-do-mundo"><Trophy className="w-3.5 h-3.5" /> Copa 2026</Link>
             </Button>
             <Button 
                variant="ghost" 
                size="icon" 
                className="rounded-full hidden sm:flex"
                onClick={() => setIsShareModalOpen(true)}
             >
                <Share2 className="w-5 h-5" />
             </Button>
             {user ? <UserNav /> : (
                <div className="flex items-center gap-1 sm:gap-2">
                  <Button variant="ghost" asChild className="font-bold uppercase text-[9px] sm:text-[10px] tracking-widest px-2 sm:px-4">
                    <Link href="/login">Entrar</Link>
                  </Button>
                  <Button asChild className="bg-primary text-white font-black uppercase italic text-[9px] sm:text-[10px] tracking-widest rounded-full px-4 sm:px-6 shadow-lg">
                    <Link href="/cadastro">Criar Conta</Link>
                  </Button>
                </div>
             )}
          </div>
        </div>
      </nav>
      {/* REST OF COMPONENT OMITTED FOR BREVITY */}
    </div>
  )
}
