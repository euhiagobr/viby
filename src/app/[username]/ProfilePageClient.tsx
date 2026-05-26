
"use client";

import * as React from "react";
import { useFirestore, useAuth, useUser, useDoc, useCollection, useMemoFirebase } from "@/firebase";
import { doc, getDoc, collection, query, where, orderBy, limit } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { Loader2, LogOut, User as UserIcon, Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "@/hooks/use-toast";
import Image from "next/image";

// Components - Organization
import { OrganizerHero } from "@/components/organizer/OrganizerHero";
import { OrganizerEvents } from "@/components/organizer/OrganizerEvents";
import { OrganizerAbout } from "@/components/organizer/OrganizerAbout";
import { OrganizerGallery } from "@/components/organizer/OrganizerGallery";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Components - User (Social/Gamified)
import { UserHero } from "@/components/profile/user/UserHero";
import { UserGamification } from "@/components/profile/user/UserGamification";
import { UserSocialContent } from "@/components/profile/user/UserSocialContent";
import { UserEventsContent } from "@/components/profile/user/UserEventsContent";

import Footer from "@/components/layout/Footer";

export default function ProfilePageClient({ username }: { username: string }) {
  const db = useFirestore();
  const auth = useAuth();
  const { user: loggedUser } = useUser(auth);
  
  const [loading, setLoading] = React.useState(true);
  const [profileData, setProfileData] = React.useState<any>(null);
  const [profileType, setProfileType] = React.useState<'user' | 'organization' | null>(null);
  const [isOwner, setIsOwner] = React.useState(false);
  const [currentUserProfile, setCurrentUserProfile] = React.useState<any>(null);
  const [now, setNow] = React.useState<Date>(new Date());

  React.useEffect(() => {
    setNow(new Date());
  }, []);

  const settingsRef = React.useMemo(() => (db ? doc(db, "settings", "site") : null), [db]);
  const { data: settings } = useDoc<any>(settingsRef);
  const siteName = settings?.siteName || "Viby";

  // Fetch Logged User Profile info
  React.useEffect(() => {
    if (db && loggedUser) {
      getDoc(doc(db, "users", loggedUser.uid)).then(snap => {
        if (snap.exists()) setCurrentUserProfile(snap.data())
      })
    }
  }, [db, loggedUser]);

  // Fetch Target Profile (Independent of loggedUser)
  React.useEffect(() => {
    if (!db || !username) return;
    
    const fetchData = async () => {
      setLoading(true);
      try {
        const uRef = doc(db, "usernames", username.toLowerCase());
        const uSnap = await getDoc(uRef);
        
        if (uSnap.exists()) {
          const { uid, type } = uSnap.data();
          setProfileType(type);
          
          const dataSnap = await getDoc(doc(db, type === 'user' ? 'users' : 'organizations', uid));
          if (dataSnap.exists()) {
            const data = { id: dataSnap.id, ...dataSnap.data() };
            setProfileData(data);
          } else {
            setProfileData(null);
          }
        } else {
          setProfileData(null);
        }
      } catch (e) {
        console.error("Erro ao buscar perfil:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [db, username]);

  // Determine Ownership
  React.useEffect(() => {
    if (!db || !loggedUser || !profileData || !profileType) {
      setIsOwner(false);
      return;
    }

    const checkOwnership = async () => {
      if (profileType === 'organization') {
        const memberRef = doc(db, 'organizations', profileData.id, 'members', loggedUser.uid);
        const memberSnap = await getDoc(memberRef);
        if (memberSnap.exists()) {
          setIsOwner(['owner', 'admin'].includes(memberSnap.data().role));
        } else {
          setIsOwner(false);
        }
      } else if (profileType === 'user' && loggedUser.uid === profileData.id) {
        setIsOwner(true);
      } else {
        setIsOwner(false);
      }
    };

    checkOwnership();
  }, [db, loggedUser, profileData, profileType]);

  const handleLogout = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
      toast({ title: "Até logo!", description: "Você saiu da sua conta." });
      window.location.reload();
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao sair" });
    }
  }

  // --- Common Data ---
  const followersQuery = useMemoFirebase(() => {
    if (!db || !profileData?.id) return null;
    return query(collection(db, "follows"), where("followingId", "==", profileData.id));
  }, [db, profileData?.id]);
  const { data: followers } = useCollection<any>(followersQuery);

  const followingQuery = useMemoFirebase(() => {
    if (!db || !profileData?.id || profileType !== 'user') return null;
    return query(collection(db, "follows"), where("followerId", "==", profileData.id));
  }, [db, profileData?.id, profileType]);
  const { data: following } = useCollection<any>(followingQuery);

  // --- Organization Specific ---
  const orgEventsQuery = useMemoFirebase(() => {
    if (!db || !profileData?.id || profileType !== 'organization') return null;
    return query(collection(db, "events"), where("organizationId", "==", profileData.id));
  }, [db, profileData?.id, profileType]);
  const { data: orgEvents } = useCollection<any>(orgEventsQuery);

  const orgRegistrationsQuery = useMemoFirebase(() => {
    if (!db || !profileData?.id || profileType !== 'organization') return null;
    return query(collection(db, "registrations"), where("organizationId", "==", profileData.id));
  }, [db, profileData?.id, profileType]);
  const { data: orgRegistrations } = useCollection<any>(orgRegistrationsQuery);

  // --- User Specific ---
  const userGamificationRef = React.useMemo(() => (db && profileData?.id && profileType === 'user') ? doc(db, "user_gamification", profileData.id) : null, [db, profileData?.id, profileType]);
  const { data: gamification } = useDoc<any>(userGamificationRef);

  const userStatsRef = React.useMemo(() => (db && profileData?.id && profileType === 'user') ? doc(db, "cultural_stats", profileData.id) : null, [db, profileData?.id, profileType]);
  const { data: userStats } = useDoc<any>(userStatsRef);

  const userActivitiesQuery = useMemoFirebase(() => {
    if (!db || !profileData?.id || profileType !== 'user' || !isOwner) return null;
    return query(collection(db, "xp_logs"), where("userId", "==", profileData.id), orderBy("timestamp", "desc"), limit(15));
  }, [db, profileData?.id, profileType, isOwner]);
  const { data: activities } = useCollection<any>(userActivitiesQuery);

  const userRegistrationsQuery = useMemoFirebase(() => {
    if (!db || !profileData?.id || profileType !== 'user' || !isOwner) return null;
    return query(collection(db, "registrations"), where("userId", "==", profileData.id));
  }, [db, profileData?.id, profileType, isOwner]);
  const { data: userRegistrations } = useCollection<any>(userRegistrationsQuery);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <Loader2 className="w-10 h-10 animate-spin text-secondary" />
      </div>
    );
  }

  // Profile Privacy Check (Deactivated or Scheduled Deletion)
  const isProfileHidden = profileData?.status === 'Desativado' || profileData?.status === 'Exclusão Programada';
  if (profileData && isProfileHidden && !isOwner) {
     return (
       <div className="min-h-screen flex flex-col items-center justify-center p-10 bg-[#f8fafc] text-center gap-6">
         <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center">
            <Lock className="w-10 h-10 text-muted-foreground opacity-30" />
         </div>
         <h1 className="text-3xl font-black uppercase italic tracking-tighter">Perfil Privado</h1>
         <p className="text-muted-foreground font-medium max-w-sm">Este usuário optou por desativar sua conta temporariamente.</p>
         <Button asChild className="bg-primary text-white rounded-full px-12 h-14 font-black uppercase italic"><Link href="/">Voltar à Viby</Link></Button>
       </div>
     );
  }

  if (!profileData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-10 bg-[#f8fafc] text-center gap-6">
        <Image src="https://picsum.photos/seed/404/400/400" alt="404" width={200} height={200} className="rounded-full grayscale opacity-20" unoptimized />
        <h1 className="text-3xl font-black uppercase italic tracking-tighter">Perfil não encontrado</h1>
        <Button asChild className="bg-primary text-white rounded-full px-12 h-14 font-black uppercase italic"><Link href="/">Voltar ao Início</Link></Button>
      </div>
    );
  }

  const isGamificationVisible = isOwner || !profileData.privacy?.hideGamification;

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col selection:bg-secondary selection:text-white font-body">
      <nav className="fixed top-0 z-50 w-full bg-background/80 backdrop-blur-xl border-b border-border/40">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            {settings?.logoUrl ? (
              <img src={settings.logoUrl} alt={siteName} className="h-8 w-auto object-contain transition-transform group-hover:scale-105" />
            ) : (
              <span className="text-xl font-bold tracking-tight italic uppercase">{siteName}</span>
            )}
          </Link>
          <div className="flex items-center gap-4">
            {loggedUser ? (
              <>
                <Button variant="ghost" asChild className="font-black uppercase text-[10px] tracking-widest hidden sm:flex">
                  <Link href="/dashboard">Painel</Link>
                </Button>
                <Button variant="ghost" asChild className="font-black uppercase text-[10px] tracking-widest hidden sm:flex text-secondary">
                  <Link href={`/${currentUserProfile?.username || ""}`}>
                    <UserIcon className="w-3 h-3 mr-1.5" />
                    {currentUserProfile?.name || loggedUser.displayName || "Meu Perfil"}
                  </Link>
                </Button>
                <Button variant="ghost" onClick={handleLogout} className="font-black uppercase text-[10px] tracking-widest text-destructive">
                  <LogOut className="w-3 h-3 mr-1.5" />
                  Sair
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" asChild className="font-bold uppercase text-[10px] tracking-widest hidden sm:flex">
                  <Link href="/login">Entrar</Link>
                </Button>
                <Button asChild className="bg-primary text-white font-black uppercase italic text-[10px] tracking-widest rounded-full px-6 shadow-lg shadow-primary/10">
                  <Link href="/cadastro">Criar Conta</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      <main className="flex-1 pb-32 pt-16">
        <AnimatePresence mode="wait">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
            {profileType === 'organization' ? (
              <>
                <OrganizerHero 
                  organization={profileData} 
                  realFollowersCount={followers?.length || 0}
                  realEventsCount={orgEvents?.length || 0}
                  realAttendeesCount={orgRegistrations?.length || 0}
                  isOwner={isOwner}
                />
                <div className="container mx-auto px-4 mt-12 max-w-6xl">
                  <Tabs defaultValue="upcoming" className="w-full">
                    <div className="flex justify-center mb-12">
                      <TabsList className="bg-muted/50 p-1 rounded-2xl h-14 inline-flex">
                        <TabsTrigger value="upcoming" className="rounded-xl font-black uppercase text-[10px] tracking-widest px-8 data-[state=active]:bg-white data-[state=active]:shadow-lg">Próximos Eventos</TabsTrigger>
                        <TabsTrigger value="past" className="rounded-xl font-black uppercase text-[10px] tracking-widest px-8 data-[state=active]:bg-white data-[state=active]:shadow-lg">Eventos Passados</TabsTrigger>
                        <TabsTrigger value="about" className="rounded-xl font-black uppercase text-[10px] tracking-widest px-8 data-[state=active]:bg-white data-[state=active]:shadow-lg">Sobre</TabsTrigger>
                      </TabsList>
                    </div>
                    <TabsContent value="upcoming" className="animate-in fade-in slide-in-from-bottom-4 duration-500"><OrganizerEvents events={orgEvents?.filter((e:any) => {
                      const start = e.date?.toDate ? e.date.toDate() : new Date(e.date);
                      const end = e.endDate?.toDate ? e.endDate.toDate() : (e.endDate ? new Date(e.endDate) : new Date(start.getTime() + 4 * 60 * 60 * 1000));
                      return end >= now;
                    }) || []} title="Agenda" /></TabsContent>
                    <TabsContent value="past" className="animate-in fade-in slide-in-from-bottom-4 duration-500"><div className="space-y-20"><OrganizerEvents events={orgEvents?.filter((e:any) => {
                      const start = e.date?.toDate ? e.date.toDate() : new Date(e.date);
                      const end = e.endDate?.toDate ? e.endDate.toDate() : (e.endDate ? new Date(e.endDate) : new Date(start.getTime() + 4 * 60 * 60 * 1000));
                      return end < now;
                    }) || []} title="Histórico" isPast /><OrganizerGallery gallery={profileData.gallery || []} /></div></TabsContent>
                    <TabsContent value="about" className="animate-in fade-in slide-in-from-bottom-4 duration-500"><OrganizerAbout organization={profileData} /></TabsContent>
                  </Tabs>
                </div>
              </>
            ) : (
              <div className="space-y-12">
                <UserHero 
                  profile={profileData} 
                  gamification={gamification}
                  followersCount={followers?.length || 0}
                  followingCount={following?.length || 0}
                  eventsCount={userRegistrations?.length || 0}
                  isOwner={isOwner}
                />
                
                <div className="container mx-auto px-4 max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-12">
                   <div className="lg:col-span-8 space-y-20">
                      {isGamificationVisible ? (
                        <UserGamification gamification={gamification} />
                      ) : (
                        <div className="p-12 border-2 border-dashed border-border/60 rounded-[3rem] text-center flex flex-col items-center gap-4 bg-muted/10">
                          <Lock className="w-10 h-10 text-muted-foreground opacity-20" />
                          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">O progresso cultural desta usuária é privado.</p>
                        </div>
                      )}
                      <UserSocialContent profile={profileData} stats={userStats} activities={activities} isOwner={isOwner} />
                   </div>
                   <aside className="lg:col-span-4 space-y-12">
                      <UserEventsContent registrations={userRegistrations} isOwner={isOwner} />
                   </aside>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
      <Footer />
    </div>
  );
}
