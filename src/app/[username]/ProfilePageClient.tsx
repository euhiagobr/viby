"use client";

import * as React from "react";
import { useFirestore, useAuth, useUser, useDoc, useCollection, useMemoFirebase } from "@/firebase";
import { doc, getDoc, collection, query, where, getDocs, collectionGroup, orderBy, limit } from "firebase/firestore";
import { Loader2, Lock, ArrowLeft, Home, ShieldAlert, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdsRenderer } from "@/components/ads/AdsRenderer";
import Link from "next/link";
import { motion } from "framer-motion";
import Image from "next/image";
import { UserNav } from "@/components/layout/UserNav";
import { ShareModal } from "@/components/sharing/ShareModal";
import { recordQrScan } from "@/app/actions/qr";
import { useSearchParams } from "next/navigation";

// Components - Organization
import { OrganizerHero } from "@/components/organizer/OrganizerHero";
import { OrganizerEvents } from "@/components/organizer/OrganizerEvents";
import { OrganizerAbout } from "@/components/organizer/OrganizerAbout";
import { OrganizerGallery } from "@/components/organizer/OrganizerGallery";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Components - User (Social/Gamified)
import { UserHero } from "@/components/profile/user/UserHero";
import { UserSocialContent } from "@/components/profile/user/UserSocialContent";
import { UserEventsContent } from "@/components/profile/user/UserEventsContent";
import { UserGamification } from "@/components/profile/user/UserGamification";

import Footer from "@/components/layout/Footer";
import { LanguageSelector } from "@/components/layout/LanguageSelector"
import { CurrencySelector } from "@/components/layout/CurrencySelector"

export default function ProfilePageClient({ username }: { username: string }) {
  const db = useFirestore();
  const auth = useAuth();
  const searchParams = useSearchParams();
  const { user: loggedUser } = useUser(auth);
  
  const [loading, setLoading] = React.useState(true);
  const [profileData, setProfileData] = React.useState<any>(null);
  const [profileType, setProfileType] = React.useState<'user' | 'organization' | null>(null);
  const [isOwner, setIsOwner] = React.useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = React.useState(false);
  const [now, setNow] = React.useState<Date>(new Date());

  // Estado para eventos em parceria
  const [partnershipEvents, setPartnershipEvents] = React.useState<any[]>([]);
  const [loadingPartnerships, setLoadingPartnerships] = React.useState(false);

  React.useEffect(() => {
    setNow(new Date());
  }, []);

  // Rastreamento de Scan de QR Code
  React.useEffect(() => {
    const vsrc = searchParams.get('vsrc');
    if (vsrc === 'qr' && profileData?.id && profileType === 'organization') {
      recordQrScan({
        organizationId: profileData.id,
        scanType: 'organization'
      });
    }
  }, [searchParams, profileData?.id, profileType]);

  const settingsRef = React.useMemo(() => (db ? doc(db, "settings", "site") : null), [db]);
  const { data: settings } = useDoc<any>(settingsRef);
  const siteName = settings?.siteName || "Viby";

  // Busca de Dados Integrada via Índice de Usernames
  React.useEffect(() => {
    if (!db || !username) return;
    
    const fetchData = async () => {
      setLoading(true);
      try {
        const normalized = username.toLowerCase().trim();
        const uRef = doc(db, "usernames", normalized);
        const uSnap = await getDoc(uRef);
        
        if (uSnap.exists()) {
          const { uid, type } = uSnap.data();
          setProfileType(type);
          
          const coll = type === 'user' ? 'users' : 'organizations';
          const dataSnap = await getDoc(doc(db, coll, uid));
          
          if (dataSnap.exists()) {
            setProfileData({ id: dataSnap.id, ...dataSnap.data() });
          } else {
            setProfileData(null);
          }
        } else {
          setProfileData(null);
        }
      } catch (e) {
        console.error("Integrity Error:", e);
        setProfileData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [db, username]);

  // Auditoria de Propriedade/Acesso
  React.useEffect(() => {
    if (!db || !loggedUser?.uid || !profileData || !profileType) {
      setIsOwner(false);
      return;
    }

    const checkOwnership = async () => {
      try {
        if (profileType === 'organization') {
          const memberRef = doc(db, 'organizations', profileData.id, 'members', loggedUser.uid);
          const memberSnap = await getDoc(memberRef);
          setIsOwner(memberSnap.exists());
        } else {
          setIsOwner(loggedUser.uid === profileData.id);
        }
      } catch (e) {
        setIsOwner(false);
      }
    };

    checkOwnership();
  }, [db, loggedUser?.uid, profileData, profileType]);

  // Busca de Dados de Gamificação (Apenas se for usuário)
  const gamificationRef = React.useMemo(() => 
    (db && profileType === 'user' && profileData?.id) ? doc(db, "user_gamification", profileData.id) : null, 
    [db, profileType, profileData?.id]
  );
  const { data: gamification } = useDoc<any>(gamificationRef);

  const statsRef = React.useMemo(() => 
    (db && profileType === 'user' && profileData?.id) ? doc(db, "cultural_stats", profileData.id) : null, 
    [db, profileType, profileData?.id]
  );
  const { data: culturalStats } = useDoc<any>(statsRef);

  const activitiesQuery = useMemoFirebase(() => {
    if (!db || profileType !== 'user' || !profileData?.id || (!isOwner && profileData.privacy?.hideStats)) return null;
    return query(
      collection(db, "xp_logs"),
      where("userId", "==", profileData.id),
      orderBy("timestamp", "desc"),
      limit(15)
    );
  }, [db, profileType, profileData?.id, isOwner, profileData?.privacy?.hideStats]);
  const { data: activities } = useCollection<any>(activitiesQuery);

  const userRegistrationsQuery = useMemoFirebase(() => {
    if (!db || profileType !== 'user' || !profileData?.id || !isOwner) return null;
    return query(
      collection(db, "registrations"),
      where("userId", "==", profileData.id)
    );
  }, [db, profileType, profileData?.id, isOwner]);
  const { data: userRegistrations } = useCollection<any>(userRegistrationsQuery);

  // Busca de Eventos da Organização
  const orgEventsQuery = useMemoFirebase(() => {
    if (!db || !profileData?.id || profileType !== 'organization') return null;
    return query(
      collection(db, "events"),
      where("organizationId", "==", profileData.id),
      where("status", "==", "Ativo")
    );
  }, [db, profileData?.id, profileType]);

  const { data: orgEvents } = useCollection<any>(orgEventsQuery);

  // Busca de Eventos em Parceria
  React.useEffect(() => {
    if (!db || !profileData?.id || profileType !== 'organization') return;

    const fetchPartnershipEvents = async () => {
      setLoadingPartnerships(true);
      try {
        const q = query(
          collectionGroup(db, 'partners'),
          where('orgId', '==', profileData.id),
          where('status', '==', 'accepted')
        );
        const snap = await getDocs(q);
        
        const eventPromises = snap.docs.map(async (d) => {
          const eventId = d.ref.parent.parent?.id;
          if (!eventId) return null;
          const eSnap = await getDoc(doc(db, 'events', eventId));
          return eSnap.exists() ? { id: eSnap.id, ...eSnap.data() } : null;
        });

        const results = await Promise.all(eventPromises);
        setPartnershipEvents(results.filter(e => e !== null && e.status === 'Ativo'));
      } catch (e: any) {
        console.warn("Erro ao buscar parcerias:", e.message);
      } finally {
        setLoadingPartnerships(false);
      }
    };

    fetchPartnershipEvents();
  }, [db, profileData?.id, profileType]);

  const { upcomingEvents, pastEvents } = React.useMemo(() => {
    if (!orgEvents) return { upcomingEvents: [], pastEvents: [] };
    const referenceDate = new Date();
    
    const upcoming = orgEvents.filter((e: any) => {
      const start = e.date?.toDate ? e.date.toDate() : new Date(e.date);
      const end = e.endDate?.toDate ? e.endDate.toDate() : (e.endDate ? new Date(e.endDate) : new Date(start.getTime() + 4 * 60 * 60 * 1000));
      return end >= referenceDate;
    }).sort((a, b) => {
      const tA = a.date?.seconds || new Date(a.date).getTime();
      const tB = b.date?.seconds || new Date(b.date).getTime();
      return tA - tB;
    });

    const past = orgEvents.filter((e: any) => {
      const start = e.date?.toDate ? e.date.toDate() : new Date(e.date);
      const end = e.endDate?.toDate ? e.endDate.toDate() : (e.endDate ? new Date(e.endDate) : new Date(start.getTime() + 4 * 60 * 60 * 1000));
      return end < referenceDate;
    }).sort((a, b) => {
      const tA = a.date?.seconds || new Date(a.date).getTime();
      const tB = b.date?.seconds || new Date(b.date).getTime();
      return tB - tA;
    });

    return { upcomingEvents: upcoming, pastEvents: past };
  }, [orgEvents]);

  const unifiedUpcomingFeed = React.useMemo(() => {
    const result = [];
    let eventCounter = 0;
    let adIndex = 0;

    if (upcomingEvents.length === 0) {
      if (!loading && profileType === 'organization') {
        result.push({ type: "ad", adIndex: adIndex++ });
        result.push({ type: "ad", adIndex: adIndex++ });
      }
      return result;
    }

    for (let i = 0; i < upcomingEvents.length; i++) {
      result.push({ type: "event", data: upcomingEvents[i] });
      eventCounter++;

      if (eventCounter === 6) {
        result.push({ type: "ad", adIndex: adIndex++ });
        eventCounter = 0;
      }
    }

    return result;
  }, [upcomingEvents, loading, profileType]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>;
  }

  const isUnavailable = !profileData || 
    (['Bloqueado', 'Excluído', 'Desativado', 'Exclusão Programada'].includes(profileData.status) && !isOwner);

  if (isUnavailable) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-4 text-center selection:bg-secondary selection:text-white">
        <div className="relative w-full max-w-lg mb-12">
          <div className="absolute inset-0 bg-secondary/10 blur-3xl rounded-full" />
          <div className="relative">
            <div className="w-24 h-24 bg-white rounded-[2rem] shadow-2xl flex items-center justify-center mx-auto mb-8">
              <ShieldAlert className="w-12 h-12 text-secondary" />
            </div>
            <h1 className="text-5xl md:text-7xl font-black text-primary uppercase italic tracking-tighter leading-none mb-4">AVISO</h1>
            <h2 className="text-2xl md:text-3xl font-black uppercase italic tracking-tight text-primary">Página <span className="text-secondary">Indisponível</span></h2>
            <p className="mt-6 text-muted-foreground font-medium max-sm mx-auto leading-relaxed">A página que você solicitou não está mais disponível na plataforma Viby.</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 w-full max-md">
          <Button variant="outline" asChild className="flex-1 h-14 rounded-2xl font-black uppercase italic border-2 gap-2 border-primary/10 hover:bg-muted"><Link href="/"><ArrowLeft className="w-5 h-5" /> Voltar</Link></Button>
          <Button asChild className="flex-1 h-14 bg-primary text-white font-black rounded-2xl shadow-xl uppercase italic gap-2 hover:bg-secondary transition-all"><Link href="/"><Home className="w-5 h-5" /> Ver Outros</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col selection:bg-secondary selection:text-white">
      <nav className="fixed top-0 z-50 w-full bg-background/80 backdrop-blur-xl border-b border-border/40">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            {settings?.logoUrl ? (
              <Image src={settings.logoUrl} alt={siteName} width={120} height={40} className="h-8 w-auto object-contain transition-transform group-hover:scale-105" priority unoptimized />
            ) : (
              <span className="text-xl font-bold tracking-tight italic uppercase">{siteName}</span>
            )}
          </Link>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-1">
               <LanguageSelector />
               <CurrencySelector />
            </div>
            {profileType === 'organization' && (
              <Button 
                onClick={() => setIsShareModalOpen(true)}
                className="bg-secondary text-white font-black uppercase italic text-[10px] tracking-widest rounded-full px-6 shadow-lg shadow-secondary/10 gap-2"
              >
                <Share2 className="w-3.5 h-3.5" /> Compartilhar Agenda
              </Button>
            )}
            {loggedUser ? <UserNav /> : (
              <Button asChild className="bg-primary text-white font-black uppercase italic text-[10px] tracking-widest rounded-full px-6"><Link href="/login">Acessar Clube</Link></Button>
            )}
          </div>
        </div>
      </nav>

      <main className="flex-1 pb-32 pt-16">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
          {profileType === 'organization' ? (
            <>
              <OrganizerHero 
                organization={profileData} 
                realFollowersCount={profileData.followersCount || 0}
                realUpcomingCount={upcomingEvents.length}
                realPastCount={pastEvents.length}
                realAttendeesCount={profileData.totalAttendeesCount || 0}
                isOwner={isOwner}
              />
              <div className="container mx-auto px-4 mt-12 max-w-6xl">
                <Tabs defaultValue="upcoming" className="w-full">
                  <div className="flex justify-center mb-12">
                    <TabsList className="bg-muted/50 p-1 rounded-2xl h-14 overflow-x-auto flex-nowrap scrollbar-hide">
                      <TabsTrigger value="upcoming" className="rounded-xl font-black uppercase text-[10px] tracking-widest px-8">Agenda</TabsTrigger>
                      <TabsTrigger value="partnerships" className="rounded-xl font-black uppercase text-[10px] tracking-widest px-8">Co-organizadores</TabsTrigger>
                      <TabsTrigger value="past" className="rounded-xl font-black uppercase text-[10px] tracking-widest px-8">Histórico</TabsTrigger>
                      <TabsTrigger value="about" className="rounded-xl font-black uppercase text-[10px] tracking-widest px-8">Sobre</TabsTrigger>
                    </TabsList>
                  </div>
                  <TabsContent value="upcoming" className="animate-in fade-in duration-500">
                    <div className="space-y-8">
                       {unifiedUpcomingFeed.length === 0 && <OrganizerEvents events={[]} title="Próximos Eventos" />}
                       
                       {unifiedUpcomingFeed.length > 0 && (
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {unifiedUpcomingFeed.map((item: any, idx: number) => (
                              item.type === 'ad' ? (
                                <AdsRenderer 
                                  key={`ad-slot-${item.adIndex}-${idx}`} 
                                  location="profile" 
                                  index={item.adIndex} 
                                  googleSlotId="profile-feed-slot" 
                                />
                              ) : (
                                <OrganizerEvents key={`event-${item.data.id}-${idx}`} events={[item.data]} title="" />
                              )
                            ))}
                         </div>
                       )}
                    </div>
                  </TabsContent>
                  <TabsContent value="partnerships" className="animate-in fade-in duration-500">
                    <OrganizerEvents events={partnershipEvents} title="Eventos em Co-realização" />
                  </TabsContent>
                  <TabsContent value="past" className="animate-in fade-in duration-500">
                    <OrganizerEvents events={pastEvents} title="Experiências Passadas" isPast />
                    <OrganizerGallery gallery={profileData.gallery || []} />
                  </TabsContent>
                  <TabsContent value="about" className="animate-in fade-in duration-500">
                    <OrganizerAbout organization={profileData} />
                  </TabsContent>
                </Tabs>
              </div>

              {profileData && (
                <ShareModal 
                  isOpen={isShareModalOpen} 
                  onOpenChange={setIsShareModalOpen} 
                  data={{
                    title: profileData.name,
                    username: profileData.username,
                    url: `/${profileData.username}`,
                    logoUrl: profileData.avatar,
                    bannerUrl: profileData.banner,
                    type: 'organization',
                    organizationId: profileData.id,
                    verified: profileData.verified || profileData.isVerified
                  }}
                />
              )}
            </>
          ) : (
            <div className="space-y-12">
              <UserHero 
                profile={profileData} 
                gamification={gamification}
                followersCount={profileData.followersCount || 0}
                followingCount={profileData.followingCount || 0}
                eventsCount={profileData.totalEventsCount || 0}
                isOwner={isOwner}
              />
              <div className="container mx-auto px-4 max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-12">
                 <div className="lg:col-span-8 space-y-20">
                    {(!profileData.privacy?.hideGamification || isOwner) ? (
                      <UserGamification gamification={gamification} />
                    ) : (
                      <div className="p-12 border-2 border-dashed rounded-[3rem] text-center bg-muted/10">
                        <Lock className="w-10 h-10 text-muted-foreground opacity-20 mx-auto mb-2" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">O progresso cultural deste membro é privado.</p>
                      </div>
                    )}
                    <UserSocialContent 
                      profile={profileData} 
                      stats={culturalStats} 
                      activities={activities || []} 
                      isOwner={isOwner} 
                    />
                 </div>
                 <aside className="lg:col-span-4 space-y-12">
                    <UserEventsContent registrations={userRegistrations || []} isOwner={isOwner} />
                 </aside>
              </div>

              {profileData && (
                <ShareModal 
                  isOpen={isShareModalOpen} 
                  onOpenChange={setIsShareModalOpen} 
                  data={{
                    title: profileData.name,
                    username: profileData.username,
                    url: `/${profileData.username}`,
                    logoUrl: profileData.avatar,
                    bannerUrl: profileData.banner,
                    type: 'user',
                    organizationId: profileData.id,
                    verified: profileData.isVerified
                  }}
                />
              )}
            </div>
          )}
        </motion.div>
      </main>
      <Footer />
    </div>
  );
}