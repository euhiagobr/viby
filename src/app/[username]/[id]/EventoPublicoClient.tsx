
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useDoc, useFirestore, useAuth, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { doc, increment, updateDoc, collection, query, where } from 'firebase/firestore';
import { Loader2, ArrowLeft, Calendar, MapPin, Clock, Ticket, BadgeCheck, ShieldCheck, ArrowRight } from 'lucide-react';
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

export default function EventoPublicoClient({ id, username }: { id: string, username: string }) {
  const router = useRouter()
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  const { totalCount } = useCart()

  const eventRef = React.useMemo(() => (db ? doc(db, 'events', id) : null), [db, id])
  const { data: event, loading: eventLoading } = useDoc<any>(eventRef)

  const orgRef = React.useMemo(() => (db && event?.organizationId) ? doc(db, 'organizations', event.organizationId) : null, [db, event?.organizationId])
  const { data: organization } = useDoc<any>(orgRef)

  const feesRef = React.useMemo(() => (db ? doc(db, 'settings', 'fees') : null), [db])
  const { data: globalFees } = useDoc<any>(feesRef)

  const promosRef = React.useMemo(() => (db ? doc(db, 'settings', 'promotions') : null), [db])
  const { data: promotions } = useDoc<any>(promosRef)

  // Verificar se o usuário atual é proprietário ou membro da organização para exibir as visualizações
  const memberQuery = useMemoFirebase(() => {
    if (!db || !user || !event?.organizationId) return null;
    return query(collection(db, 'organizations', event.organizationId, 'members'), where('userId', '==', user.uid));
  }, [db, user, event?.organizationId]);
  const { data: membership } = useCollection<any>(memberQuery);
  const isOwner = membership && membership.length > 0;

  React.useEffect(() => {
    if (!db || !id || event?.status !== 'Ativo') return
    const key = `viby_v_${id}`
    const last = localStorage.getItem(key)
    const now = Date.now()
    if (!last || now - parseInt(last) > 1000 * 60 * 30) {
      updateDoc(doc(db, "events", id), { viewsCount: increment(1) })
      localStorage.setItem(key, now.toString())
    }
  }, [db, id, event?.status])

  if (eventLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-secondary" /></div>
  if (!event) return null

  const isEnded = new Date(event.endDate || new Date(event.date).getTime() + 4*60*60*1000) < new Date()

  return (
    <div className="min-h-screen bg-background pb-32">
      <EventSEO event={event} username={username} />
      
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-2xl border-b border-border/40">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full"><ArrowLeft className="w-5 h-5" /></Button>
            <Link href="/" className="font-black italic uppercase tracking-tighter text-2xl text-primary">VIBY</Link>
          </div>
          <div className="flex items-center gap-4">
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
                   <Badge className="bg-secondary text-white border-none text-[10px] font-black uppercase tracking-widest px-4 rounded-full shadow-lg">{event.categoryName || 'Evento'}</Badge>
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
                <h3 className="text-xl font-black uppercase italic tracking-tighter mb-8 flex items-center gap-3 text-primary"><ShieldCheck className="w-5 h-5 text-secondary" /> Informações</h3>
                <div className="space-y-8">
                   <EventDescription value={event.description} isPublic />
                   <EventTags tags={event.tags} isPublic />
                </div>
             </Card>

             <EventDateTime startDate={event.date} endDate={event.endDate} isPublic />
             <EventLocation address={event.address} isPublic />

             {event.type === 'interno' && (
               <BilheteriaPublic 
                 event={event} 
                 globalFees={globalFees} 
                 promotions={promotions} 
                 orgSettings={organization} 
               />
             )}
          </div>

          <aside className="lg:col-span-4 space-y-8">
             <div className="sticky top-28 space-y-8">
                {event.type === 'externo' && event.externalUrl && (
                  <Card className="border-none shadow-xl rounded-[2.5rem] bg-white p-8 border-t-8 border-primary space-y-6">
                     <h2 className="text-2xl font-black italic uppercase tracking-tighter text-primary">Bilheteria Externa</h2>
                     <p className="text-sm font-medium text-muted-foreground leading-relaxed">As vendas para este evento ocorrem em uma plataforma terceira.</p>
                     <Button className="w-full h-16 bg-primary text-white font-black rounded-2xl uppercase italic gap-2" asChild>
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
      </main>
      <Footer />
    </div>
  );
}
