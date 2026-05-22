
"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { useFirestore, useCollection, useMemoFirebase, useAuth, useUser } from "@/firebase"
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
  updateDoc
} from "firebase/firestore"
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
  Phone
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { EventCard } from "@/components/events/EventCard"
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
import { toast } from "@/hooks/use-toast"

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
  const auth = useAuth()
  const { user } = useUser(auth)
  const username = (params.username as string).toLowerCase()

  const [loading, setLoading] = React.useState(true)
  const [data, setData] = React.useState<any>(null)
  const [type, setType] = React.useState<'user' | 'organization' | null>(null)
  const [followActionLoading, setFollowActionLoading] = React.useState(false)
  
  const [ownedEvents, setOwnedEvents] = React.useState<any[]>([])
  const [partneredEvents, setPartneredEvents] = React.useState<any[]>([])
  const [eventsLoading, setEventsLoading] = React.useState(false)

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
    if (!db || !data?.id || type !== 'organization' || trackedRef.current) return;

    const trackVisit = async () => {
      trackedRef.current = true;
      const orgRef = doc(db, 'organizations', data.id);
      const today = new Date();
      const monthKey = `${today.getFullYear()}_${String(today.getMonth() + 1).padStart(2, '0')}`;

      try {
        await updateDoc(orgRef, {
          totalViews: increment(1),
          metrics_views_current: increment(1)
        });

        if (user) {
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
      } catch (e) {
        // Falha silenciosa
      }
    };

    trackVisit();
  }, [db, data?.id, type, user]);

  // Busca eventos separados (Produzidos vs Parcerias)
  React.useEffect(() => {
    if (!db || !data?.id || type !== 'organization') return

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
        } catch (cgError: any) {
          setPartneredEvents([]);
        }
      } catch (e) {
        console.error("Erro ao carregar eventos:", e)
      } finally {
        setEventsLoading(false)
      }
    }

    fetchAllEvents()
  }, [db, data?.id, type])

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

  const isSelf = user && data && (data.id === user.uid || (type === 'organization' && data.createdBy === user.uid));

  const handleFollowToggle = async () => {
    if (!user) {
      toast({ title: "Ação necessária", description: "Entre para seguir perfis no Viby." })
      router.push("/login")
      return
    }
    if (!db || !data || followActionLoading) return

    if (isSelf) {
      toast({ variant: "destructive", title: "Operação inválida", description: "Você não pode seguir sua própria conta." })
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
        })
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
                              isFollowing ? "bg-muted text-foreground" : "bg-secondary text-white"
                            )}
                          >
                             {followActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : isFollowing ? "Seguindo" : "Seguir"}
                          </Button>
                        )}
                        <Button onClick={handleShare} variant="outline" size="icon" className="h-10 w-10 rounded-xl bg-white/80 border-border hover:border-secondary transition-all">
                           <Share2 className="w-4 h-4" />
                        </Button>
                      </div>
                   </div>

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
                   </div>

                   <div className="space-y-1">
                      <p className="text-sm font-black text-secondary tracking-widest uppercase">@{data.username}</p>
                      <p className="text-sm font-medium leading-relaxed max-w-lg mx-auto md:mx-0 opacity-80">
                         {data.bio || "Nenhuma biografia disponível."}
                      </p>
                      <div className="flex flex-wrap justify-center md:justify-start gap-4 pt-2">
                         {data.website && <a href={data.website} target="_blank" className="text-[11px] font-black uppercase text-blue-600 flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" /> {data.website.replace(/^https?:\/\//, '')}</a>}
                         {data.instagram && (
                           <a 
                             href={`https://instagram.com/${data.instagram.replace(/^@/, '')}`} 
                             target="_blank" 
                             className="text-[11px] font-black uppercase flex items-center gap-1.5"
                           >
                             <Instagram className="w-3.5 h-3.5 text-pink-500" /> @{data.instagram.replace(/^@/, '')}
                           </a>
                         )}
                         {(data.phone || data.whatsapp) && (
                           <a 
                             href={`https://wa.me/${(data.phone || data.whatsapp).replace(/\D/g, '')}`} 
                             target="_blank" 
                             className="text-[11px] font-black uppercase flex items-center gap-1.5"
                           >
                             <Phone className="w-3.5 h-3.5 text-green-500" /> WhatsApp
                           </a>
                         )}
                         {data.city && <div className="text-[11px] font-black uppercase text-muted-foreground flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-secondary" /> {data.city}, {data.state}</div>}
                      </div>
                   </div>
                </div>
             </div>

             {isOrg && (
               <Tabs defaultValue="events" className="w-full">
                  <div className="flex justify-center border-b mb-8 bg-white/40 backdrop-blur-md rounded-2xl p-1">
                    <TabsList className="bg-transparent h-auto p-0 gap-8">
                      <TabsTrigger 
                        value="events" 
                        className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-secondary rounded-none px-4 py-4 font-black uppercase text-[11px] tracking-widest flex items-center gap-2 opacity-50 data-[state=active]:opacity-100"
                      >
                        <Grid className="w-3.5 h-3.5" /> Eventos
                      </TabsTrigger>
                      <TabsTrigger 
                        value="partnerships" 
                        className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-secondary rounded-none px-4 py-4 font-black uppercase text-[11px] tracking-widest flex items-center gap-2 opacity-50 data-[state=active]:opacity-100"
                      >
                        <Handshake className="w-3.5 h-3.5" /> Parcerias
                      </TabsTrigger>
                      <TabsTrigger 
                        value="about" 
                        className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-secondary rounded-none px-4 py-4 font-black uppercase text-[11px] tracking-widest flex items-center gap-2 opacity-50 data-[state=active]:opacity-100"
                      >
                        <Info className="w-3.5 h-3.5" /> Sobre
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  <TabsContent value="events" className="animate-in fade-in duration-500">
                     {eventsLoading ? (
                       <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-secondary" /></div>
                     ) : ownedEvents.length > 0 ? (
                       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {ownedEvents.map(e => <EventCard key={e.id} event={e} />)}
                       </div>
                     ) : <NoContentPlaceholder message="Nenhum evento produzido no momento." />}
                  </TabsContent>

                  <TabsContent value="partnerships" className="animate-in fade-in duration-500">
                     {eventsLoading ? (
                       <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-secondary" /></div>
                     ) : partneredEvents.length > 0 ? (
                       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {partneredEvents.map(e => <EventCard key={e.id} event={e} />)}
                       </div>
                     ) : <NoContentPlaceholder message="Nenhuma parceria ativa no momento." />}
                  </TabsContent>

                  <TabsContent value="about" className="animate-in fade-in duration-500">
                     <div className="max-w-2xl mx-auto space-y-10">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-white p-8 rounded-[2.5rem] shadow-sm border">
                           <div className="space-y-6">
                              <div className="space-y-1">
                                 <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest opacity-40">Razão Social</p>
                                 <p className="font-bold text-sm">{data.legalName || "Não informada"}</p>
                              </div>
                              <div className="space-y-1">
                                 <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest opacity-40">Documento (CNPJ)</p>
                                 <p className="font-mono text-sm font-bold">{data.cnpj || "---"}</p>
                              </div>
                           </div>
                           <div className="space-y-6">
                              <div className="space-y-1">
                                 <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest opacity-40">Segmento</p>
                                 <Badge variant="outline" className="bg-secondary/10 text-secondary border-none uppercase text-[10px] font-black">{data.type || "Marca"}</Badge>
                              </div>
                              <div className="space-y-1">
                                 <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest opacity-40">Localidade</p>
                                 <p className="font-bold text-sm">{data.city ? `${data.city}, ${data.state}` : "Localização Global"}</p>
                              </div>
                           </div>
                        </div>
                        
                        <div className="bg-muted/30 p-8 rounded-[2.5rem] border border-dashed border-border/60">
                           <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-4 opacity-40">Sobre a {displayName}</p>
                           <p className="text-sm leading-relaxed whitespace-pre-line text-foreground/80 font-medium italic">{data.bio || "Nenhuma descrição adicional informada."}</p>
                        </div>
                     </div>
                  </TabsContent>
               </Tabs>
             )}

             {!isOrg && (
                <div className="max-w-2xl mx-auto mt-12 bg-white/40 backdrop-blur-md p-8 rounded-[3rem] border border-white/50 text-center">
                   <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground mb-4 opacity-40">Presença no Viby</p>
                   <div className="flex justify-center gap-12">
                      <div className="text-center">
                         <p className="text-2xl font-black">{followersList?.length || 0}</p>
                         <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Seguidores</p>
                      </div>
                      <div className="w-px h-10 bg-border/40" />
                      <div className="text-center">
                         <p className="text-2xl font-black">START</p>
                         <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Membro</p>
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
