
"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { useFirestore, useCollection, useMemoFirebase, useAuth, useUser, useFirebaseApp, useDoc } from "@/firebase"
import { 
  doc, 
  getDoc, 
  collection, 
  query, 
  where, 
  limit, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  serverTimestamp, 
  collectionGroup,
  increment,
  updateDoc,
  addDoc
} from "firebase/firestore"
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage"
import { 
  Loader2, 
  AlertTriangle, 
  MapPin, 
  Globe, 
  Instagram, 
  Calendar,
  Users,
  Grid,
  Heart,
  Share2,
  ExternalLink,
  Building2,
  Bell,
  Plus,
  Check,
  Handshake,
  Info,
  BadgeCheck,
  Phone,
  Flag,
  Camera,
  Paperclip,
  X,
  Send,
  ShieldAlert,
  EyeOff,
  Trophy,
  Zap,
  Award,
  Sparkles,
  TrendingUp,
  BarChart3,
  Map as MapIcon,
  ChevronRight,
  Target,
  Navigation,
  Search
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { EventCard } from "@/components/events/EventCard"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/AppSidebar"
import { OrganizationProvider, useCurrentOrganization } from "@/contexts/OrganizationContext"
import Footer from "@/components/layout/Footer"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { toast } from "@/hooks/use-toast"
import { calculateLevel, DEFAULT_LEVELS } from "@/lib/gamification"
import { processGamificationEvent } from "@/lib/gamification-service"

function VerifiedBadge({ className }: { className?: string }) {
  return (
    <BadgeCheck className={cn("w-5 h-5 fill-blue-500 text-white", className)} />
  )
}

function ProfileHeader() {
  const { currentOrg, organizations, setCurrentOrg } = useCurrentOrganization()
  const auth = useAuth()
  const { user } = useUser(auth)

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-background/80 px-6 backdrop-blur-md">
      <SidebarTrigger />
      
      <div className="flex items-center gap-4">
        {user && organizations.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2 rounded-xl h-10 border-dashed border-secondary/40 hover:border-secondary transition-all">
                <Building2 className="w-4 h-4 text-secondary" />
                <span className="font-bold text-xs uppercase tracking-tight">
                  {currentOrg?.name || "Selecionar Organização"}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 rounded-xl" align="start">
              <DropdownMenuLabel className="text-[10px] uppercase font-black opacity-50">Minhas Organizações</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {organizations.map((org) => (
                <DropdownMenuItem 
                  key={org.id} 
                  onClick={() => setCurrentOrg(org)}
                  className={currentOrg?.id === org.id ? "bg-secondary/10 font-bold" : ""}
                >
                  {org.name}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/dashboard/organizacoes/new" className="flex items-center gap-2 text-secondary font-bold">
                  <Plus className="w-4 h-4" />
                  Nova Organização
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      
      <div className="flex items-center gap-3 ml-auto">
        {!user ? (
          <>
            <Button asChild variant="ghost" className="font-semibold text-sm">
              <Link href="/login">Entrar</Link>
            </Button>
            <Button asChild className="bg-secondary text-white font-bold px-6 rounded-full h-9 text-xs">
              <Link href="/cadastro">Cadastrar-se</Link>
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" size="icon" className="relative h-9 w-9">
              <Bell className="h-5 w-5" />
            </Button>
            <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold border border-border shadow-sm overflow-hidden">
              {user.photoURL ? (
                <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs uppercase">{user.displayName?.charAt(0) || 'U'}</span>
              )}
            </div>
          </>
        )}
      </div>
    </header>
  )
}

function UniversalProfileContent() {
  const params = useParams()
  const router = useRouter()
  const db = useFirestore()
  const app = useFirebaseApp()
  const auth = useAuth()
  const { user } = useUser(auth)
  const storage = React.useMemo(() => app ? getStorage(app, "gs://viby") : null, [app])
  const username = (params.username as string).toLowerCase()

  const [loading, setLoading] = React.useState(true)
  const [data, setData] = React.useState<any>(null)
  const [type, setType] = React.useState<'user' | 'organization' | null>(null)
  const [followActionLoading, setFollowActionLoading] = React.useState(false)
  
  const [ownedEvents, setOwnedEvents] = React.useState<any[]>([])
  const [partneredEvents, setPartneredEvents] = React.useState<any[]>([])
  const [eventsLoading, setEventsLoading] = React.useState(false)
  const [eventSearch, setEventSearch] = React.useState("")

  // Estados de Gamificação
  const gamificationRef = React.useMemo(() => (db && data?.id && type === 'user') ? doc(db, "user_gamification", data.id) : null, [db, data?.id, type])
  const { data: gamification } = useDoc<any>(gamificationRef)

  const culturalStatsRef = React.useMemo(() => (db && data?.id && type === 'user') ? doc(db, "cultural_stats", data.id) : null, [db, data?.id, type])
  const { data: culturalStats } = useDoc<any>(culturalStatsRef)

  // Ranking Dinâmico por Escopo (Hierárquico)
  const xpValue = gamification?.totalXp !== undefined ? gamification.totalXp : -1;
  const userCity = gamification?.city || data?.city;
  const userNeighborhood = gamification?.neighborhood;
  const userState = gamification?.state || data?.state;
  const userCountry = gamification?.country || "Brasil";

  // Queries scoped para ranking
  const qBairro = useMemoFirebase(() => (db && userNeighborhood && xpValue >= 0) ? query(collection(db, "user_gamification"), where("neighborhood", "==", userNeighborhood), where("city", "==", userCity), where("totalXp", ">", xpValue)) : null, [db, userNeighborhood, userCity, xpValue]);
  const qCidade = useMemoFirebase(() => (db && userCity && xpValue >= 0) ? query(collection(db, "user_gamification"), where("city", "==", userCity), where("totalXp", ">", xpValue)) : null, [db, userCity, xpValue]);
  const qEstado = useMemoFirebase(() => (db && userState && xpValue >= 0) ? query(collection(db, "user_gamification"), where("state", "==", userState), where("totalXp", ">", xpValue)) : null, [db, userState, xpValue]);
  const qPais = useMemoFirebase(() => (db && userCountry && xpValue >= 0) ? query(collection(db, "user_gamification"), where("country", "==", userCountry), where("totalXp", ">", xpValue)) : null, [db, userCountry, xpValue]);
  const qGlobal = useMemoFirebase(() => (db && xpValue >= 0) ? query(collection(db, "user_gamification"), where("totalXp", ">", xpValue)) : null, [db, xpValue]);

  const { data: cBairro } = useCollection<any>(qBairro);
  const { data: cCidade } = useCollection<any>(qCidade);
  const { data: cEstado } = useCollection<any>(qEstado);
  const { data: cPais } = useCollection<any>(qPais);
  const { data: cGlobal } = useCollection<any>(qGlobal);

  const bestRankInfo = React.useMemo(() => {
    if (xpValue === -1) return { rank: "---", scope: "Calculando...", color: "bg-primary", text: "text-white", badge: "bg-white/20" };

    const rB = (cBairro?.length || 0) + 1;
    const rC = (cCidade?.length || 0) + 1;
    const rE = (cEstado?.length || 0) + 1;
    const rP = (cPais?.length || 0) + 1;
    const rG = (cGlobal?.length || 0) + 1;

    // Hierarchy: Global > País > Estado > Cidade > Bairro
    if (rG <= 499) return { rank: `#${rG}`, scope: "Líder Global", color: "bg-black", text: "text-white", badge: "text-secondary" };
    if (rP <= 99) return { rank: `#${rP}`, scope: "Líder Nacional", color: "bg-[#FFD700]", text: "text-black", badge: "text-black/60" };
    if (rE <= 99) return { rank: `#${rE}`, scope: `Top Estado (${userState})`, color: "bg-[#B76E79]", text: "text-white", badge: "text-white/60" };
    if (rC <= 99) return { rank: `#${rC}`, scope: `Top Cidade (${userCity})`, color: "bg-[#C0C0C0]", text: "text-black", badge: "text-black/60" };
    if (rB <= 99) return { rank: `#${rB}`, scope: `Top Bairro (${userNeighborhood})`, color: "bg-[#CD7F32]", text: "text-white", badge: "text-white/60" };
    
    return { rank: `#${rG}`, scope: "Membro Ativo", color: "bg-primary", text: "text-white", badge: "text-white/60" };
  }, [cBairro, cCidade, cEstado, cPais, cGlobal, userNeighborhood, userCity, userState, userCountry, xpValue]);

  const levelInfo = React.useMemo(() => {
    if (!gamification) return null;
    return calculateLevel(gamification.totalXp || 0, DEFAULT_LEVELS);
  }, [gamification]);

  // Estados da Denúncia
  const [isReportOpen, setIsReportOpen] = React.useState(false)
  const [reportReason, setReportReason] = React.useState("")
  const [reportDescription, setReportDescription] = React.useState("")
  const [reportAttachments, setReportAttachments] = React.useState<string[]>([])
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null)
  const [isSubmittingReport, setIsSubmittingReport] = React.useState(false)

  const trackedRef = React.useRef(false);

  const handleShare = () => {
    if (typeof window === 'undefined') return;
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    toast({
      title: "Link copiado!",
      description: "O link do perfil foi copiado para sua área de transferência.",
    });
  };

  const handleSendReport = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!db || !user || !data || !reportReason) return

    setIsSubmittingReport(true)
    try {
      const reportData = {
        type: 'profile',
        targetId: data.id,
        targetCollection: type === 'organization' ? 'organizations' : 'users',
        targetName: type === 'organization' ? data.name : (data.name || data.displayName),
        reason: reportReason,
        description: reportDescription,
        attachments: reportAttachments,
        reporterId: user.uid,
        reporterName: user.displayName || user.email || "Usuário",
        status: 'Pendente',
        timestamp: serverTimestamp()
      }

      await addDoc(collection(db, "reports"), reportData)
      toast({ title: "Denúncia enviada!", description: "Nossa equipe analisará o caso em até 48 horas." })
      setIsReportOpen(false)
      setReportReason("")
      setReportDescription("")
      setReportAttachments([])
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao enviar denúncia" })
    } finally {
      setIsSubmittingReport(false)
    }
  }

  // Resolvedor de username
  React.useEffect(() => {
    if (!db || !username) return

    const resolveUsername = async () => {
      setLoading(true)
      setData(null)
      setType(null)

      try {
        const usernameRef = doc(db, "usernames", username)
        const usernameSnap = await getDoc(usernameRef)

        let targetUid = null
        let resolvedType: 'user' | 'organization' | null = null

        if (usernameSnap.exists()) {
          const uData = usernameSnap.data()
          targetUid = uData.uid
          resolvedType = uData.type || 'user'
        }

        if (targetUid && resolvedType) {
          setType(resolvedType)
          const targetColl = resolvedType === 'user' ? 'users' : 'organizations'
          const dataSnap = await getDoc(doc(db, targetColl, targetUid))
          
          if (dataSnap.exists()) {
            setData({ id: dataSnap.id, ...dataSnap.data() })
          }
        }
      } catch (err) {
        console.error("Erro ao resolver perfil:", err)
      } finally {
        setLoading(false)
      }
    }

    resolveUsername()
  }, [db, username])

  // Lógica de Analytics (Rastreamento Real)
  React.useEffect(() => {
    if (!db || !data?.id || type !== 'organization' || trackedRef.current || data.status === 'Bloqueado' || data.status === 'Desativado' || data.status === 'Exclusão Programada') return;

    const trackVisit = async () => {
      trackedRef.current = true;
      const orgRef = doc(db, 'organizations', data.id);
      try {
        await updateDoc(orgRef, {
          totalViews: increment(1),
          metrics_views_current: increment(1)
        });

        if (user) {
          const today = new Date();
          const monthKey = `${today.getFullYear()}_${String(today.getMonth() + 1).padStart(2, '0')}`;
          const visitorKey = `${user.uid}_${monthKey}`;
          const visitorRef = doc(db, 'organizations', data.id, 'visitors', visitorKey);
          const visitorSnap = await getDoc(visitorRef);

          if (!visitorSnap.exists()) {
            await setDoc(visitorRef, { 
              userId: user.uid, 
              timestamp: serverTimestamp(),
              month: monthKey 
            });
            await updateDoc(orgRef, {
              totalReach: increment(1),
              metrics_reach_current: increment(1)
            });
          }
        }
      } catch (e) {}
    };

    trackVisit();
  }, [db, data?.id, type, user, data?.status]);

  // Busca eventos separados
  React.useEffect(() => {
    if (!db || !data?.id || type !== 'organization' || data.status === 'Bloqueado' || data.status === 'Desativado' || data.status === 'Exclusão Programada') return

    const fetchAllEvents = async () => {
      setEventsLoading(true)
      try {
        const qOwned = query(collection(db, "events"), where("organizationId", "==", data.id))
        const snapOwned = await getDocs(qOwned)
        setOwnedEvents(snapOwned.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(e => e.status === 'Ativo')
        )

        try {
          const qPartnered = query(collectionGroup(db, 'partners'), where('orgId', '==', data.id), where('status', '==', 'accepted'))
          const snapPartnered = await getDocs(qPartnered)
          const partneredEventIds = snapPartnered.docs.map(d => d.ref.parent.parent?.id).filter(Boolean) as string[]

          if (partneredEventIds.length > 0) {
             const partneredPromises = partneredEventIds.map(id => getDoc(doc(db, 'events', id!)))
             const partneredSnaps = await Promise.all(partneredPromises)
             setPartneredEvents(partneredSnaps
               .filter(s => s.exists() && s.data()?.status === 'Ativo')
               .map(s => ({ id: s.id, ...s.data() }))
             )
          } else {
            setPartneredEvents([])
          }
        } catch (cgError) {
          setPartneredEvents([]);
        }
      } catch (e) {
        console.error("Erro ao carregar eventos:", e)
      } finally {
        setEventsLoading(false)
      }
    }

    fetchAllEvents()
  }, [db, data?.id, type, data?.status])

  // Função helper para filtrar e ordenar eventos de forma inteligente
  const processEventsList = React.useCallback((evs: any[]) => {
    const now = new Date();
    
    return evs
      .filter(e => {
        const search = eventSearch.toLowerCase();
        return (
          e.title?.toLowerCase().includes(search) || 
          e.city?.toLowerCase().includes(search)
        );
      })
      .sort((a, b) => {
        const getDates = (e: any) => {
          const start = e.date?.toDate ? e.date.toDate() : new Date(e.date);
          const end = e.endDate?.toDate ? e.endDate.toDate() : (e.endDate ? new Date(e.endDate) : new Date(start.getTime() + 4 * 60 * 60 * 1000));
          return { start, end };
        }
        
        const { start: startA, end: endA } = getDates(a);
        const { start: startB, end: endB } = getDates(b);

        const isHappening = (s: Date, e: Date) => s <= now && e >= now;
        const isPast = (e: Date) => e < now;

        const hapA = isHappening(startA, endA);
        const hapB = isHappening(startB, endB);
        if (hapA && !hapB) return -1;
        if (!hapA && hapB) return 1;

        const pastA = isPast(endA);
        const pastB = isPast(endB);
        if (!pastA && pastB) return -1;
        if (pastA && !pastB) return 1;

        // Se ambos estão no mesmo grupo (acontecendo, futuro ou passado), ordena por data de início
        // Para os passados, podemos querer inverter para ver os mais recentes primeiro
        if (pastA && pastB) return startB.getTime() - startA.getTime();
        
        return startA.getTime() - startB.getTime();
      });
  }, [eventSearch]);

  const filteredOwned = React.useMemo(() => processEventsList(ownedEvents), [ownedEvents, processEventsList]);
  const filteredPartnered = React.useMemo(() => processEventsList(partneredEvents), [partneredEvents, processEventsList]);

  // Lógica de Seguidores
  const followRelationQuery = useMemoFirebase(() => {
    if (!db || !user || !data?.id) return null
    return query(
      collection(db, "follows"),
      where("followerId", "==", user.uid),
      where("followingId", "==", data.id),
      limit(1)
    )
  }, [db, user, data?.id])

  const { data: followRel } = useCollection<any>(followRelationQuery)
  const isFollowing = followRel && followRel.length > 0

  const followersCountQuery = useMemoFirebase(() => {
    if (!db || !data?.id) return null
    return query(collection(db, "follows"), where("followingId", "==", data.id))
  }, [db, data?.id])
  const { data: followersList } = useCollection<any>(followersCountQuery)

  const isSelf = user && data && type === 'user' && data.id === user.uid;

  const handleFollowToggle = async () => {
    if (!user) {
      toast({ title: "Ação necessária", description: "Entre para seguir perfis no Viby." })
      router.push("/login")
      return
    }
    if (!db || !data || followActionLoading) return

    // UID da página oficial - Impedir de deixar de seguir
    const officialOrgId = "d3c9fdc1-7fcc-4a70-ab99-79729fad2bf9";

    if (isFollowing && data.id === officialOrgId) {
      toast({ variant: "destructive", title: "Ação bloqueada", description: "Você não pode deixar de seguir a conta oficial da Viby." })
      return
    }

    setFollowActionLoading(true)
    const followId = `${user.uid}_${data.id}`
    const displayName = type === 'organization' ? data.name : data.name || data.displayName

    try {
      if (isFollowing) {
        await deleteDoc(doc(db, "follows", followRel[0].id))
        toast({ title: `Deixou de seguir ${displayName}` })
      } else {
        await setDoc(doc(db, "follows", followId), {
          followerId: user.uid,
          followingId: data.id,
          targetType: type,
          timestamp: serverTimestamp()
        });

        await processGamificationEvent(db, user.uid, type === 'organization' ? 'on_follow_org' : 'on_follow_user', {
          targetId: data.id,
          targetName: displayName,
          orgName: type === 'organization' ? displayName : null
        }, data.id);

        toast({ title: `Seguindo ${displayName}!` })
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Erro na operação" })
    } finally {
      setFollowActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-secondary" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-6">
        <AlertTriangle className="w-16 h-16 text-muted-foreground opacity-20" />
        <h2 className="text-2xl font-bold">Perfil não encontrado</h2>
        <Button asChild className="rounded-full px-8 bg-secondary text-white">
          <Link href="/dashboard">Voltar ao Início</Link>
        </Button>
      </div>
    )
  }

  const isOrg = type === 'organization'
  const displayName = isOrg ? data.name : data.name || data.displayName
  const avatar = data.avatar || `https://picsum.photos/seed/${data.id}/200/200`
  const isVerified = data.verified === true || data.isVerified === true

  return (
    <div className="flex-1">
       {isOrg && (
         <div className="h-48 md:h-64 w-full relative overflow-hidden border-b border-border shadow-sm">
            {data.banner ? (
              <img src={data.banner} className="w-full h-full object-cover" alt="Banner" />
            ) : (
              <div className="w-full h-full bg-muted/30" />
            )}
            <div className="absolute inset-0 bg-black/10" />
         </div>
       )}

       <div className={cn(
         "container mx-auto px-4 pb-20",
         isOrg ? "-mt-12 relative z-10" : "pt-12 md:pt-20"
       )}>
          <div className="max-w-4xl mx-auto">
             <div className="flex flex-col md:flex-row gap-8 items-center md:items-start mb-12 backdrop-blur-xl bg-white/40 p-8 rounded-[3rem] border border-white/50 shadow-xl">
                <div className="shrink-0">
                   <div className="p-1 rounded-full bg-gradient-to-tr from-[#2C52EE] via-[#52E9ED] to-[#9BF1F2] shadow-2xl">
                      <Avatar className="h-32 w-32 md:h-40 md:w-40 border-4 border-background">
                         <AvatarImage src={avatar} className="object-cover" />
                         <AvatarFallback className="text-4xl font-bold bg-muted">{displayName?.charAt(0)}</AvatarFallback>
                      </Avatar>
                   </div>
                   {!isOrg && levelInfo && (
                      <div className="flex justify-center -mt-6 relative z-20">
                         <Badge className="bg-primary text-white border-2 border-background h-8 px-4 font-black uppercase italic text-[10px] shadow-lg tracking-tighter">
                            LVL {levelInfo.current.level} • {levelInfo.current.name}
                         </Badge>
                      </div>
                   )}
                </div>

                <div className="flex-1 space-y-6 text-center md:text-left">
                   <div className="flex flex-col md:flex-row md:items-center gap-4">
                      <div className="flex items-center justify-center md:justify-start gap-2">
                        <h1 className="text-2xl md:text-3xl font-black tracking-tight uppercase italic text-primary">{displayName}</h1>
                        {isVerified && <VerifiedBadge />}
                      </div>
                      <div className="flex items-center justify-center gap-2">
                        {!isSelf && (
                          <Button 
                            onClick={handleFollowToggle} 
                            disabled={followActionLoading}
                            className={cn(
                              "font-bold rounded-xl h-10 px-8 text-sm transition-all shadow-lg",
                              isFollowing ? "bg-muted text-foreground" : "bg-secondary text-white hover:bg-secondary/90"
                            )}
                          >
                             {followActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : isFollowing ? "Seguindo" : "Seguir"}
                          </Button>
                        )}
                        <Button onClick={handleShare} variant="outline" size="icon" className="h-10 w-10 rounded-xl bg-white/80 border-border hover:border-secondary transition-all">
                           <Share2 className="w-4 h-4" />
                        </Button>

                        {!isSelf && user && (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl bg-white/80 border-border hover:text-destructive hover:bg-destructive/5 transition-all" title="Denunciar Perfil">
                                <Flag className="w-4 h-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-md rounded-[2rem]">
                              <form onSubmit={handleSendReport} className="space-y-6">
                                <DialogHeader>
                                  <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter flex items-center gap-2">
                                    <Flag className="w-5 h-5 text-destructive" />
                                    Denunciar Perfil
                                  </DialogTitle>
                                  <DialogDescription>Relate irregularidades ou comportamentos indevidos.</DialogDescription>
                                </DialogHeader>
                                
                                <div className="space-y-4">
                                   <div className="space-y-2">
                                      <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Motivo</Label>
                                      <Select value={reportReason} onValueChange={setReportReason} required>
                                         <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Selecione o motivo" /></SelectTrigger>
                                         <SelectContent className="rounded-xl">
                                            <SelectItem value="Fraude ou Golpe">Fraude ou Golpe</SelectItem>
                                            <SelectItem value="Evento Falso">Evento Falso</SelectItem>
                                            <SelectItem value="Conteúdo Impróprio">Conteúdo Impróprio</SelectItem>
                                            <SelectItem value="Spam / Abuso">Spam ou Abuso</SelectItem>
                                            <SelectItem value="Outro">Outro motivo</SelectItem>
                                         </SelectContent>
                                      </Select>
                                   </div>
                                   <div className="space-y-2">
                                      <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Descrição</Label>
                                      <Textarea placeholder="Detalhes do ocorrido..." value={reportDescription} onChange={(e) => setReportDescription(e.target.value)} required className="rounded-xl min-h-[120px]" />
                                   </div>
                                </div>

                                <DialogFooter>
                                   <Button type="submit" disabled={isSubmittingReport} className="w-full bg-destructive text-white font-black h-14 rounded-2xl shadow-xl uppercase italic">
                                      {isSubmittingReport ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Send className="w-5 h-5 mr-2" />}
                                      Enviar Denúncia
                                   </Button>
                                </DialogFooter>
                              </form>
                            </DialogContent>
                          </Dialog>
                        )}
                      </div>
                   </div>

                   {!isOrg && levelInfo && (
                      <div className="space-y-2">
                         <div className="flex justify-between items-end">
                            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Progresso Cultural</p>
                            <p className="text-[9px] font-black uppercase text-secondary tracking-widest">{Math.round(levelInfo.progress)}% para Nv. {levelInfo.next?.level || 'MAX'}</p>
                         </div>
                         <Progress value={levelInfo.progress} className="h-1.5" />
                         <p className="text-[9px] font-bold text-muted-foreground/60 uppercase">Total Acumulado: {gamification?.totalXp || 0} XP</p>
                      </div>
                   )}

                   <div className="flex justify-center md:justify-start gap-8">
                      {isOrg && (
                        <div className="flex flex-col items-center">
                           <span className="font-black text-xl">{ownedEvents.length}</span>
                           <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Eventos</span>
                        </div>
                      )}
                      <div className="flex flex-col items-center">
                         <span className="font-black text-xl">{followersList?.length || 0}</span>
                         <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Seguidores</span>
                      </div>
                      {!isOrg && (
                         <div className="flex flex-col items-center">
                            <span className="font-black text-xl">{culturalStats?.totalCheckins || 0}</span>
                            <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Check-ins</span>
                         </div>
                      )}
                   </div>

                   <div className="space-y-1">
                      <p className="text-sm font-black text-secondary tracking-widest uppercase">@{data.username}</p>
                      <p className="text-sm font-medium leading-relaxed max-w-lg mx-auto md:mx-0 opacity-80">
                         {data.bio || "Nenhuma biografia disponível."}
                      </p>
                      <div className="flex flex-wrap justify-center md:justify-start gap-4 pt-2">
                         {data.website && <a href={data.website} target="_blank" className="text-[11px] font-black uppercase text-blue-600 flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" /> {data.website.replace(/^https?:\/\//, '')}</a>}
                         {data.instagram && <a href={`https://instagram.com/${data.instagram.replace(/^@/, '')}`} target="_blank" className="text-[11px] font-black uppercase flex items-center gap-1.5"><Instagram className="w-3.5 h-3.5 text-pink-500" /> @{data.instagram.replace(/^@/, '')}</a>}
                         {data.city && <div className="text-[11px] font-black uppercase text-muted-foreground flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-secondary" /> {data.city}, {data.state}</div>}
                      </div>
                   </div>
                </div>
             </div>

             {isOrg ? (
               <Tabs defaultValue="events" className="w-full">
                  <div className="flex flex-col md:flex-row md:items-center justify-between border-b mb-8 bg-white/40 backdrop-blur-md rounded-2xl p-1 gap-4 px-4">
                    <TabsList className="bg-transparent h-auto p-0 gap-8 justify-start">
                      <TabsTrigger value="events" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-secondary rounded-none px-4 py-4 font-black uppercase text-[11px] tracking-widest flex items-center gap-2 opacity-50 data-[state=active]:opacity-100"><Grid className="w-3.5 h-3.5" /> Eventos</TabsTrigger>
                      <TabsTrigger value="partnerships" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-secondary rounded-none px-4 py-4 font-black uppercase text-[11px] tracking-widest flex items-center gap-2 opacity-50 data-[state=active]:opacity-100"><Handshake className="w-3.5 h-3.5" /> Parcerias</TabsTrigger>
                      <TabsTrigger value="about" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-secondary rounded-none px-4 py-4 font-black uppercase text-[11px] tracking-widest flex items-center gap-2 opacity-50 data-[state=active]:opacity-100"><Info className="w-3.5 h-3.5" /> Sobre</TabsTrigger>
                    </TabsList>

                    <div className="relative w-full md:w-64 mb-2 md:mb-0">
                       <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground opacity-50" />
                       <Input 
                         placeholder="Buscar evento ou cidade..." 
                         value={eventSearch}
                         onChange={(e) => setEventSearch(e.target.value)}
                         className="h-9 text-[11px] font-bold uppercase pl-9 rounded-xl border-dashed border-secondary/20 bg-background/50 focus-visible:ring-secondary/30"
                       />
                    </div>
                  </div>

                  <TabsContent value="events" className="animate-in fade-in duration-500">
                     {eventsLoading ? (
                       <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-secondary" /></div>
                     ) : filteredOwned.length > 0 ? (
                       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                         {filteredOwned.map(e => <EventCard key={e.id} event={e} />)}
                       </div>
                     ) : (
                       <NoContentPlaceholder message={eventSearch ? "Nenhum evento encontrado para esta busca." : "Nenhum evento produzido no momento."} />
                     )}
                  </TabsContent>
                  <TabsContent value="partnerships" className="animate-in fade-in duration-500">
                     {eventsLoading ? (
                       <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-secondary" /></div>
                     ) : filteredPartnered.length > 0 ? (
                       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                         {filteredPartnered.map(e => <EventCard key={e.id} event={e} />)}
                       </div>
                     ) : (
                       <NoContentPlaceholder message={eventSearch ? "Nenhuma parceria encontrada para esta busca." : "Nenhuma parceria ativa no momento."} />
                     )}
                  </TabsContent>
                  <TabsContent value="about" className="animate-in fade-in duration-500">
                     <div className="max-w-2xl mx-auto space-y-10">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-white p-8 rounded-[2.5rem] shadow-sm border">
                           <div className="space-y-6">
                              <div className="space-y-1"><p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest opacity-40">Razão Social</p><p className="font-bold text-sm">{data.legalName || "Não informada"}</p></div>
                              <div className="space-y-1"><p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest opacity-40">Localidade</p><p className="font-bold text-sm">{data.city}, {data.state}</p></div>
                           </div>
                           <div className="space-y-6">
                              <div className="space-y-1"><p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest opacity-40">Segmento</p><Badge variant="outline" className="bg-secondary/10 text-secondary border-none uppercase text-[10px] font-black">{data.type || "Marca"}</Badge></div>
                           </div>
                        </div>
                        <div className="bg-muted/30 p-8 rounded-[2.5rem] border border-dashed border-border/60"><p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-4 opacity-40">Sobre a {displayName}</p><p className="text-sm leading-relaxed whitespace-pre-line text-foreground/80 font-medium italic">{data.bio || "Nenhuma descrição adicional informada."}</p></div>
                     </div>
                  </TabsContent>
               </Tabs>
             ) : (
               <div className="space-y-12">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                     <Card className="border-none shadow-sm rounded-[2rem] bg-white p-6 flex flex-col items-center text-center gap-3">
                        <div className="p-3 bg-secondary/10 rounded-2xl text-secondary"><Sparkles className="w-6 h-6" /></div>
                        <div>
                           <p className="text-[9px] font-black uppercase text-muted-foreground opacity-40">Categoria Favorita</p>
                           <p className="text-lg font-black uppercase italic tracking-tighter text-primary">{culturalStats?.topCategory || "Explorando..."}</p>
                        </div>
                     </Card>
                     <Card className="border-none shadow-sm rounded-[2rem] bg-white p-6 flex flex-col items-center text-center gap-3">
                        <div className="p-3 bg-primary/5 rounded-2xl text-primary"><MapIcon className="w-6 h-6" /></div>
                        <div>
                           <p className="text-[9px] font-black uppercase text-muted-foreground opacity-40">Bairro Favorito</p>
                           <p className="text-lg font-black uppercase italic tracking-tighter text-primary">{culturalStats?.topNeighborhood || "Descobrindo..."}</p>
                        </div>
                     </Card>
                     <Card className="border-none shadow-sm rounded-[2rem] bg-white p-6 flex flex-col items-center text-center gap-3">
                        <div className="p-3 bg-green-50 rounded-2xl text-green-600"><Target className="w-6 h-6" /></div>
                        <div>
                           <p className="text-[9px] font-black uppercase text-muted-foreground opacity-40">Cultura Eclética</p>
                           <p className="text-lg font-black uppercase italic tracking-tighter text-primary">{culturalStats?.categoriesExplored?.length || 0} Estilos</p>
                        </div>
                     </Card>

                     <Card className="border-none shadow-sm rounded-[2rem] bg-white p-6 flex flex-col items-center text-center gap-3">
                        <div className="p-3 bg-orange-50 rounded-2xl text-orange-600"><Globe className="w-6 h-6" /></div>
                        <div>
                           <p className="text-[9px] font-black uppercase text-muted-foreground opacity-40">Cidade Favorita</p>
                           <p className="text-lg font-black uppercase italic tracking-tighter text-primary">{culturalStats?.topCity || "Nômade..."}</p>
                        </div>
                     </Card>
                     <Card className="border-none shadow-sm rounded-[2rem] bg-white p-6 flex flex-col items-center text-center gap-3">
                        <div className="p-3 bg-blue-50 rounded-2xl text-blue-600"><Navigation className="w-6 h-6" /></div>
                        <div>
                           <p className="text-[9px] font-black uppercase text-muted-foreground opacity-40">Cidades Desbravadas</p>
                           <p className="text-lg font-black uppercase italic tracking-tighter text-primary">{culturalStats?.citiesExplored?.length || 0} Cidades</p>
                        </div>
                     </Card>
                     <Card className="border-none shadow-sm rounded-[2rem] bg-white p-6 flex flex-col items-center text-center gap-3">
                        <div className="p-3 bg-purple-50 rounded-2xl text-purple-600"><MapPin className="w-6 h-6" /></div>
                        <div>
                           <p className="text-[9px] font-black uppercase text-muted-foreground opacity-40">Bairros Dominados</p>
                           <p className="text-lg font-black uppercase italic tracking-tighter text-primary">{culturalStats?.neighborhoodsExplored?.length || 0} Regiões</p>
                        </div>
                     </Card>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <div className="space-y-6">
                        <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 px-2">
                           <TrendingUp className="w-4 h-4 text-secondary" /> Marcas Favoritas
                        </h2>
                        {culturalStats?.favoriteOrganizers?.length > 0 ? (
                           <div className="space-y-3">
                              {culturalStats.favoriteOrganizers.slice(0, 3).map((org: string, i: number) => (
                                 <div key={i} className="flex items-center justify-between p-4 bg-white/60 rounded-3xl border border-white/60 shadow-sm">
                                    <div className="flex items-center gap-3">
                                       <div className="h-10 w-10 rounded-2xl bg-muted flex items-center justify-center text-[10px] font-black">{i + 1}</div>
                                       <span className="font-bold text-sm uppercase">{org}</span>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-muted-foreground opacity-20" />
                                 </div>
                              ))}
                           </div>
                        ) : (
                           <div className="p-8 text-center bg-white/20 rounded-[2.5rem] border border-dashed text-[9px] font-bold text-muted-foreground uppercase">Explorando marcas...</div>
                        )}
                     </div>

                     <div className="space-y-6">
                        <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 px-2">
                           <BarChart3 className="w-4 h-4 text-secondary" /> Ranking de Presença
                        </h2>
                        <Card className={cn("border-none shadow-xl rounded-[2.5rem] p-8 relative overflow-hidden transition-all duration-500", bestRankInfo.color, bestRankInfo.text)}>
                           <div className="relative z-10 space-y-4">
                              <p className={cn("text-[10px] font-black uppercase tracking-widest", bestRankInfo.badge)}>{bestRankInfo.scope}</p>
                              <div className="flex items-baseline gap-2">
                                 <span className="text-6xl font-black italic tracking-tighter">{bestRankInfo.rank}</span>
                                 <span className={cn("text-[10px] font-black uppercase", bestRankInfo.badge)}>
                                   {bestRankInfo.rank === '#1' ? 'Líder Absoluto' : `Membro Ativo`}
                                 </span>
                              </div>
                              <p className="text-[10px] font-medium leading-relaxed opacity-70 uppercase max-w-[240px]">
                                {bestRankInfo.rank === '#1' 
                                  ? 'Destaque absoluto. Este usuário é a maior referência cultural neste escopo.' 
                                  : 'Este usuário está entre os exploradores mais ativos da cena cultural.'}
                              </p>
                           </div>
                           <Trophy className="absolute -bottom-6 -right-6 w-40 h-40 opacity-10 rotate-12" />
                        </Card>
                     </div>
                  </div>
               </div>
             )}
          </div>
       </div>
    </div>
  )
}

function NoContentPlaceholder({ message }: { message: string }) {
  return (
    <div className="py-24 text-center space-y-4 bg-white/20 rounded-[3rem] border-2 border-dashed border-border/40">
      <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto opacity-20"><Calendar className="w-8 h-8" /></div>
      <p className="text-muted-foreground font-black uppercase tracking-widest text-[10px]">{message}</p>
    </div>
  )
}

export default function UniversalProfilePage() {
  return (
    <OrganizationProvider>
      <SidebarProvider>
        <div className="flex min-h-screen w-full bg-[#f8fafc]">
          <AppSidebar />
          <main className="flex-1 flex flex-col overflow-y-auto">
            <ProfileHeader />
            <UniversalProfileContent />
            <Footer />
          </main>
        </div>
      </SidebarProvider>
    </OrganizationProvider>
  )
}
