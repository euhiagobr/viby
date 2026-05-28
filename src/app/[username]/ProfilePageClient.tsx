
"use client";

import * as React from "react";
import { useFirestore, useAuth, useUser, useDoc, useCollection, useMemoFirebase } from "@/firebase";
import { doc, getDoc, collection, query, where, orderBy, limit } from "firebase/firestore";
import { Loader2, Lock, ShieldCheck, HelpCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "@/hooks/use-toast";
import Image from "next/image";
import { UserNav } from "@/components/layout/UserNav";

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
  const [now, setNow] = React.useState<Date>(new Date());

  React.useEffect(() => {
    setNow(new Date());
  }, []);

  const settingsRef = React.useMemo(() => (db ? doc(db, "settings", "site") : null), [db]);
  const { data: settings } = useDoc<any>(settingsRef);
  const siteName = settings?.siteName || "Viby";

  // Busca de Dados Integrada via Índice de Usernames
  React.useEffect(() => {
    if (!db || !username) return;
    
    const fetchData = async () => {
      setLoading(true);
      try {
        const uRef = doc(db, "usernames", username.toLowerCase().trim());
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
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [db, username]);

  // Auditoria de Propriedade/Acesso
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
      } else {
        setIsOwner(loggedUser.uid === profileData.id);
      }
    };

    checkOwnership();
  }, [db, loggedUser, profileData, profileType]);

  // Common Social Data
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

  // Gamificação e Stats
  const gamificationRef = React.useMemo(() => (db && profileData?.id && profileType === 'user') ? doc(db, "user_gamification", profileData.id) : null, [db, profileData?.id, profileType]);
  const { data: gamification } = useDoc<any>(gamificationRef);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>;
  }

  if (!profileData || profileData.status === 'Bloqueado') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-10 bg-[#f8fafc] text-center gap-6">
        <Image src="https://picsum.photos/seed/404/400/400" alt="Not Found" width={200} height={200} className="rounded-full grayscale opacity-20" unoptimized />
        <h1 className="text-3xl font-black uppercase italic tracking-tighter">Página Inexistente</h1>
        <p className="text-muted-foreground font-medium max-w-xs">O perfil que você procura não foi encontrado ou está temporariamente fora do ar.</p>
        <Button asChild className="bg-primary text-white rounded-full px-12 h-14 font-black uppercase italic"><Link href="/">Voltar ao Início</Link></Button>
      </div>
    );
  }

  // Fallback de Privacidade
  const isProfileHidden = (profileData.status === 'Desativado' || profileData.status === 'Exclusão Programada') && !isOwner;
  if (isProfileHidden) {
     return (
       <div className="min-h-screen flex flex-col items-center justify-center p-10 bg-[#f8fafc] text-center gap-6">
         <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center"><Lock className="w-10 h-10 text-muted-foreground opacity-30" /></div>
         <h1 className="text-3xl font-black uppercase italic tracking-tighter text-primary">Perfil Privado</h1>
         <p className="text-muted-foreground font-medium max-w-sm">Esta conta optou por suspender suas atividades temporariamente.</p>
         <Button asChild className="bg-secondary text-white rounded-full px-12 h-14 font-black uppercase italic shadow-lg shadow-secondary/20"><Link href="/">Explorar Outros Perfis</Link></Button>
       </div>
     );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col selection:bg-secondary selection:text-white">
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
                realFollowersCount={followers?.length || 0}
                realEventsCount={profileData.totalEvents || 0}
                realAttendeesCount={profileData.totalAttendees || 0}
                isOwner={isOwner}
              />
              <div className="container mx-auto px-4 mt-12 max-w-6xl">
                <Tabs defaultValue="upcoming" className="w-full">
                  <div className="flex justify-center mb-12">
                    <TabsList className="bg-muted/50 p-1 rounded-2xl h-14">
                      <TabsTrigger value="upcoming" className="rounded-xl font-black uppercase text-[10px] tracking-widest px-8">Agenda</TabsTrigger>
                      <TabsTrigger value="past" className="rounded-xl font-black uppercase text-[10px] tracking-widest px-8">Histórico</TabsTrigger>
                      <TabsTrigger value="about" className="rounded-xl font-black uppercase text-[10px] tracking-widest px-8">Sobre</TabsTrigger>
                    </TabsList>
                  </div>
                  <TabsContent value="upcoming" className="animate-in fade-in duration-500">
                    <OrganizerEvents 
                      events={[]} // Fetch events of this org
                      title="Próximos Eventos" 
                    />
                  </TabsContent>
                  <TabsContent value="past" className="animate-in fade-in duration-500">
                    <OrganizerEvents events={[]} title="Experiências Passadas" isPast />
                    <OrganizerGallery gallery={profileData.gallery || []} />
                  </TabsContent>
                  <TabsContent value="about" className="animate-in fade-in duration-500">
                    <OrganizerAbout organization={profileData} />
                  </TabsContent>
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
                    <UserSocialContent profile={profileData} stats={{}} activities={[]} isOwner={isOwner} />
                 </div>
                 <aside className="lg:col-span-4 space-y-12">
                    <UserEventsContent registrations={[]} isOwner={isOwner} />
                 </aside>
              </div>
            </div>
          )}
        </motion.div>
      </main>
      <Footer />
    </div>
  );
}
