'use client';

import * as React from "react";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, where, orderBy, limit, startAfter, getDocs, DocumentSnapshot } from "firebase/firestore";
import { EventCard } from "@/components/events/EventCard";
import { Button } from "@/components/ui/button";
import { Loader2, Inbox, Calendar, MapPin, ChevronRight, Globe, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface CityPageClientProps {
  initialEvents: any[];
  cityName: string;
  regionLabel: string;
  regionSlug: string;
  citySlug: string;
}

export default function CityPageClient({ initialEvents, cityName, regionLabel, regionSlug, citySlug }: CityPageClientProps) {
  const db = useFirestore();
  const [events, setEvents] = React.useState(initialEvents);
  const [lastVisible, setLastVisible] = React.useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = React.useState(initialEvents.length >= 12);
  const [loading, setLoading] = React.useState(false);

  const fetchMore = async () => {
    if (!db || loading || !hasMore) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, "events"),
        where("status", "==", "Ativo"),
        where("regionSlug", "==", regionSlug),
        where("citySlug", "==", citySlug),
        where("date", ">=", new Date()),
        orderBy("date", "asc"),
        startAfter(lastVisible || new Date(initialEvents[initialEvents.length - 1].date)),
        limit(12)
      );

      const snap = await getDocs(q);
      const newDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      setEvents(prev => [...prev, ...newDocs]);
      setLastVisible(snap.docs[snap.docs.length - 1] || null);
      setHasMore(snap.docs.length === 12);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const categories = React.useMemo(() => {
    const set = new Set<string>();
    events.forEach(e => { if (e.categoryName) set.add(e.categoryName); });
    return Array.from(set);
  }, [events]);

  return (
    <div className="space-y-12">
      <header className="bg-white border-b py-16 md:py-24 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
          <Globe className="w-[800px] h-[800px] absolute -right-20 -top-20" />
        </div>
        <div className="container mx-auto px-4 text-center relative z-10 space-y-6">
          <Badge variant="secondary" className="font-black uppercase text-[10px] px-4 h-6 tracking-widest bg-secondary/10 text-secondary border-none">
            {regionLabel}
          </Badge>
          <h1 className="text-5xl md:text-8xl font-black uppercase italic tracking-tighter leading-[0.85] text-primary">
            O que fazer em <span className="text-secondary">{cityName}</span>
          </h1>
          <p className="text-lg md:text-xl font-medium text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Encontre os próximos eventos, festas, shows e experiências acontecendo em {cityName}.
          </p>
        </div>
      </header>

      <main className="container mx-auto px-4 space-y-20 pb-24">
        <section className="space-y-12">
          <div className="flex items-center justify-between px-2">
             <div className="space-y-1">
                <h2 className="text-3xl font-black uppercase italic tracking-tighter text-primary">Próximas Experiências</h2>
                <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-secondary" /> Calendário Atualizado em Tempo Real
                </p>
             </div>
             {categories.length > 0 && (
               <div className="hidden md:flex flex-wrap gap-2">
                  {categories.slice(0, 4).map(cat => (
                    <Badge key={cat} variant="outline" className="rounded-xl border-dashed px-3 py-1 font-bold text-[9px] uppercase">{cat}</Badge>
                  ))}
               </div>
             )}
          </div>

          {events.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
              {events.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          ) : (
            <div className="py-32 text-center bg-white rounded-[4rem] border-2 border-dashed flex flex-col items-center gap-6">
               <Inbox className="w-16 h-16 text-muted-foreground opacity-20" />
               <div className="space-y-2">
                  <h3 className="text-2xl font-black uppercase italic text-primary">Nenhum evento futuro localizado.</h3>
                  <p className="text-muted-foreground font-medium uppercase text-xs">Seja o primeiro a publicar um evento em {cityName}!</p>
               </div>
               <Button asChild className="rounded-2xl h-14 px-10 bg-primary text-white font-black uppercase italic">
                  <Link href="/cadastro">Anunciar Evento</Link>
               </Button>
            </div>
          )}

          {hasMore && (
            <div className="flex justify-center pt-10">
              <Button onClick={fetchMore} disabled={loading} variant="outline" className="rounded-full px-12 h-14 font-black uppercase italic border-2 border-secondary text-secondary">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Ver mais eventos"}
              </Button>
            </div>
          )}
        </section>

        <Separator className="border-dashed" />

        <section className="max-w-4xl mx-auto space-y-12">
          <div className="space-y-6">
             <h3 className="text-2xl font-black uppercase italic tracking-tighter text-primary">Eventos em {cityName}</h3>
             <p className="text-lg text-muted-foreground leading-relaxed font-medium">
               Descubra os melhores eventos acontecendo em {cityName}. Encontre shows, festas, eventos culturais, feiras, experiências gastronômicas, esportivas e muito mais. 
               A Viby conecta você com a pulsação urbana de {cityName}, trazendo sempre as opções mais relevantes de acordo com a sua localização e interesses.
             </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <Card className="border-none shadow-sm rounded-3xl bg-white p-8 space-y-6">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-secondary flex items-center gap-2">
                  <Tag className="w-4 h-4" /> Categorias Populares em {cityName}
                </h4>
                <div className="flex flex-wrap gap-2">
                   {categories.length > 0 ? categories.map(cat => (
                     <Link key={cat} href={`/dashboard?category=${cat}`} className="px-4 py-2 bg-muted rounded-xl text-xs font-bold text-primary hover:bg-secondary hover:text-white transition-all">
                       {cat} em {cityName}
                     </Link>
                   )) : <p className="text-xs italic opacity-40">Mapeando interesses...</p>}
                </div>
             </Card>

             <Card className="border-none shadow-sm rounded-3xl bg-white p-8 space-y-6">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-secondary flex items-center gap-2">
                  <MapPin className="w-4 h-4" /> Outras Cidades em {regionLabel.split(' - ')[1]}
                </h4>
                <div className="flex flex-wrap gap-2">
                   <Link href={`/o-que-fazer-em/${regionSlug}/${citySlug}`} className="px-4 py-2 bg-secondary text-white rounded-xl text-xs font-bold uppercase italic">
                     {cityName}
                   </Link>
                   <span className="text-xs font-bold text-muted-foreground p-2 uppercase opacity-40 italic">Mais cidades em breve...</span>
                </div>
             </Card>
          </div>
        </section>
      </main>
    </div>
  );
}
