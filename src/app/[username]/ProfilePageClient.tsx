
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useFirestore, useCollection, useMemoFirebase, useAuth, useUser, useDoc } from "@/firebase";
import { doc, getDoc, collection, query, where, orderBy } from "firebase/firestore";
import { Loader2, Users, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

// Components
import { OrganizerHero } from "@/components/organizer/OrganizerHero";
import { OrganizerBio } from "@/components/organizer/OrganizerBio";
import { OrganizerEvents } from "@/components/organizer/OrganizerEvents";
import { OrganizerSocials } from "@/components/organizer/OrganizerSocials";
import { OrganizerGallery } from "@/components/organizer/OrganizerGallery";
import { OrganizerMap } from "@/components/organizer/OrganizerMap";
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

  // Fetch Events
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

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col selection:bg-secondary selection:text-white">
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
              <Link href="/dashboard">Painel</Link>
            </Button>
            <Button asChild className="bg-primary text-white font-black uppercase italic text-[10px] tracking-widest rounded-full px-6 shadow-lg shadow-primary/10">
              <Link href="/login">Entrar</Link>
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

            <div className="container mx-auto px-4 mt-20 space-y-24 max-w-6xl">
              {/* Main Content Layout */}
              <div className="grid grid-cols-1 gap-24">
                {/* 1. About Section */}
                <OrganizerBio bio={data.bio} />

                {/* 2. Social Connections */}
                <OrganizerSocials organization={data} />

                {/* 3. Event List System */}
                <OrganizerEvents events={events || []} />

                {/* 4. Multimedia Gallery */}
                <OrganizerGallery gallery={data.gallery || []} />

                {/* 5. Physical Location */}
                <OrganizerMap organization={data} />
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </main>

      <Footer />
    </div>
  );
}
