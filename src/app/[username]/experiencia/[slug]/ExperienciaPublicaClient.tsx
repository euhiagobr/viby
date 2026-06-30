'use client';

import * as React from 'react';
import { PublicHeader } from '@/components/layout/PublicHeader';
import Footer from '@/components/layout/Footer';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Sparkles, 
  Share2, 
  ShieldCheck, 
  Clock, 
  Building2,
  BadgeCheck,
  Info,
  ArrowLeft,
  MapPin,
  Navigation,
  CheckCircle2,
  ShoppingBag,
  Coins,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { RichText } from '@/components/ui/rich-text';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { useCurrency, CurrencyCode } from '@/contexts/CurrencyContext';
import { Separator } from '@/components/ui/separator';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { ExperienceSlotsPublic } from '@/components/experiences/ExperienceSlotsPublic';
import { useCart } from '@/contexts/CartContext';
import { toast } from '@/hooks/use-toast';
import { useAuth, useUser } from '@/firebase';
import { useRouter, usePathname } from 'next/navigation';

const LocationMap = dynamic(() => import("@/components/events/LocationMap").then(mod => mod.LocationMap), { 
  ssr: false,
  loading: () => <div className="w-full h-full bg-muted animate-pulse flex items-center justify-center text-[10px] font-black uppercase opacity-20">Carregando Mapa...</div>
})

interface ExperienciaPublicaClientProps {
  experience: any;
}

export default function ExperienciaPublicaClient({ experience }: ExperienciaPublicaClientProps) {
  const { formatPriceWithOriginal } = useCurrency();
  const { addItem } = useCart();
  const db = useFirestore();
  const auth = useAuth();
  const { user } = useUser(auth);
  const router = useRouter();
  const pathname = usePathname();

  const [selectedSlot, setSelectedSlot] = React.useState<any>(null);

  const slotsQuery = useMemoFirebase(() => {
    if (!db || !experience.id) return null;
    return query(
      collection(db, "experiences", experience.id, "slots"),
      where("status", "==", "active"),
      orderBy("datetime", "asc")
    );
  }, [db, experience.id]);

  const { data: slots, loading: loadingSlots } = useCollection<any>(slotsQuery);

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: experience.title,
        url: window.location.href
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast({ title: "Link copiado!" });
    }
  };

  const handleReserve = () => {
    if (!selectedSlot) {
      toast({ variant: "destructive", title: "Selecione um horário", description: "Escolha uma das opções disponíveis acima." });
      return;
    }

    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(pathname || '/')}`);
      return;
    }

    // Mapeamento para CartItem suportando Experience
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
      ticketTypeId: "exp_slot",
      ticketTypeName: "Vaga",
      batchId: "slot",
      batchName: "Reserva",
      currency: (experience.currency || 'BRL'),
      price: selectedSlot.price,
      originalPrice: selectedSlot.price,
      quantity: 1,
      requiresProof: false,
      occurrenceId: selectedSlot.id,
      productType: 'experience'
    } as any);

    toast({ title: "Vaga reservada!", description: "O item foi adicionado ao seu carrinho." });
    router.push('/dashboard/carrinho');
  };

  const address = experience.address || {};
  const lat = address.latitude || experience.latitude || -23.55052;
  const lng = address.longitude || experience.longitude || -46.633308;
  const locationQuery = encodeURIComponent(`${address.addressLine1} ${address.city}`);

  const displayPrice = selectedSlot ? selectedSlot.price : experience.price;
  const displayCurrency = (selectedSlot?.currency || experience.currency || 'BRL') as CurrencyCode;

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col selection:bg-secondary selection:text-white">
      <PublicHeader showBack />

      <main className="flex-1 animate-in fade-in duration-700">
        <div className="relative h-[40vh] md:h-[60vh] w-full overflow-hidden bg-black">
          {experience.image && (
            <Image 
              src={experience.image} 
              alt={experience.title} 
              fill 
              className="object-cover opacity-80"
              priority
              unoptimized 
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#f8fafc] via-[#f8fafc]/30 to-transparent" />
          <div className="absolute bottom-0 left-0 p-6 md:p-12 w-full">
            <div className="container mx-auto max-w-6xl space-y-6">
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-secondary text-white border-none text-[10px] font-black uppercase px-4 py-1.5 rounded-full shadow-lg">
                  Vivência Cultural
                </Badge>
              </div>
              <h1 className="text-4xl md:text-7xl font-black text-primary uppercase italic tracking-tighter leading-[0.85]">{experience.title}</h1>
              <p className="text-lg md:text-2xl font-medium text-primary/70 max-w-2xl leading-relaxed uppercase tracking-wide italic">
                {experience.shortDescription}
              </p>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-12 max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-8 space-y-12">
            
            {experience.gallery?.length > 0 && (
              <section className="space-y-6">
                <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground px-2">Galeria</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                   {experience.gallery.map((url: string, i: number) => (
                     <div key={i} className="relative aspect-square rounded-[2rem] overflow-hidden shadow-sm hover:shadow-xl transition-all group">
                        <Image src={url} alt={`Preview ${i}`} fill className="object-cover transition-transform duration-700 group-hover:scale-110" unoptimized />
                     </div>
                   ))}
                </div>
              </section>
            )}

            <section className="space-y-6">
               {loadingSlots ? (
                 <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-secondary" /></div>
               ) : (
                 <ExperienceSlotsPublic 
                   slots={slots || []} 
                   onSelect={setSelectedSlot} 
                   selectedSlotId={selectedSlot?.id} 
                 />
               )}
            </section>

            <section className="space-y-6">
              <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground px-2 flex items-center gap-2">
                <Info className="w-4 h-4 text-secondary" /> Detalhes da Experiência
              </h2>
              <Card className="border-none shadow-sm rounded-[2.5rem] bg-white overflow-hidden">
                <CardContent className="p-8 md:p-12">
                  <RichText content={experience.description} className="text-lg md:text-xl font-medium text-foreground/80 leading-relaxed" />
                </CardContent>
              </Card>
            </section>

            <section className="space-y-6">
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
                      <p className="text-xs font-medium text-muted-foreground uppercase">
                        {address.addressLine1} {address.streetNumber && `, ${address.streetNumber}`}
                        <br />
                        {address.neighborhood && `${address.neighborhood}, `} {address.city} - {address.stateRegion}
                      </p>
                   </div>
                   <Button variant="outline" className="rounded-xl h-12 px-6 gap-2 font-bold uppercase text-[10px] border-secondary text-secondary" asChild>
                      <a href={`https://www.google.com/maps/search/?api=1&query=${locationQuery}`} target="_blank">
                        <Navigation className="w-4 h-4" /> GPS
                      </a>
                   </Button>
                </CardContent>
              </Card>
            </section>

            {(experience.additionalInfo || experience.usagePolicy) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {experience.additionalInfo && (
                  <Card className="border-none shadow-sm rounded-3xl bg-white p-8 space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-secondary">Informações Úteis</h4>
                    <p className="text-sm font-medium text-muted-foreground leading-relaxed">{experience.additionalInfo}</p>
                  </Card>
                )}
                {experience.usagePolicy && (
                  <Card className="border-none shadow-sm rounded-3xl bg-white p-8 space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-secondary">Políticas e Regras</h4>
                    <p className="text-sm font-medium text-muted-foreground leading-relaxed">{experience.usagePolicy}</p>
                  </Card>
                )}
              </div>
            )}
          </div>

          <aside className="lg:col-span-4 space-y-8">
            <Card className="border-none shadow-xl rounded-[2.5rem] bg-white p-8 space-y-8 sticky top-24">
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <Avatar className="h-14 w-14 border-2 border-secondary/10 p-0.5">
                    <AvatarImage src={experience.organizer?.avatar} className="rounded-full object-cover" />
                    <AvatarFallback className="font-bold text-xl uppercase">{experience.organizer?.name?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className="font-black text-sm uppercase italic text-primary truncate">{experience.organizer?.name}</h4>
                      <BadgeCheck className="w-4 h-4 text-blue-500 shrink-0" />
                    </div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase mt-0.5">@{experience.organizer?.username}</p>
                  </div>
                </div>

                <Separator className="border-dashed" />

                <div className="space-y-6">
                   <div className="flex justify-between items-end">
                      <div className="space-y-1">
                         <p className="text-[9px] font-black uppercase text-muted-foreground opacity-60">
                           {selectedSlot ? "Valor do Horário" : "Valor da Experiência"}
                         </p>
                         {formatPriceWithOriginal(displayPrice, displayCurrency)}
                      </div>
                      <div className="text-right">
                         <p className="text-[9px] font-black uppercase text-muted-foreground opacity-60">Vagas</p>
                         <p className="text-sm font-bold">
                           {selectedSlot ? (selectedSlot.capacity - (selectedSlot.sold || 0)) : (experience.capacity || "Ilimitado")}
                         </p>
                      </div>
                   </div>

                   <div className="space-y-3">
                      <Button 
                        disabled={!selectedSlot || (selectedSlot.sold >= selectedSlot.capacity)} 
                        onClick={handleReserve}
                        className="w-full h-14 bg-primary text-white font-black rounded-2xl shadow-xl uppercase italic text-sm gap-2"
                      >
                        <ShoppingBag className="w-5 h-5" /> 
                        {selectedSlot ? "Reservar Vaga" : "Selecione um Horário"}
                      </Button>
                      
                      {selectedSlot && (
                        <div className="p-3 bg-green-50 rounded-xl flex items-start gap-2 border border-green-100 animate-in fade-in zoom-in-95">
                           <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0 mt-0.5" />
                           <div className="space-y-0.5">
                              <p className="text-[8px] font-black uppercase text-green-800">Horário Selecionado</p>
                              <p className="text-[10px] font-bold text-green-700">
                                {new Date(selectedSlot.datetime).toLocaleDateString('pt-BR')} às {new Date(selectedSlot.datetime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                           </div>
                        </div>
                      )}
                </div>

                <Separator className="border-dashed" />

                <div className="space-y-4">
                  <Button onClick={handleShare} variant="outline" className="w-full h-11 rounded-xl font-black uppercase italic text-[11px] gap-2 border-secondary/20 text-secondary">
                    <Share2 className="w-4 h-4" /> Indicar para Amigos
                  </Button>
                  <Button variant="ghost" asChild className="w-full h-11 rounded-xl font-bold uppercase text-[10px] text-muted-foreground">
                    <Link href={`/${experience.organizer?.username}`}>Ver Perfil da Marca</Link>
                  </Button>
                </div>
              </div>
              <div className="p-4 bg-muted/30 rounded-2xl flex items-start gap-3">
                <ShieldCheck className="w-4 h-4 text-secondary opacity-40 shrink-0" />
                <p className="text-[9px] font-bold text-muted-foreground uppercase leading-tight">
                  Experiência protegida pela curadoria oficial Viby.
                </p>
              </div>
            </Card>
          </aside>
        </div>
      </main>

      <Footer />
    </div>
  );
}
