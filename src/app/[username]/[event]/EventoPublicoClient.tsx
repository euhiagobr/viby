'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useDoc, useFirestore, useAuth, useUser } from '@/firebase';
import { doc } from 'firebase/firestore';
import { 
  Loader2, 
  ArrowLeft, 
  Ticket, 
  BadgeCheck, 
  ShieldCheck, 
  Share2,
  Clock,
  Coins,
  Star,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
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
  EventLocation, 
  EventSEO, 
  EventShare, 
  EventStats, 
  BilheteriaPublic,
  EventInterest,
  EventCoOrganizers
} from '@/components/events';
import { AgeRatingBadge } from '@/lib/age-rating';
import { useCurrency } from '@/contexts/CurrencyContext';

/**
 * @fileOverview Visualização pública do evento unificada.
 */
export default function EventoPublicoClient({ id, username }: { id: string, username: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const db = useFirestore();
  const auth = useAuth();
  const { user } = useUser(auth);
  const { totalCount } = useCart();
  const { formatPriceWithOriginal } = useCurrency();

  const [isShareModalOpen, setIsShareModalOpen] = React.useState(false);
  const [activeDisclosurePrice, setActiveDisplayPrice] = React.useState<any>(null);

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

  React.useEffect(() => {
    if ((event?.type !== 'divulgacao' && event?.type !== 'externo') || !event.disclosurePrices?.length) return;

    const updateActivePrice = () => {
      const now = new Date();
      const eventStart = event.date?.toDate ? event.date.toDate() : new Date(event.date);
      
      let currentActive = null;
      let lastLimit = new Date(eventStart.getTime());

      for (const p of event.disclosurePrices) {
        const [h, m] = p.untilTime.split(':').map(Number);
        let limitDate = new Date(lastLimit.getTime());
        limitDate.setHours(h, m, 0, 0);

        if (limitDate <= lastLimit) {
          limitDate.setDate(limitDate.getDate() + 1);
        }

        if (now < limitDate) {
          currentActive = p;
          break;
        }
        lastLimit = limitDate;
      }

      setActiveDisplayPrice(currentActive || event.disclosurePrices[event.disclosurePrices.length - 1]);
    };

    updateActivePrice();
    const timer = setInterval(updateActivePrice, 10000);
    return () => clearInterval(timer);
  }, [event]);

  React.useEffect(() => {
    const vsrc = searchParams.get('vsrc');
    if (vsrc === 'qr' && event?.organizationId) {
      recordQrScan({ organizationId: event.organizationId, eventId: id, scanType: 'event' });
    }
  }, [searchParams, event?.organizationId, id]);

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
  const isCuradoria = event.curationType === 'curadoria';

  return (
    <div className="min-h-screen bg-background pb-32 selection:bg-secondary selection:text-white w-full overflow-x-hidden">
      <EventSEO event={event} username={username} />
      
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/40">
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
              <Share2 className="w-3.5 h-3.5" /> Compartilhar
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
                   <EventShare eventId={id} title={event.title} url={`/${username}/${event.slug || id}`} />
                </div>
                <h1 className="text-5xl md:text-7xl font-black text-foreground tracking-tighter uppercase italic leading-[0.8] drop-shadow-2xl">{event.title}</h1>
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 py-4">
                   <EventInterest event={event} />
                   <EventStats 
                     views={event.viewsCount || 0} 
                     interested={event.interestedCount || 0} 
                     going={event.goingCount || 0} 
                     shares={event.sharesCount || 0} 
                     isOwner={!!user && event.organizationId === user.uid}
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

             <EventLocation 
                address={event.address} 
                isPublic 
             />
          </div>

          <aside className="lg:col-span-4 space-y-8">
             <div className="sticky top-28 space-y-8">
                {event.type === 'externo' && (
                  <Card className="border-none shadow-xl rounded-[2.5rem] bg-white p-8 border-t-8 border-primary space-y-6">
                     <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary"><Ticket className="w-5 h-5" /></div>
                        <h2 className="text-2xl font-black italic uppercase tracking-tighter text-primary">Ingressos</h2>
                     </div>
                     <div className="space-y-4">
                        {(event.disclosurePrices || []).length > 0 && (
                           <div className="grid grid-cols-1 gap-3">
                             {event.disclosurePrices.map((p: any, idx: number) => {
                               const isCurrent = activeDisclosurePrice?.untilTime === p.untilTime;
                               return (
                                 <div key={idx} className={cn(
                                   "p-4 rounded-2xl border transition-all relative overflow-hidden",
                                   isCurrent ? "bg-secondary/5 border-secondary shadow-md ring-2 ring-secondary/10" : "bg-muted/30 border-dashed border-border/60 opacity-60"
                                 )}>
                                    <div className="flex items-center justify-between gap-4">
                                       <div className="space-y-1">
                                          <div className="flex items-center gap-1.5 text-[10px] font-black text-secondary uppercase">
                                             <Clock className="w-3 h-3" /> Até {p.untilTime}
                                          </div>
                                          <p className="text-2xl font-black text-primary italic leading-none">
                                            {p.price > 0 ? formatPriceWithOriginal(p.price, event.currency || 'BRL') : 'Grátis'}
                                          </p>
                                       </div>
                                    </div>
                                 </div>
                               );
                             })}
                           </div>
                        )}
                        <Button asChild className="w-full h-16 bg-primary text-white font-black rounded-2xl shadow-xl uppercase italic text-lg hover:scale-[1.02] transition-all">
                           <a href={event.externalUrl} target="_blank" rel="noopener noreferrer">
                              Comprar Ingressos <ExternalLink className="ml-2 w-5 h-5" />
                           </a>
                        </Button>
                     </div>
                  </Card>
                )}

                {event.type === 'divulgacao' && (
                  <Card className="border-none shadow-xl rounded-[2.5rem] bg-white p-8 border-t-8 border-secondary space-y-6">
                     <div className="flex items-center gap-3">
                        <div className="p-2 bg-secondary/10 rounded-lg text-secondary"><Coins className="w-5 h-5" /></div>
                        <h2 className="text-2xl font-black italic uppercase tracking-tighter text-primary">Preços de Entrada</h2>
                     </div>
                     <div className="space-y-4">
                        {(event.disclosurePrices || []).length > 0 ? (
                           <div className="grid grid-cols-1 gap-3">
                             {event.disclosurePrices.map((p: any, idx: number) => {
                               const isCurrent = activeDisclosurePrice?.untilTime === p.untilTime;
                               return (
                                 <div key={idx} className={cn(
                                   "p-4 rounded-2xl border transition-all relative overflow-hidden",
                                   isCurrent ? "bg-secondary/5 border-secondary shadow-md ring-2 ring-secondary/10" : "bg-muted/30 border-dashed border-border/60 opacity-60"
                                 )}>
                                    <div className="flex items-center justify-between gap-4">
                                       <div className="space-y-1">
                                          <div className="flex items-center gap-1.5 text-[10px] font-black text-secondary uppercase">
                                             <Clock className="w-3 h-3" /> Até {p.untilTime}
                                          </div>
                                          <p className="text-2xl font-black text-primary italic leading-none">
                                            {p.price > 0 ? formatPriceWithOriginal(p.price, event.currency || 'BRL') : 'Grátis'}
                                          </p>
                                       </div>
                                    </div>
                                 </div>
                               );
                             })}
                           </div>
                        ) : (
                          <div className="p-6 bg-muted/30 rounded-2xl border border-dashed flex items-center justify-center">
                            <span className="font-black text-2xl text-primary uppercase italic">Grátis</span>
                          </div>
                        )}
                     </div>
                  </Card>
                )}

                {event.type === 'interno' && (
                   <BilheteriaPublic event={event} globalFees={globalFees} promotions={promotions} orgSettings={organization} />
                )}

                <Card className="border-none shadow-sm rounded-[2.5rem] bg-white p-8">
                  <div className="flex items-center gap-4">
                      <Avatar className="h-16 w-16 border-2 border-secondary/10 shrink-0">
                        <AvatarImage src={organization?.avatar} className="object-cover" />
                        <AvatarFallback className="font-black bg-muted">{organization?.name?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">
                          {isCuradoria ? 'Curadoria' : 'Realização'}
                        </p>
                        <h4 className="font-black text-lg uppercase italic text-primary leading-tight flex-wrap flex items-center gap-1.5">
                          {organization?.name}
                          {(organization?.verified || organization?.isVerified) && <BadgeCheck className="w-4 h-4 fill-blue-500 text-white shrink-0" />}
                        </h4>
                        <Link href={`/${organization?.username}`} className="text-[9px] font-black text-secondary uppercase hover:underline">Ver Perfil da Marca</Link>
                      </div>
                  </div>
                </Card>

                {isCuradoria && (
                  <div className="p-5 bg-secondary/5 rounded-3xl border border-secondary/10 flex items-start gap-3 animate-in zoom-in-95">
                    <Star className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase text-secondary italic">Nota de Curadoria</p>
                      <p className="text-[9px] text-muted-foreground font-medium leading-relaxed uppercase">
                        A curadoria é uma forma de divulgar as melhores experiências da rede. Este evento foi selecionado pela nossa equipe para garantir maior visibilidade e alcance aos produtores locais.
                      </p>
                    </div>
                  </div>
                )}

                <EventCoOrganizers eventId={id} currentOrgId={event.organizationId} isPublic />
             </div>
          </aside>
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
            url: `/${username}/${event.slug || id}`,
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
