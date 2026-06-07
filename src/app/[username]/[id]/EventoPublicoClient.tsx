
'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useDoc, useFirestore, useAuth, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';
import { Loader2, ArrowLeft, Calendar, Clock, Ticket, BadgeCheck, ShieldCheck, ArrowRight, RefreshCw, AlertCircle, ShoppingCart, CalendarX, Inbox, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { AdsRenderer } from '@/components/ads/AdsRenderer';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import Footer from '@/components/layout/Footer';
import { UserNav } from '@/components/layout/UserNav';
import { useCart } from '@/contexts/CartContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ShareModal } from '@/components/sharing/ShareModal';
import { recordQrScan } from '@/app/actions/qr';
import { 
  EventDescription, 
  EventTags, 
  EventDateTime, 
  EventLocation, 
  EventSEO, 
  EventShare, 
  EventStats, 
  BilheteriaPublic,
  EventInterest,
  EventCoOrganizers
} from '@/components/events';
import { AgeRatingBadge } from '@/lib/age-rating';

/**
 * @fileOverview Componente de Cliente para a página pública do evento.
 * Otimizado para evitar erros de permissão e falhas de renderização.
 */
export default function EventoPublicoClient({ id, username }: { id: string, username: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const db = useFirestore();
  const auth = useAuth();
  const { user } = useUser(auth);
  const { totalCount } = useCart();

  const [isShareModalOpen, setIsShareModalOpen] = React.useState(false);
  const [selectedOccurrence, setSelectedOccurrence] = React.useState<any>(null);

  const eventRef = React.useMemo(() => (db ? doc(db, 'events', id) : null), [db, id]);
  const { data: event, loading: eventLoading } = useDoc<any>(eventRef);

  const orgRef = React.useMemo(() => (db && event?.organizationId) ? doc(db, 'organizations', event.organizationId) : null, [db, event?.organizationId]);
  const { data: organization } = useDoc<any>(orgRef);

  const settingsRef = React.useMemo(() => (db ? doc(db, "settings", "site") : null), [db]);
  const { data: settings } = useDoc<any>(settingsRef);

  const feesRef = React.useMemo(() => (db ? doc(db, 'settings', 'fees') : null), [db]);
  const { data: globalFees } = useDoc<any>(feesRef);

  const promosRef = React.useMemo(() => (db ? doc(db, 'settings', 'promotions') : null), [db]);
  const { data: promotions } = useDoc<any>(promosRef);

  // Correção de Permissão: Uso de useDoc (GET) em vez de useCollection (LIST) para verificar participação
  const memberRef = React.useMemo(() => 
    (db && user && event?.organizationId) ? doc(db, 'organizations', event.organizationId, 'members', user.uid) : null,
    [db, user, event?.organizationId]
  );
  const { data: membership } = useDoc<any>(memberRef);

  const occurrencesQuery = useMemoFirebase(() => {
    if (!db || !event?.isRecurring || !event?.id) return null;
    return query(
      collection(db, 'recurring_occurrences'),
      where('parentId', '==', event.id),
      where('status', '==', 'active')
    );
  }, [db, event?.id, event?.isRecurring]);
  const { data: rawOccurrences, loading: occLoading } = useCollection<any>(occurrencesQuery);

  // Rastreamento de Scan de QR Code
  React.useEffect(() => {
    const vsrc = searchParams.get('vsrc');
    if (vsrc === 'qr' && event?.organizationId) {
      recordQrScan({
        organizationId: event.organizationId,
        eventId: id,
        scanType: 'event'
      });
    }
  }, [searchParams, event?.organizationId, id]);

  // Rastreamento de Visualização
  React.useEffect(() => {
    if (!id || event?.status !== 'Ativo') return;
    const key = `viby_v_${id}`;
    const last = localStorage.getItem(key);
    const now = Date.now();
    if (!last || now - parseInt(last) > 1000 * 60 * 30) {
      fetch('/api/events/track-view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: id })
      }).catch(() => {});
      localStorage.setItem(key, now.toString());
    }
  }, [id, event?.status]);

  const isOwner = !!membership;

  const occurrences = React.useMemo(() => {
    if (!rawOccurrences) return [];
    return [...rawOccurrences].sort((a, b) => a.date.localeCompare(b.date));
  }, [rawOccurrences]);

  const isEnded = React.useMemo(() => {
    if (!event) return false;
    const parseDate = (val: any) => {
      if (!val) return null;
      if (val.toDate) return val.toDate();
      const d = new Date(val);
      return isNaN(d.getTime()) ? null : d;
    };
    const start = parseDate(event.date);
    const end = parseDate(event.endDate) || (start ? new Date(start.getTime() + 4 * 60 * 60 * 1000) : new Date(0));
    return end < new Date();
  }, [event?.date, event?.endDate]);

  if (eventLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-secondary" /></div>;
  if (!event) return null;

  const siteName = settings?.siteName || "Viby";

  return (
    <div className="min-h-screen bg-background pb-32 selection:bg-secondary selection:text-white w-full overflow-x-hidden">
      <EventSEO event={event} username={username} />
      
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-2xl border-b border-border/40">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full"><ArrowLeft className="w-5 h-5" /></Button>
            <Link href="/" className="flex items-center gap-2 group">
              {settings?.logoUrl ? (
                <Image src={settings.logoUrl} alt={siteName} width={120} height={40} className="h-9 w-auto object-contain transition-transform group-hover:scale-105" priority unoptimized />
              ) : (
                <span className="font-black italic uppercase tracking-tighter text-2xl text-primary">{siteName}</span>
              )}
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <Button 
              onClick={() => setIsShareModalOpen(true)}
              className="bg-secondary text-white font-black uppercase italic text-[10px] tracking-widest rounded-full px-6 shadow-lg shadow-secondary/10 gap-2 h-10"
            >
              <Share2 className="w-3.5 h-3.5" /> Compartilhar Evento
            </Button>
            <Button variant="outline" size="icon" className="rounded-full relative" asChild>
               <Link href="/dashboard/carrinho">
                  <Ticket className="w-5 h-5" />
                  {totalCount > 0 && <span className="absolute -top-2 -right-2 bg-secondary text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">{totalCount}</span>}
               </Link>
            </Button>
            {user ? <UserNav /> : <Button asChild className="bg-primary text-white font-black uppercase text-[10px] italic rounded-full px-6 h-10"><Link href="/login">Entrar</Link></Button>}
          </div>
        </div>
      </nav>

      <main className="pt-20">
        <div className="relative h-[50vh] md:h-[60vh] w-full overflow-hidden bg-muted">
           <Image src={event.image || 'https://picsum.photos/seed/event/1200/800'} alt={event.title} fill className={cn('object-cover', isEnded && 'grayscale brightness-50')} unoptimized />
           <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
        </div>

        <div className="max-w-7xl mx-auto px-4 -mt-32 relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-16">
          <div className="lg:col-span-8 space-y-12">
             <div className="space-y-6">
                <div className="flex flex-wrap gap-2">
                   <AgeRatingBadge code={event.ageRating?.code || 'free'} showLabel className="bg-white/80 backdrop-blur-md shadow-sm px-3 py-1 rounded-full border" />
                   <Badge className="bg-secondary text-white border-none text-[10px] font-black uppercase tracking-widest px-4 rounded-full shadow-lg h-8 flex items-center">{event.categoryName || 'Evento'}</Badge>
                   {event.isRecurring && (
                     <Badge className="bg-white text-primary border-none text-[10px] font-black uppercase flex items-center gap-1.5 px-4 rounded-full shadow-lg h-8">
                       <RefreshCw className="w-3 h-3 text-secondary animate-spin-slow" /> Evento Recorrente
                     </Badge>
                   )}
                   <EventShare eventId={id} title={event.title} url={`/${username}/${id}`} />
                </div>
                <h1 className="text-5xl md:text-7xl font-black text-foreground tracking-tighter uppercase italic leading-[0.8] drop-shadow-2xl">{event.title}</h1>
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 py-4">
                   <EventInterest event={event} />
                   <EventStats 
                     views={event.viewsCount || 0} 
                     interested={event.interestedCount || 0} 
                     going={event.goingCount || 0} 
                     shares={event.sharesCount || 0} 
                     isOwner={isOwner}
                   />
                </div>
             </div>

             <Card className="border-none shadow-sm rounded-[2rem] bg-white p-10">
                <h3 className="text-xl font-black uppercase italic tracking-tighter mb-8 flex items-center gap-3 text-primary"><ShieldCheck className="w-5 h-5 text-secondary" /> Informações do Evento</h3>
                <div className="space-y-8">
                   <EventDescription value={event.description} isPublic />
                   <EventTags tags={event.tags} isPublic />
                </div>
             </Card>

             {event.isRecurring && (
               <section className="space-y-6 animate-in slide-in-from-top-4 duration-500">
                  <div className="flex items-center gap-3 px-2">
                    <div className="p-2 bg-secondary/10 rounded-lg text-secondary">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <h2 className="text-2xl font-black uppercase italic tracking-tighter text-primary">Escolha uma Data</h2>
                  </div>

                  {occLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {[1,2,3].map(i => <div key={i} className="h-32 bg-muted rounded-[2rem] animate-pulse" />)}
                    </div>
                  ) : occurrences.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                       {occurrences.slice(0, 6).map((occ: any) => (
                         <button 
                           key={occ.id} 
                           onClick={() => {
                              setSelectedOccurrence(occ);
                              setTimeout(() => {
                                document.getElementById('bilheteria')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              }, 100);
                           }}
                           className={cn(
                             "p-6 rounded-[2rem] border-2 transition-all text-left space-y-2 group",
                             selectedOccurrence?.id === occ.id 
                               ? "border-secondary bg-secondary/5 ring-4 ring-secondary/10 shadow-xl" 
                               : "border-border/60 bg-white hover:border-secondary/40"
                           )}
                         >
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground group-hover:text-secondary transition-colors">
                              {new Date(occ.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long' })}
                            </p>
                            <p className="text-2xl font-black text-primary italic leading-none">
                              {new Date(occ.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                            </p>
                            <div className="flex items-center gap-1.5 text-[9px] font-bold text-muted-foreground uppercase pt-1">
                               <Clock className="w-3.5 h-3.5 text-secondary" /> {occ.startTime}
                            </div>
                         </button>
                       ))}
                    </div>
                  ) : (
                    <div className="p-8 bg-muted/20 rounded-[2rem] border-2 border-dashed flex flex-col items-center gap-3 text-center">
                       <CalendarX className="w-8 h-8 text-muted-foreground opacity-30" />
                       <p className="text-xs font-bold text-muted-foreground uppercase">Nenhuma data disponível no momento</p>
                    </div>
                  )}
               </section>
             )}

             <div id="bilheteria" className="scroll-mt-32 space-y-8">
                {event.isRecurring && !selectedOccurrence && event.type === 'interno' && (
                  <div className="p-8 bg-secondary/5 rounded-[2rem] border-2 border-dashed border-secondary/20 flex flex-col items-center text-center gap-4 animate-in zoom-in-95">
                     <Calendar className="w-10 h-10 text-secondary" />
                     <div className="space-y-1">
                        <h3 className="text-lg font-black uppercase italic text-primary">Selecione uma data acima</h3>
                        <p className="text-xs font-medium text-muted-foreground max-w-xs uppercase">Para liberar a bilheteria, escolha primeiro em qual dia você deseja participar.</p>
                     </div>
                  </div>
                )}

                {(!event.isRecurring || selectedOccurrence) && event.type === 'interno' && (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                      {selectedOccurrence && (
                        <div className="mb-6 p-6 bg-secondary/5 rounded-[2rem] border-2 border-dashed border-secondary/20 flex items-center justify-between">
                           <div className="flex items-center gap-4">
                              <div className="p-3 bg-secondary text-white rounded-2xl shadow-lg">
                                 <Calendar className="w-6 h-6" />
                              </div>
                              <div>
                                 <p className="text-[10px] font-black uppercase tracking-widest text-secondary">Data Selecionada</p>
                                 <p className="text-lg font-black text-primary uppercase italic">
                                   {new Date(selectedOccurrence.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                                 </p>
                              </div>
                           </div>
                           <Button variant="ghost" size="sm" className="rounded-xl font-bold uppercase text-[9px]" onClick={() => setSelectedOccurrence(null)}>Trocar Data</Button>
                        </div>
                      )}
                      <BilheteriaPublic 
                        event={{
                          ...event,
                          occurrenceId: selectedOccurrence?.id,
                          date: selectedOccurrence ? selectedOccurrence.date : event.date,
                          title: selectedOccurrence ? `${event.title} (${new Date(selectedOccurrence.date + 'T12:00:00').toLocaleDateString('pt-BR')})` : event.title,
                          isSoldOut: selectedOccurrence?.ingressosVendidos >= selectedOccurrence?.capacidadeMaxima
                        }} 
                        globalFees={globalFees} 
                        promotions={promotions} 
                        orgSettings={organization} 
                      />
                  </div>
                )}
             </div>

             {!event.isRecurring && <EventDateTime startDate={event.date} endDate={event.endDate} isPublic />}
             
             <EventLocation 
                address={event.address || { city: event.city, neighborhood: event.location }} 
                locations={event.locations} 
                isMultiLocation={event.isMultiLocation} 
                isPublic 
             />
          </div>

          <aside className="lg:col-span-4 space-y-8">
             <div className="sticky top-28 space-y-8">
                {event.type === 'externo' && event.externalUrl && (
                  <Card className="border-none shadow-xl rounded-[2.5rem] bg-white p-8 border-t-8 border-primary space-y-6">
                     <h2 className="text-2xl font-black italic uppercase tracking-tighter text-primary">Bilheteria Externa</h2>
                     <p className="text-sm font-medium text-muted-foreground leading-relaxed">As vendas para este evento ocorrem em uma plataforma terceira.</p>
                     <Button className="w-full h-16 bg-primary text-white font-black rounded-2xl uppercase italic gap-2 shadow-lg transition-transform active:scale-95" asChild>
                        <a href={event.externalUrl} target="_blank" rel="noopener noreferrer">Link de Ingressos <ArrowRight className="w-5 h-5" /></a>
                     </Button>
                  </Card>
                )}

                <Card className="border-none shadow-sm rounded-[2.5rem] bg-white p-8">
                   <div className="flex items-center gap-4">
                      <Avatar className="h-16 w-16 border-2 border-secondary/10 shrink-0">
                         <AvatarImage src={organization?.avatar} className="object-cover" />
                         <AvatarFallback className="font-black bg-muted">{organization?.name?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                         <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Realização</p>
                         <h4 className="font-black text-lg uppercase italic text-primary leading-tight flex-wrap flex items-center gap-1.5">
                           {organization?.name}
                           {(organization?.verified || organization?.isVerified) && <BadgeCheck className="w-4 h-4 fill-blue-500 text-white shrink-0" />}
                         </h4>
                         <Link href={`/${organization?.username}`} className="text-[9px] font-black text-secondary uppercase hover:underline">Ver Perfil da Marca</Link>
                      </div>
                   </div>
                </Card>

                <EventCoOrganizers eventId={id} currentOrgId={event.organizationId} isPublic />
             </div>
          </aside>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-16">
          <AdsRenderer location="event_page_bottom" googleSlotId="event-page-bottom-slot" className="min-h-[140px]" />
        </div>
      </main>
      <Footer />

      {event && (
        <ShareModal 
          isOpen={isShareModalOpen} 
          onOpenChange={setIsShareModalOpen} 
          data={{
            title: event.title,
            username: username,
            url: `/${username}/${id}`,
            logoUrl: event.image,
            bannerUrl: event.image,
            type: 'event',
            organizationId: event.organizationId,
            eventId: id,
            verified: organization?.verified || organization?.isVerified
          }}
        />
      )}
    </div>
  );
}
