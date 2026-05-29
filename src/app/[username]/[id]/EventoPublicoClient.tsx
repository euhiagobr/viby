
'use client';

import * as React from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import {
  useDoc,
  useFirestore,
  useAuth,
  useUser,
  useCollection,
  useMemoFirebase,
} from '@/firebase';
import {
  doc,
  collection,
  query,
  where,
  increment,
  updateDoc,
  getDoc,
  setDoc,
  serverTimestamp
} from 'firebase/firestore';
import {
  Loader2,
  ArrowLeft,
  Share2,
  Calendar,
  MapPin,
  Clock,
  ExternalLink,
  ShieldCheck,
  Eye,
  Heart,
  Star,
  CheckCircle2,
  Ticket
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import Footer from '@/components/layout/Footer';
import { AgeRatingBadge, AgeRatingWarning } from '@/lib/age-rating';
import { UserNav } from '@/components/layout/UserNav';
import { RichText } from '@/components/ui/rich-text';
import { BilheteriaPublic } from '@/components/events/Bilheteria';
import { useCart } from '@/contexts/CartContext';

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

  const isEnded = new Date(event.endDate || event.date) < new Date()

  return (
    <div className="min-h-screen bg-background pb-32">
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
                   <AgeRatingBadge code={event.ageRating?.code || "free"} className="bg-white p-2 rounded-xl shadow-xl border" />
                   <Badge className="bg-secondary text-white border-none text-[10px] font-black uppercase tracking-widest px-4 rounded-full shadow-lg">{event.categoryName || 'Evento'}</Badge>
                </div>
                <h1 className="text-5xl md:text-7xl font-black text-foreground tracking-tighter uppercase italic leading-[0.8] drop-shadow-2xl">{event.title}</h1>
                <div className="flex flex-wrap items-center gap-6 text-muted-foreground font-black text-[10px] uppercase tracking-widest bg-white/10 backdrop-blur-md p-6 rounded-[2rem] w-fit shadow-2xl">
                   <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-secondary" /> {new Date(event.date).toLocaleDateString('pt-BR')}</div>
                   <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-secondary" /> {new Date(event.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                   <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-secondary" /> {event.city}</div>
                </div>
             </div>

             <Card className="border-none shadow-sm rounded-[2rem] bg-white p-10">
                <h3 className="text-xl font-black uppercase italic tracking-tighter mb-8 flex items-center gap-3 text-primary"><ShieldCheck className="w-5 h-5 text-secondary" /> Informações</h3>
                <div className="text-lg md:text-xl font-medium text-foreground/80 leading-relaxed">
                   <RichText content={event.description} />
                </div>
             </Card>

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
                        <a href={event.externalUrl} target="_blank" rel="noopener noreferrer">Comprar Ingressos <ExternalLink className="w-5 h-5" /></a>
                     </Button>
                  </Card>
                )}

                {event.type === 'divulgacao' && (
                  <Card className="border-none shadow-xl rounded-[2.5rem] bg-white p-8 border-t-8 border-muted space-y-6">
                     <h2 className="text-2xl font-black italic uppercase tracking-tighter text-primary">Evento Informativo</h2>
                     <p className="text-sm font-medium text-muted-foreground leading-relaxed">Fique atento às atualizações do organizador para novos detalhes.</p>
                     <Button variant="outline" className="w-full h-14 rounded-2xl font-black uppercase italic" onClick={() => toast({ title: "Interesse registrado!" })}>Marcar Interesse</Button>
                  </Card>
                )}

                <Card className="border-none shadow-sm rounded-[2.5rem] bg-white p-8">
                   <div className="flex items-center gap-4">
                      <Avatar className="h-16 w-16 border-2 border-secondary/10">
                         <AvatarImage src={organization?.avatar} className="object-cover" />
                         <AvatarFallback className="font-black bg-muted">{organization?.name?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                         <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Realização</p>
                         <h4 className="font-black text-lg uppercase italic text-primary">{organization?.name}</h4>
                         <Link href={`/${organization?.username}`} className="text-[9px] font-black text-secondary uppercase hover:underline">Ver Perfil da Marca</Link>
                      </div>
                   </div>
                </Card>
             </div>
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  );
}
