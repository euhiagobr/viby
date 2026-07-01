
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
  AlertTriangle,
  Star,
  Camera,
  Users
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
      
      if (hasVacancy) {
        stats[key].available = true;
      }
      
      if (hasVacancy) {
        stats[key].full = false;
      }
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
      const el = document.getElementById('seletor-agenda');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
      toast({ title: "Escolha uma data", description: "Selecione o dia e horário desejado no calendário." });
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

    toast({ title: "Adicionado!", description: "Sua vaga foi reservada no carrinho." });
    router.push('/dashboard/carrinho');
  };

  const address = experience.address || {};
  const lat = address.latitude || experience.latitude || -23.55052;
  const lng = address.longitude || experience.longitude || -46.633308;

  const minPrice = React.useMemo(() => {
    if (slots.length === 0) return 0;
    const now = new Date();
    const prices = slots
      .filter(s => new Date(s.datetime) > now && (s.capacity - (s.sold || 0)) > 0)
      .map(s => s.hasPromo ? s.promoPrice : s.price);
    return prices.length > 0 ? Math.min(...prices) : 0;
  }, [slots]);

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col selection:bg-secondary selection:text-white">
      <PublicHeader showBack />

      <main className="flex-1 animate-in fade-in duration-700">
        <div className="relative h-[40vh] md:h-[55vh] w-full overflow-hidden bg-black">
          {experience.image && (
            <Image src={experience.image} alt={experience.title} fill className="object-cover opacity-80" priority unoptimized />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#f8fafc] via-[#f8fafc]/30 to-transparent" />
          <div className="absolute bottom-0 left-0 p-6 md:p-12 w-full">
            <div className="container mx-auto max-w-6xl space-y-6">
              <Badge className="bg-secondary text-white border-none text-[10px] font-black uppercase px-4 py-1.5 rounded-full shadow-lg">
                {experience.category || "Vivência Cultural"}
              </Badge>
              <h1 className="text-4xl md:text-7xl font-black text-primary uppercase italic tracking-tighter leading-[0.85]">{experience.title}</h1>
              <div className="flex flex-col gap-1">
                 <p className="text-lg md:text-2xl font-medium text-primary/70 max-w-2xl leading-relaxed uppercase tracking-wide italic">
                  {experience.shortDescription}
                 </p>
                 <div className="flex items-center gap-6 mt-2">
                    {minPrice > 0 && (
                      <p className="text-xl font-black text-secondary italic uppercase tracking-tighter">A partir de {formatPrice(minPrice, experience.currency || 'BRL')}</p>
                    )}
                    <div className="flex items-center gap-2 bg-white/80 px-3 py-1.5 rounded-full shadow-sm">
                       <Star className="w-4 h-4 fill-orange-400 text-orange-400" />
                       <span className="text-sm font-black text-primary">{Number(experience.averageRating || 5).toFixed(1)} <span className="opacity-40 font-bold">({experience.reviewCount || 0})</span></span>
                    </div>
                 </div>
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-12 max-w-6xl flex flex-col lg:grid lg:grid-cols-12 gap-12">
          
          <div className="lg:col-span-7 flex flex-col gap-16 order-1">
            
            <section className="space-y-6 order-1">
              <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground px-2 flex items-center gap-2">
                <Info className="w-4 h-4 text-secondary" /> Detalhes da Experiência
              </h2>
              <Card className="border-none shadow-sm rounded-[2.5rem] bg-white overflow-hidden">
                <CardContent className="p-8 md:p-12">
                  <RichText content={experience.description} className="text-lg md:text-xl font-medium text-foreground/80 leading-relaxed" />
                </CardContent>
              </Card>
            </section>

            <section className="space-y-6 order-2">
              <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground px-2 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-secondary" /> Localização
              </h2>
              <Card className="border-none shadow-sm rounded-[2.5rem] bg-white overflow-hidden">
                <div className="h-64 w-full">
                  <LocationMap latitude={lat} longitude={lng} interactive={false} onChange={() => {}} />
                </div>
                <CardContent className="p-8 flex flex-col md:flex-row justify-between items-center gap-6">
                   <div className="space-y-1 text-center md:text-left">
                      <h4 className="font-black text-xl uppercase italic tracking-tighter text-primary">
                        {address.venueName || "Local de Realização"}
                      </h4>
                      <p className="text-xs font-medium text-muted-foreground uppercase leading-relaxed">
                        {address.addressLine1} {address.streetNumber && `, ${address.streetNumber}`}
                        <br />
                        {address.neighborhood && `${address.neighborhood}, `} {address.city} - {address.stateRegion}
                      </p>
                   </div>
                   <Button variant="outline" className="rounded-xl h-12 px-6 gap-2 font-bold uppercase text-[10px] border-secondary text-secondary" asChild>
                      <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((address.addressLine1 || '') + ' ' + (address.city || ''))}`} target="_blank" rel="noopener noreferrer">
                        <Navigation className="w-4 h-4" /> Ver no Mapa
                      </a>
                   </Button>
                </CardContent>
              </Card>
            </section>

            {experience.usagePolicy && (
              <section className="space-y-6 order-4">
                <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground px-2 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-secondary" /> Regras e Políticas
                </h2>
                <Card className="border-none shadow-sm rounded-[2.5rem] bg-white p-8 md:p-12">
                   <RichText content={experience.usagePolicy} className="text-sm md:text-base font-medium text-muted-foreground leading-relaxed" />
                </Card>
              </section>
            )}
          </div>

          <aside id="seletor-agenda" className="lg:col-span-5 order-3 lg:row-start-1 lg:row-span-10">
            <div className="lg:sticky lg:top-24 space-y-8">
              <Card className="border-none shadow-2xl rounded-[3rem] bg-white p-8 space-y-8">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary">Selecionar Data</h3>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Escolha o dia da sua vivência</p>
                    </div>
                  </div>

                  <div className="bg-muted/30 rounded-[2rem] p-4 flex justify-center border-2 border-dashed border-border/40">
                    <CalendarComponent
                      mode="single"
                      selected={selectedDate}
                      onSelect={(d) => { setSelectedDate(d); setSelectedSlot(null); }}
                      locale={ptBR}
                      disabled={(date) => {
                          const now = startOfDay(new Date());
                          if (date < now) return true;
                          return false;
                      }}
                      modifiers={{
                          available: availableDates,
                          full: fullDates
                      }}
                      modifiersClassNames={{
                          available: "bg-secondary/10 text-secondary font-black hover:bg-secondary hover:text-white rounded-xl",
                          full: "bg-muted-foreground/10 text-muted-foreground/40 line-through rounded-xl"
                      }}
                      className="rounded-xl border-none"
                    />
                  </div>

                  {selectedDate && (
                    <div className="space-y-6 animate-in slide-in-from-top-4 duration-500">
                      <Separator className="border-dashed" />
                      <div className="space-y-3">
                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Horários para {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}</p>
                        <div className="grid grid-cols-1 gap-2">
                            {filteredSlotsForDate.length > 0 ? filteredSlotsForDate.map(slot => {
                              const remaining = slot.capacity - (slot.sold || 0);
                              const isSoldOut = remaining <= 0;
                              const isLowStock = !isSoldOut && (remaining / slot.capacity) <= 0.1;
                              const isSelected = selectedSlot?.id === slot.id;

                              return (
                                <button
                                  key={slot.id}
                                  disabled={isSoldOut}
                                  onClick={() => setSelectedSlot(slot)}
                                  className={cn(
                                    "w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all group",
                                    isSelected ? "border-secondary bg-secondary/5 shadow-inner" : "border-transparent bg-muted/40 hover:border-secondary/20",
                                    isSoldOut && "opacity-40 grayscale cursor-not-allowed"
                                  )}
                                >
                                  <div className="flex items-center gap-4">
                                      <div className={cn("p-2 rounded-xl", isSelected ? "bg-secondary text-white" : "bg-white text-primary shadow-sm")}>
                                        <Clock className="w-4 h-4" />
                                      </div>
                                      <div className="text-left">
                                        <p className="text-sm font-black uppercase italic text-primary">{new Date(slot.datetime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                                        <p className={cn("text-[9px] font-bold uppercase", isLowStock ? "text-orange-600" : "text-muted-foreground")}>
                                            {isSoldOut ? "Lote Esgotado" : isLowStock ? "Últimas vagas" : "Disponível"}
                                        </p>
                                      </div>
                                  </div>
                                  <div className="text-right">
                                      {slot.hasPromo ? (
                                        <div className="flex flex-col items-end">
                                          <span className="text-[8px] font-black text-red-500 uppercase line-through opacity-40">{formatPrice(slot.price, experience.currency)}</span>
                                          <span className="text-sm font-black text-secondary">{formatPrice(slot.promoPrice, experience.currency)}</span>
                                        </div>
                                      ) : (
                                        <span className="text-sm font-black text-primary">{formatPrice(slot.price, experience.currency)}</span>
                                      )}
                                  </div>
                                </button>
                              );
                            }) : (
                              <div className="p-8 text-center bg-red-50 rounded-2xl border-2 border-dashed border-red-200">
                                <AlertTriangle className="w-6 h-6 text-red-500 mx-auto mb-2" />
                                <p className="text-[10px] font-black uppercase text-red-700">Sem disponibilidade para esta data</p>
                              </div>
                            )}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="pt-4">
                    <Button 
                      onClick={handleAction}
                      className="w-full h-16 bg-primary text-white font-black rounded-2xl shadow-xl uppercase italic text-sm gap-2 transition-all hover:scale-105 active:scale-95"
                    >
                      <ShoppingBag className="w-5 h-5" /> {selectedSlot ? "Adicionar ao Carrinho" : "Selecione um Horário"}
                    </Button>
                  </div>

                  <Separator className="border-dashed" />

                  <div className="flex items-center gap-4">
                    <Avatar className="h-12 w-12 border-2 border-secondary/10">
                      <AvatarImage src={experience.organizer?.avatar} className="object-cover" />
                      <AvatarFallback className="font-bold">{experience.organizer?.name?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-black text-sm uppercase italic text-primary truncate">{experience.organizer?.name}</h4>
                        <BadgeCheck className="w-4 h-4 text-blue-500 shrink-0" />
                      </div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase mt-0.5">@{experience.organizer?.username}</p>
                    </div>
                    <Button variant="outline" size="icon" className="rounded-xl h-10 w-10 border-2" onClick={() => {
                      if (navigator.share) navigator.share({ title: experience.title, url: window.location.href });
                      else toast({ title: "Link copiado!" });
                    }}><Share2 className="w-4 h-4" /></Button>
                  </div>
                </div>
              </Card>

              <div className="p-6 bg-secondary/5 rounded-[2.5rem] border border-secondary/10 flex items-start gap-4">
                <ShieldCheck className="w-6 h-6 text-secondary shrink-0 mt-0.5" />
                <p className="text-[9px] text-secondary font-bold uppercase leading-relaxed italic">
                   Garantia de reserva: Sua vaga é assegurada por 10 minutos após ser adicionada ao carrinho para que você conclua o checkout com tranquilidade.
                </p>
              </div>
            </div>
          </aside>
        </div>

        {/* NOVAS SEÇÕES: GALERIA E REVIEWS */}
        <CommunityGallery experienceId={experience.id} />
        <ExperiencePublicReviews experience={experience} />

      </main>

      <Footer />
    </div>
  );
}
