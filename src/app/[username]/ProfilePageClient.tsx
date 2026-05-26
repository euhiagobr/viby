
"use client";

import * as React from "react";
import { useFirestore, useCollection, useMemoFirebase, useAuth, useUser, useDoc } from "@/firebase";
import { doc, getDoc, collection, query, where, orderBy } from "firebase/firestore";
import { Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Components
import { OrganizerHero } from "@/components/organizer/OrganizerHero";
import { OrganizerEvents } from "@/components/organizer/OrganizerEvents";
import { OrganizerAbout } from "@/components/organizer/OrganizerAbout";
import { OrganizerGallery } from "@/components/organizer/OrganizerGallery";
import Footer from "@/components/layout/Footer";

export default function ProfilePageClient({ username }: { username: string }) {
  const db = useFirestore();
  const auth = useAuth();
  const { user } = useUser(auth);
  
  const [loading, setLoading] = React.useState(true);
  const [data, setData] = React.useState<any>(null);
  const [type, setType] = React.useState<'user' | 'organization' | null>(null);

  const settingsRef = React.useMemo(() => (db ? doc(db, "settings", "site") : null), [db]);
  const { data: settings } = useDoc<any>(settingsRef);
  const siteName = settings?.siteName || "Viby";

  // Fetch Profile Data
  React.useEffect(() => {
    if (!db || !username) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const uRef = doc(db, "usernames", username.toLowerCase());
        const uSnap = await getDoc(uRef);
        if (uSnap.exists()) {
          const { uid, type: resType } = uSnap.data();
          setType(resType);
          const dataSnap = await getDoc(doc(db, resType === 'user' ? 'users' : 'organizations', uid));
          if (dataSnap.exists()) {
            setData({ id: dataSnap.id, ...dataSnap.data() });
          }
        }
      } catch (e) {
        console.error("Erro ao buscar perfil:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [db, username]);

  // Fetch All Active Events
  const eventsQuery = useMemoFirebase(() => {
    if (!db || !data?.id || type !== 'organization') return null;
    return query(
      collection(db, "events"), 
      where("organizationId", "==", data.id),
      where("status", "==", "Ativo"),
      orderBy("date", "desc")
    );
  }, [db, data?.id, type]);

  const { data: events, loading: eventsLoading } = useCollection<any>(eventsQuery);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <Loader2 className="w-10 h-10 text-secondary" />
        </motion.div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-10 bg-background text-center gap-6">
        <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-4">
          <Users className="w-12 h-12 text-muted-foreground opacity-20" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-black uppercase italic tracking-tighter">Perfil não encontrado</h1>
          <p className="text-muted-foreground font-medium">O @{username} não está vinculado a nenhuma conta ativa.</p>
        </div>
        <Button asChild className="bg-primary text-white rounded-full px-12 h-14 font-black uppercase italic">
          <Link href="/">Voltar ao Início</Link>
        </Button>
      </div>
    );
  }

  const now = new Date();
  const upcomingEvents = (events || []).filter(e => {
    const end = e.endDate?.toDate ? e.endDate.toDate() : (e.date?.toDate ? new Date(e.date.toDate().getTime() + 4 * 60 * 60 * 1000) : new Date());
    return end >= now;
  });
  const pastEvents = (events || []).filter(e => {
    const end = e.endDate?.toDate ? e.endDate.toDate() : (e.date?.toDate ? new Date(e.date.toDate().getTime() + 4 * 60 * 60 * 1000) : new Date());
    return end < now;
  });

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col selection:bg-secondary selection:text-white font-body">
      {/* Premium Navigation */}
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
            <Button variant="ghost" asChild className="font-bold uppercase text-[10px] tracking-widest hidden sm:flex">
              <Link href="/login">Entrar</Link>
            </Button>
            <Button asChild className="bg-primary text-white font-black uppercase italic text-[10px] tracking-widest rounded-full px-6 shadow-lg shadow-primary/10">
              <Link href="/cadastro">Criar Conta</Link>
            </Button>
          </div>
        </div>
      </nav>

      <main className="flex-1 pb-32 pt-16">
        <AnimatePresence mode="wait">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <OrganizerHero organization={data} />

            <div className="container mx-auto px-4 mt-12 max-w-6xl">
              <Tabs defaultValue="upcoming" className="w-full">
                <div className="flex justify-center mb-12">
                  <TabsList className="bg-muted/50 p-1 rounded-2xl h-14 inline-flex">
                    <TabsTrigger value="upcoming" className="rounded-xl font-black uppercase text-[10px] tracking-widest px-8 data-[state=active]:bg-white data-[state=active]:shadow-lg">
                      Próximos Eventos
                    </TabsTrigger>
                    <TabsTrigger value="past" className="rounded-xl font-black uppercase text-[10px] tracking-widest px-8 data-[state=active]:bg-white data-[state=active]:shadow-lg">
                      Eventos Passados
                    </TabsTrigger>
                    <TabsTrigger value="about" className="rounded-xl font-black uppercase text-[10px] tracking-widest px-8 data-[state=active]:bg-white data-[state=active]:shadow-lg">
                      Sobre
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="upcoming" className="animate-in fade-in slide-in-from-bottom-4 duration-500 m-0 focus-visible:outline-none">
                  <OrganizerEvents events={upcomingEvents} title="Agenda" />
                </TabsContent>

                <TabsContent value="past" className="animate-in fade-in slide-in-from-bottom-4 duration-500 m-0 focus-visible:outline-none">
                  <div className="space-y-20">
                    <OrganizerEvents events={pastEvents} title="Histórico" isPast />
                    <OrganizerGallery gallery={data.gallery || []} />
                  </div>
                </TabsContent>

                <TabsContent value="about" className="animate-in fade-in slide-in-from-bottom-4 duration-500 m-0 focus-visible:outline-none">
                  <OrganizerAbout organization={data} />
                </TabsContent>
              </Tabs>
            </div>
          </motion.div>
        </AnimatePresence>
      </main>

      <Footer />
    </div>
  );
}
