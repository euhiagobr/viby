'use client';

import * as React from 'react';
import { PublicHeader } from '@/components/layout/PublicHeader';
import Footer from '@/components/layout/Footer';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Share2, 
  ShieldCheck, 
  Clock, 
  BadgeCheck,
  Info,
  MapPin,
  Navigation,
  ShoppingBag,
  Loader2,
  Calendar as CalendarIcon,
  Star,
  Users,
  Check,
  X,
  Camera,
  Plus,
  Zap,
  CheckCircle2,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { RichText } from '@/components/ui/rich-text';
import { cn, safeParseDate } from '@/lib/utils';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { useCurrency } from '@/contexts/CurrencyContext';
import { Separator } from '@/components/ui/separator';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import { useCart } from '@/contexts/CartContext';
import { toast } from '@/hooks/use-toast';
import { useAuth, useUser } from '@/firebase';
import { useRouter, usePathname } from 'next/navigation';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format, isSameDay, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ExperiencePublicReviews } from '@/components/experiences/ExperiencePublicReviews';
import { CommunityGallery } from '@/components/experiences/CommunityGallery';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';

const LocationMap = dynamic(() => import("@/components/events/LocationMap").then(mod => mod.LocationMap), { 
  ssr: false,
  loading: () => <div className="w-full h-full bg-muted animate-pulse flex items-center justify-center text-[10px] font-black uppercase opacity-20">Carregando Mapa...</div>
})

interface ExperienciaPublicaClientProps {
  experience: any;
}

export default function ExperienciaPublicaClient({ experience }: ExperienciaPublicaClientProps) {
  const { formatPrice } = useCurrency();
  const { addItem } = useCart();
  const db = useFirestore();
  const auth = useAuth();
  const { user } = useUser(auth);
  const router = useRouter();
  const pathname = usePathname();

  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(undefined);
  const [selectedSlot, setSelectedSlot] = React.useState<any>(null);
  const [isGalleryOpen, setIsGalleryOpen] = React.useState(false);

  const slotsQuery = useMemoFirebase(() => {
    if (!db || !experience.id) return null;
    return query(
      collection(db, "experiences", experience.id, "slots"),
      where("status", "==", "active")
    );
  }, [db, experience.id]);

  const { data: rawSlots, loading: loadingSlots } = useCollection<any>(slotsQuery);

  const slots = React.useMemo(() => {
    if (!rawSlots) return [];
    return [...rawSlots].sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
  }, [rawSlots]);

  const dateStats = React.useMemo(() => {
    const stats: Record<string, { available: boolean; full: boolean }> = {};
    const now = new Date();
    
    slots.forEach(slot => {
      const d = new Date(slot.datetime);
      if (d < now) return;
      
      const key = format(d, 'yyyy-MM-dd');
      if (!stats[key]) stats[key] = { available: false, full: true };
      
      const remaining = slot.capacity - (slot.sold || 0);
      const hasVacancy = remaining > 0;
      
      if (hasVacancy) stats[key].available = true;
      if (hasVacancy) stats[key].full = false;
    });

    return stats;
  }, [slots]);

  const availableDates = React.useMemo(() => 
    Object.keys(dateStats).filter(k => dateStats[k].available).map(k => new Date(k + 'T12:00:00')), 
    [dateStats]
  );
  
  const fullDates = React.useMemo(() => 
    Object.keys(dateStats).filter(k => !dateStats[k].available && dateStats[k].full).map(k => new Date(k + 'T12:00:00')), 
    [dateStats]
  );

  const filteredSlotsForDate = React.useMemo(() => {
    if (!selectedDate) return [];
    return slots.filter(s => isSameDay(new Date(s.datetime), selectedDate));
  }, [selectedDate, slots]);

  const handleAction = () => {
    if (!selectedSlot) {
      const el = document.getElementById('booking-card');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
      toast({ title: "Escolha uma data", description: "Selecione o dia e horário desejado." });
      return;
    }

    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(pathname || '/')}`);
      return;
    }

    addItem({
      id: `${experience.id}_${selectedSlot.id}`,
      eventId: experience.id,
      eventTitle: experience.title,
      eventImage: experience.image || "",
      eventDate: selectedSlot.datetime,
      eventCity: experience.city || "",
      organizationId: experience.organizationId,
      organizerId: experience.organizer?.id || "",
      organizerUsername: experience.organizer?.username || "",
      ticketTypeId: "exp_access",
      ticketTypeName: "Vaga na Experiência",
      batchId: "slot",
      batchName: "Horário Agendado",
      currency: (experience.currency || 'BRL'),
      price: selectedSlot.hasPromo ? selectedSlot.promoPrice : selectedSlot.price,
      originalPrice: selectedSlot.price,
      quantity: 1,
      requiresProof: false,
      occurrenceId: selectedSlot.id,
      productType: 'experience'
    });

    router.push('/dashboard/carrinho');
  };

  const minPrice = React.useMemo(() => {
    if (slots.length === 0) return 0;
    const now = new Date();
    const prices = slots
      .filter(s => new Date(s.datetime) > now && (s.capacity - (s.sold || 0)) > 0)
      .map(s => s.hasPromo ? s.promoPrice : s.price);
    return prices.length > 0 ? Math.min(...prices) : 0;
  }, [slots]);

  const address = experience.address || {};
  const lat = address.latitude || experience.latitude || -23.55052;
  const lng = address.longitude || experience.longitude || -46.633308;

  const hasInclusions = experience.inclusions && experience.inclusions.length > 0;
  const hasExclusions = experience.exclusions && experience.exclusions.length > 0;
  const hasRules = experience.rules && experience.rules.length > 0;
  const hasSteps = experience.steps && experience.steps.length > 0;
  const hasFaqs = experience.faqs && experience.faqs.length > 0;

  const organizerJoinedDate = safeParseDate(experience.organizer?.createdAt);

  return (
    <div className="min-h-screen bg-white flex flex-col selection:bg-secondary/10 selection:text-secondary">
      <PublicHeader showBack />

      <main className="flex-1 pb-32">
        {/* 1. GALERIA PREMIUM */}
        <section className="container mx-auto px-4 pt-8 md:pt-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 h-[500px] md:h-[600px] rounded-[3rem] overflow-hidden shadow-2xl relative group">
             <div className="md:col-span-2 relative h-full">
                <Image src={experience.image} alt={experience.title} fill className="object-cover transition-transform duration-1000 group-hover:scale-[1.02]" priority unoptimized />
             </div>
             <div className="hidden md:grid grid-cols-2 grid-rows-2 col-span-2 gap-2 h-full">
                {Array.from({ length: 4 }).map((_, i) => {
                  const url = experience.gallery?.[i];
                  if (!url) return <div key={i} className="bg-muted/30" />;
                  return (
                    <div key={i} className="relative bg-muted overflow-hidden">
                       <Image src={url} alt="" fill className="object-cover transition-transform duration-700 hover:scale-110" unoptimized />
                    </div>
                  );
                })}
             </div>
             {experience.gallery?.length > 4 && (
               <button 
                onClick={() => setIsGalleryOpen(true)}
                className="absolute bottom-8 right-8 bg-white/90 backdrop-blur-md text-primary font-black uppercase italic text-xs h-12 px-8 rounded-2xl shadow-2xl hover:bg-white border-none z-10"
               >
                 <Camera className="w-4 h-4 mr-2 inline-block" /> +{experience.gallery.length - 4} Fotos
               </button>
             )}
          </div>
        </section>

        <div className="container mx-auto px-4 pt-12 max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-16">
          
          {/* LADO ESQUERDO: CONTEÚDO EDITORIAL */}
          <div className="lg:col-span-8 space-y-20">
            
            {/* 2. HEADER INFO */}
            <section className="space-y-6">
               <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                     <Badge className="bg-secondary text-white border-none font-black uppercase text-[10px] tracking-widest px-4 h-6">{experience.category || "Experiência"}</Badge>
                     {experience.reviewCount > 0 && (
                       <div className="flex items-center gap-1.5 bg-muted/50 px-3 py-1 rounded-full">
                          <Star className="w-3.5 h-3.5 fill-orange-400 text-orange-400" />
                          <span className="text-sm font-black">{Number(experience.averageRating || 5).toFixed(1)} <span className="opacity-40 font-bold">({experience.reviewCount} avaliações)</span></span>
                       </div>
                     )}
                  </div>
                  <h1 className="text-4xl md:text-7xl font-black text-primary uppercase italic tracking-tighter leading-[0.85]">{experience.title}</h1>
                  <div className="flex items-center gap-2 text-muted-foreground font-bold text-lg uppercase tracking-tight">
                     <MapPin className="w-5 h-5 text-secondary" /> {experience.city} • {experience.state}
                  </div>
               </div>

               {/* Destaques Rápidos Dinâmicos */}
               <div className="flex flex-wrap gap-4 pt-4">
                  {experience.duration && <Highlight icon={Clock} label={experience.duration} />}
                  {experience.maxGroupSize && <Highlight icon={Users} label={`Até ${experience.maxGroupSize} pessoas`} />}
                  {experience.instantBooking && <Highlight icon={Zap} label="Reserva Imediata" />}
                  {experience.digitalVoucher && <Highlight icon={ShieldCheck} label="Voucher Digital" />}
               </div>
            </section>

            <Separator className="border-dashed" />

            {/* 5. SOBRE A EXPERIÊNCIA */}
            <section className="space-y-8">
               <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground flex items-center gap-2">
                 <Info className="w-4 h-4 text-secondary" /> Sobre esta experiência
               </h2>
               <div className="prose prose-slate max-w-none prose-p:text-xl prose-p:font-medium prose-p:text-foreground/70 prose-p:leading-relaxed">
                  <RichText content={experience.description} />
               </div>
            </section>

            {/* 6 & 7. INCLUSÕES E EXCLUSÕES */}
            {(hasInclusions || hasExclusions) && (
              <section className="grid grid-cols-1 md:grid-cols-2 gap-12">
                 {hasInclusions && (
                   <div className="space-y-6">
                      <h3 className="font-black uppercase italic tracking-tighter text-xl text-primary">O que está incluso</h3>
                      <ul className="space-y-4">
                         {experience.inclusions.map((item: string, i: number) => (
                           <li key={i} className="flex items-center gap-3 text-lg font-medium text-foreground/70">
                              <CheckCircle2 className="w-6 h-6 text-green-500 shrink-0" /> {item}
                           </li>
                         ))}
                      </ul>
                   </div>
                 )}
                 {hasExclusions && (
                   <div className="space-y-6">
                      <h3 className="font-black uppercase italic tracking-tighter text-xl text-primary">O que não está incluso</h3>
                      <ul className="space-y-4">
                         {experience.exclusions.map((item: string, i: number) => (
                           <li key={i} className="flex items-center gap-3 text-lg font-medium text-muted-foreground/60">
                              <X className="w-6 h-6 text-destructive shrink-0 opacity-40" /> {item}
                           </li>
                         ))}
                      </ul>
                   </div>
                 )}
              </section>
            )}

            {/* 8. COMO FUNCIONA (TIMELINE) */}
            {hasSteps && (
              <section className="space-y-12 py-10 bg-muted/20 rounded-[3rem] p-12 border">
                 <div className="text-center space-y-2">
                    <h2 className="text-3xl font-black uppercase italic tracking-tighter text-primary">Como funciona</h2>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Sua jornada do início ao fim</p>
                 </div>
                 <div className="relative flex flex-col md:flex-row justify-between items-start gap-12 md:gap-4 before:hidden md:before:block before:absolute before:top-8 before:left-0 before:right-0 before:h-0.5 before:bg-border before:border-dashed">
                    {experience.steps.map((step: any, i: number) => (
                      <TimelineStep key={i} num={String(i + 1).padStart(2, '0')} label={step.label} desc={step.desc} />
                    ))}
                 </div>
              </section>
            )}

            {/* 9. LOCALIZAÇÃO */}
            <section className="space-y-8">
               <div className="flex items-center justify-between px-2">
                  <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground">Localização</h2>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
                  <div className="md:col-span-8 h-96 rounded-[3rem] overflow-hidden shadow-xl border">
                    <LocationMap latitude={lat} longitude={lng} interactive={false} onChange={() => {}} />
                  </div>
                  <div className="md:col-span-4 space-y-6">
                     <div className="space-y-1">
                        <h4 className="font-black text-2xl uppercase italic tracking-tighter text-primary">{address.venueName || experience.city}</h4>
                        <p className="text-sm font-medium text-muted-foreground uppercase leading-relaxed">
                           {address.addressLine1}{address.streetNumber ? `, ${address.streetNumber}` : ""}<br/>
                           {address.neighborhood ? `${address.neighborhood}, ` : ""}{experience.city} - {experience.state}
                        </p>
                     </div>
                     <Button asChild className="w-full bg-primary text-white font-black h-14 rounded-2xl shadow-xl uppercase italic gap-2 hover:scale-105 transition-transform">
                        <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((address.addressLine1 || "") + ' ' + experience.city)}`} target="_blank">
                           <Navigation className="w-4 h-4" /> Abrir no Maps
                        </a>
                     </Button>
                  </div>
               </div>
            </section>

            {/* 10. REGRAS (CARDS) */}
            {hasRules && (
              <section className="space-y-8">
                 <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground px-2">Regras e Políticas</h2>
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {experience.rules.map((rule: any, i: number) => (
                      <Card key={i} className="border-none shadow-sm bg-muted/30 p-6 flex flex-col items-center text-center gap-3 rounded-3xl">
                         <span className="text-[10px] font-black uppercase text-primary leading-tight">{rule.label}</span>
                      </Card>
                    ))}
                 </div>
              </section>
            )}

            {experience.usagePolicy && (
               <div className="p-8 bg-white border rounded-[2rem] text-sm text-muted-foreground leading-relaxed">
                  <RichText content={experience.usagePolicy} />
               </div>
            )}

          </div>

          {/* LADO DIREITO: CARD DE RESERVA (STICKY) */}
          <aside className="lg:col-span-4">
             <div className="sticky top-24 space-y-8" id="booking-card">
                <Card className="border-none shadow-2xl rounded-[3rem] bg-white p-8 space-y-8 overflow-hidden relative">
                   <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-secondary to-purple-500" />
                   
                   <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">A partir de</p>
                      <div className="text-4xl font-black text-primary italic tracking-tighter">{formatPrice(minPrice, experience.currency)}</div>
                   </div>

                   <Separator className="border-dashed" />

                   <div className="space-y-6">
                      <div className="space-y-3">
                         <Label className="text-[10px] font-black uppercase tracking-widest ml-1">1. Escolha a Data</Label>
                         <div className="bg-muted/30 p-4 rounded-[2rem] border-2 border-dashed flex justify-center">
                            <CalendarComponent 
                               mode="single" 
                               selected={selectedDate} 
                               onSelect={(d) => { setSelectedDate(d); setSelectedSlot(null); }}
                               locale={ptBR}
                               modifiers={{ available: availableDates, full: fullDates }}
                               modifiersClassNames={{ available: "bg-secondary/10 text-secondary font-black rounded-xl", full: "bg-muted text-muted-foreground opacity-30 line-through" }}
                               disabled={(date) => date < startOfDay(new Date())}
                               className="rounded-xl border-none"
                            />
                         </div>
                      </div>

                      {selectedDate && (
                        <div className="space-y-4 animate-in slide-in-from-top-2">
                           <Label className="text-[10px] font-black uppercase tracking-widest ml-1">2. Escolha o Horário</Label>
                           <div className="grid grid-cols-1 gap-2">
                              {filteredSlotsForDate.map(slot => (
                                <button 
                                  key={slot.id}
                                  onClick={() => setSelectedSlot(slot)}
                                  className={cn(
                                    "flex items-center justify-between p-4 rounded-2xl border-2 transition-all",
                                    selectedSlot?.id === slot.id ? "border-secondary bg-secondary/5 shadow-inner" : "border-transparent bg-muted/40 hover:bg-muted"
                                  )}
                                >
                                   <div className="flex items-center gap-3">
                                      <Clock className="w-4 h-4 text-secondary" />
                                      <span className="font-black text-sm uppercase italic">{new Date(slot.datetime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                   </div>
                                   <span className="font-black text-sm">{formatPrice(slot.hasPromo ? slot.promoPrice : slot.price, experience.currency)}</span>
                                </button>
                              ))}
                           </div>
                        </div>
                      )}

                      <Button 
                        onClick={handleAction}
                        disabled={loadingSlots}
                        className="w-full h-16 bg-primary text-white font-black rounded-2xl shadow-xl uppercase italic text-lg hover:scale-[1.02] transition-transform"
                      >
                         {loadingSlots ? <Loader2 className="animate-spin" /> : <><ShoppingBag className="w-5 h-5 mr-2" /> Reservar agora</>}
                      </Button>
                   </div>
                </Card>

                {/* Card do Organizador */}
                <Card className="border-none shadow-sm rounded-[2.5rem] bg-white p-8 space-y-6">
                   <div className="flex items-center gap-4">
                      <Avatar className="h-16 w-16 border-4 border-muted shadow-sm">
                         <AvatarImage src={experience.organizer?.avatar} className="object-cover" />
                         <AvatarFallback className="font-black">{experience.organizer?.name?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                         <div className="flex items-center gap-1.5">
                            <h4 className="font-black text-lg uppercase italic text-primary leading-none">{experience.organizer?.name}</h4>
                            {(experience.organizer?.verified || experience.organizer?.isVerified) && <BadgeCheck className="w-4 h-4 text-blue-500" />}
                         </div>
                         {organizerJoinedDate && (
                           <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Membro desde {organizerJoinedDate.getFullYear()}</p>
                         )}
                      </div>
                   </div>
                   <div className="grid grid-cols-2 gap-4 py-4 border-y border-dashed">
                      <div className="text-center">
                         <p className="text-xl font-black text-primary italic">{experience.organizer?.experienceCount || 1}</p>
                         <p className="text-[8px] font-black uppercase opacity-40">Experiências</p>
                      </div>
                      <div className="text-center">
                         <p className="text-xl font-black text-primary italic">{Number(experience.organizer?.averageRating || 5.0).toFixed(1)}</p>
                         <p className="text-[8px] font-black uppercase opacity-40">Nota Média</p>
                      </div>
                   </div>
                   <Button variant="ghost" asChild className="w-full h-10 rounded-xl font-black uppercase italic text-[10px] gap-2 border">
                      <Link href={`/${experience.organizer?.username}`}>Ver Perfil Completo <ArrowRight className="w-3.5 h-3.5" /></Link>
                   </Button>
                </Card>
             </div>
          </aside>
        </div>

        {/* 11 & 12. REVIEWS & COMUNIDADE */}
        <CommunityGallery experienceId={experience.id} />
        <ExperiencePublicReviews experience={experience} />

        {/* 15. FAQ */}
        {hasFaqs && (
          <section className="container mx-auto px-4 max-w-4xl py-24">
             <div className="text-center space-y-2 mb-12">
                <h2 className="text-3xl font-black uppercase italic tracking-tighter text-primary">Dúvidas Frequentes</h2>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Tudo o que você precisa saber</p>
             </div>
             <Accordion type="single" collapsible className="space-y-4">
                {experience.faqs.map((faq: any, i: number) => (
                  <FaqItem key={i} q={faq.q} a={faq.a} />
                ))}
             </Accordion>
          </section>
        )}

        {/* 16. FINAL CTA */}
        <section className="container mx-auto px-4 py-32 text-center">
           <div className="max-w-3xl mx-auto space-y-12">
              <div className="space-y-4">
                 <h2 className="text-5xl md:text-8xl font-black uppercase italic tracking-tighter text-primary leading-none">Pronto para viver essa experiência?</h2>
                 <p className="text-xl font-medium text-muted-foreground">Junte-se a centenas de pessoas que já viveram momentos inesquecíveis.</p>
              </div>
              <Button 
                onClick={() => document.getElementById('booking-card')?.scrollIntoView({ behavior: 'smooth' })}
                className="h-20 px-16 bg-secondary text-white font-black rounded-[2.5rem] shadow-2xl shadow-secondary/30 uppercase italic text-2xl hover:scale-105 transition-all"
              >
                 Reservar agora <ArrowRight className="w-8 h-8 ml-4" />
              </Button>
           </div>
        </section>
      </main>

      <Footer />

      {/* FULLSCREEN GALLERY LIGHTBOX */}
      <AnimatePresence>
        {isGalleryOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-3xl flex flex-col p-8"
          >
             <div className="flex justify-between items-center mb-8">
                <h3 className="text-white font-black uppercase italic tracking-tighter text-2xl">{experience.title}</h3>
                <Button variant="ghost" onClick={() => setIsGalleryOpen(false)} className="rounded-full h-12 w-12 text-white hover:bg-white/10"><X className="w-8 h-8" /></Button>
             </div>
             <ScrollArea className="flex-1">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
                   {[experience.image, ...(experience.gallery || [])].map((url, i) => (
                     <div key={i} className="relative aspect-video rounded-3xl overflow-hidden border border-white/10">
                        <img src={url} className="w-full h-full object-cover" alt="" />
                     </div>
                   ))}
                </div>
             </ScrollArea>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Highlight({ icon: Icon, label }: any) {
  return (
    <div className="flex items-center gap-2 bg-muted/50 px-4 py-2 rounded-2xl border border-border/40">
       <Icon className="w-4 h-4 text-secondary" />
       <span className="text-xs font-bold uppercase tracking-tight text-primary/80">{label}</span>
    </div>
  )
}

function TimelineStep({ num, label, desc }: any) {
  return (
    <div className="relative z-10 flex flex-col items-center md:items-start text-center md:text-left gap-4 flex-1">
       <div className="w-16 h-16 rounded-[1.5rem] bg-white shadow-xl flex items-center justify-center font-black italic text-xl text-secondary border border-secondary/10">{num}</div>
       <div className="space-y-1">
          <p className="font-black uppercase italic text-primary">{label}</p>
          <p className="text-[10px] font-bold text-muted-foreground uppercase leading-relaxed max-w-[150px]">{desc}</p>
       </div>
    </div>
  )
}

function FaqItem({ q, a }: { q: string, a: string }) {
  return (
    <AccordionItem value={q} className="border-none">
       <Card className="border-none shadow-sm bg-muted/10 rounded-2xl overflow-hidden">
          <AccordionTrigger className="px-8 py-6 hover:no-underline font-black uppercase italic tracking-tighter text-primary">
            {q}
          </AccordionTrigger>
          <AccordionContent className="px-8 pb-6 text-base font-medium text-muted-foreground leading-relaxed">
            {a}
          </AccordionContent>
       </Card>
    </AccordionItem>
  )
}
