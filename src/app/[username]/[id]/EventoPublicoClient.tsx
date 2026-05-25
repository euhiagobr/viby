
'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
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
  orderBy,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import {
  Loader2,
  ArrowLeft,
  ArrowRight,
  Share2,
  Flag,
  Calendar,
  MapPin,
  Clock,
  Info,
  CheckCircle2,
  Ticket,
  Users2,
  ChevronRight,
  Layers,
  Navigation,
  Plus,
  Minus,
  X,
  ShoppingCart,
  Accessibility,
  Maximize2,
  Megaphone,
  ZoomIn,
  ZoomOut,
  RefreshCcw,
  Hand,
  MousePointer2,
  Map as MapIcon,
  Timer,
  BadgeCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { useCart } from '@/contexts/CartContext';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { formatCurrency, calculateFinancialBreakdown } from '@/lib/financial-utils';
import Image from 'next/image';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ToastAction } from "@/components/ui/toast";
import { Separator } from '@/components/ui/separator';
import Footer from '@/components/layout/Footer';

// --- COMPONENTES AUXILIARES ---

function VerifiedBadge() {
  return (
    <BadgeCheck className="w-5 h-5 fill-blue-500 text-white" />
  );
}

function Avatar({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('relative flex shrink-0 overflow-hidden rounded-full', className)}>
      {children}
    </div>
  );
}

function AvatarImage({ src, className }: { src?: string; className?: string }) {
  return <img src={src} className={cn('aspect-square h-full w-full object-cover', className)} />;
}

function AvatarFallback({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex h-full w-full items-center justify-center rounded-full bg-muted text-muted-foreground',
        className
      )}
    >
      {children}
    </div>
  );
}

const renderFormattedText = (text: string) => {
  if (!text) return '';
  const parts = text.split(/(\*\*.*?\*\*|@[\w.]+|\+.*?\+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return (
        <strong key={i} className="font-black">
          {part.slice(2, -2)}
        </strong>
      );
    if (part.startsWith('@'))
      return (
        <Link
          key={i}
          href={`/${part.slice(1).toLowerCase()}`}
          className="text-secondary font-black hover:underline"
        >
          {part}
        </Link>
      );
    if (part.startsWith('+') && part.endsWith('+')) {
       return part.slice(1, -1);
    }
    return part;
  });
};

// --- COMPONENTES DA PÁGINA ---

function EventHero({ event }: { event: any }) {
  const dateValue = event.startDate || event.date;
  const d = dateValue?.toDate ? dateValue.toDate() : new Date(dateValue);
  const formattedDate = d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const formattedTime = d.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="relative w-full">
      <div className="relative h-[40vh] md:h-[60vh] w-full overflow-hidden">
        <Image
          src={event.image || 'https://picsum.photos/seed/event/1200/800'}
          alt={event.title}
          fill
          className='object-cover'
          priority
          unoptimized
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
      </div>

      <div className="max-w-7xl mx-auto px-4 -mt-32 relative z-10 space-y-6">
        <div className="flex flex-wrap gap-2">
          <Badge className="bg-secondary text-white border-none text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full shadow-lg">
            {event.categoryName || 'Evento'}
          </Badge>
          {event.isSponsored && (
            <Badge className="bg-primary text-white border-none text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full shadow-lg flex items-center gap-1.5">
              <Megaphone className="w-3 h-3 text-secondary fill-current" /> Destaque
            </Badge>
          )}
        </div>

        <h1 className="text-4xl md:text-7xl font-black text-foreground tracking-tighter uppercase italic leading-[0.85]">
          {event.title}
        </h1>

        <div className="flex flex-wrap items-center gap-6 text-muted-foreground font-bold text-xs uppercase tracking-wider">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-secondary" />
            {formattedDate}
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-secondary" />
            {formattedTime}
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-secondary" />
            {event.city}
          </div>
        </div>
      </div>
    </div>
  );
}

function VenueMap({
  event,
  setores,
  selectedSectorId,
  onSelectSector,
  onToggleSeat,
  selectedSeatIds,
}: {
  event: any;
  setores: any[];
  selectedSectorId: string | null;
  onSelectSector: (sector: any) => void;
  onToggleSeat: (seat: any) => void;
  selectedSeatIds: string[];
}) {
  const [scale, setScale] = React.useState(0.8);
  const [isPanningEnabled, setIsPanningEnabled] = React.useState(false);

  return (
    <Card className="border-none shadow-inner rounded-[2.5rem] bg-muted/10 overflow-hidden relative group">
      <TransformWrapper 
        initialScale={0.8} 
        minScale={0.1} 
        maxScale={3} 
        centerOnInit
        limitToBounds={false}
        panning={{ disabled: !isPanningEnabled }}
        onTransformed={(ref) => setScale(ref.state.scale)}
      >
        {({ zoomIn, zoomOut, resetTransform }) => (
          <>
            <div className="absolute bottom-6 right-6 z-30 flex flex-col gap-2 bg-white/80 backdrop-blur-md p-2 rounded-2xl shadow-xl border border-border opacity-0 group-hover:opacity-100 transition-opacity">
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={() => zoomIn()}><ZoomIn className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={() => zoomOut()}><ZoomOut className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={() => resetTransform()}><RefreshCcw className="w-4 h-4" /></Button>
              <Separator />
              <Button 
                variant={isPanningEnabled ? 'secondary' : 'ghost'} 
                size="icon" 
                className={cn("h-9 w-9 rounded-xl", isPanningEnabled ? "bg-secondary text-white" : "text-muted-foreground")}
                onClick={() => setIsPanningEnabled(!isPanningEnabled)}
              >
                 {isPanningEnabled ? <Hand className="w-4 h-4" /> : <MousePointer2 className="w-4 h-4" />}
              </Button>
            </div>

            <TransformComponent wrapperStyle={{ width: '100%', height: '500px' }}>
              <div className="relative min-w-[2000px] min-h-[1500px] bg-white">
                <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#e5e7eb 1.5px, transparent 0)', backgroundSize: '40px 40px' }} />
                
                <div className="absolute inset-0">
                  <div 
                    style={{ position: 'absolute', left: 700, top: 50, width: 600, height: 120 }}
                    className="bg-primary text-white flex flex-col items-center justify-center rounded-2xl shadow-2xl border-4 border-white/20 select-none"
                  >
                    <span className="font-black italic uppercase tracking-[0.5em] text-xl">{event.palcoNome || "PALCO PRINCIPAL"}</span>
                  </div>

                  {setores.map((s: any) => (
                    <div
                      key={s.id}
                      style={{ 
                        position: 'absolute', 
                        left: s.posX || 0, 
                        top: s.posY || 0, 
                        width: s.width || 400, 
                        height: s.height || 300,
                        borderColor: s.cor,
                      }}
                      className={cn(
                        "border-2 transition-all rounded-[2rem] flex flex-col items-center justify-center cursor-pointer",
                        selectedSectorId === s.id ? "bg-white shadow-2xl ring-4 ring-secondary/40 z-20" : "bg-white/40 hover:bg-white/60 shadow-lg z-10"
                      )}
                      onClick={(e) => { e.stopPropagation(); if(!isPanningEnabled) onSelectSector(s); }}
                    >
                      <div className="absolute -top-10 left-0">
                        <Badge style={{ backgroundColor: s.cor }} className="text-[10px] font-black uppercase text-white shadow-md">{s.nome}</Badge>
                      </div>

                      {selectedSectorId === s.id && (s.tipo === 'assentos' || s.tipo === 'mesas') ? (
                        <div className="w-full h-full relative p-8">
                           <SectorSeatsContent 
                             eventId={event.id} 
                             sectorId={s.id} 
                             onToggleSeat={onToggleSeat} 
                             selectedSeatIds={selectedSeatIds} 
                           />
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1 opacity-40 select-none">
                           <h4 className="font-black uppercase italic text-xs">{s.nome}</h4>
                           <p className="text-[9px] font-bold">{s.capacidade} LUGARES {s.tipo.toUpperCase()}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </TransformComponent>
          </>
        )}
      </TransformWrapper>
    </Card>
  );
}

function SectorSeatsContent({
  eventId,
  sectorId,
  onToggleSeat,
  selectedSeatIds,
}: {
  eventId: string;
  sectorId: string;
  onToggleSeat: (seat: any) => void;
  selectedSeatIds: string[];
}) {
  const db = useFirestore();
  const seatsQuery = useMemoFirebase(() => {
    if (!db || !eventId || !sectorId) return null;
    return query(
      collection(db, 'events', eventId, 'setores', sectorId, 'assentos'),
      orderBy('codigo', 'asc')
    );
  }, [db, eventId, sectorId]);
  
  const { data: seats, loading } = useCollection<any>(seatsQuery);

  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="w-6 h-6 animate-spin text-secondary" /></div>;

  return (
    <>
      {seats?.map((seat) => {
        const isSold = seat.status === 'vendido';
        const isSelected = selectedSeatIds.includes(seat.id);
        return (
          <button
            key={seat.id}
            disabled={isSold}
            onClick={(e) => { e.stopPropagation(); onToggleSeat(seat); }}
            style={{ 
                position: 'absolute', 
                left: seat.posX || 0, 
                top: seat.posY || 0,
                width: '32px',
                height: '32px'
            }}
            className={cn(
              'rounded-lg flex items-center justify-center text-[9px] font-black transition-all border-2 shadow-sm',
              isSold
                ? 'bg-muted text-muted-foreground/30 cursor-not-allowed border-muted-foreground/10'
                : isSelected
                  ? 'bg-green-500 text-white scale-110 shadow-lg ring-4 ring-green-500/20 border-green-600 z-30'
                  : seat.categoria === 'pcd'
                    ? 'bg-blue-50 border-blue-500 text-blue-600'
                    : seat.categoria === 'pcd_acompanhante'
                       ? 'bg-purple-50 border-purple-500 text-purple-600'
                       : seat.categoria === 'obeso'
                          ? 'bg-orange-50 border-orange-500 text-orange-600'
                          : 'bg-white border-secondary/20 text-secondary hover:border-secondary hover:bg-secondary/5'
            )}
          >
            {seat.categoria === 'pcd' ? <Accessibility className="w-3.5 h-3.5" /> : 
             seat.categoria === 'pcd_acompanhante' ? <Users2 className="w-3.5 h-3.5" /> :
             seat.categoria === 'obeso' ? <Maximize2 className="w-3.5 h-3.5" /> :
             seat.codigo}
          </button>
        );
      })}
    </>
  );
}

function TicketCard({
  type,
  isSelected,
  onSelect,
  quantity,
  onQuantityChange,
  showQuantity,
  promotions,
  globalFees,
  orgSettings
}: {
  type: any;
  isSelected: boolean;
  onSelect: () => void;
  quantity?: number;
  onQuantityChange?: (val: number) => void;
  showQuantity?: boolean;
  promotions: any;
  globalFees: any;
  orgSettings?: any;
}) {
  const breakdown = React.useMemo(() => calculateFinancialBreakdown(type.price, globalFees, promotions, orgSettings), [type.price, globalFees, promotions, orgSettings]);
  const now = new Date();
  
  const batch = type._batch;
  const start = batch?.startDate ? new Date(batch.startDate) : null;
  const end = batch?.endDate ? new Date(batch.endDate) : null;
  
  const isUpcoming = start && now < start;
  const isExpired = end && now > end;
  const isActive = (!start || now >= start) && (!end || now <= end);

  return (
    <Card
      onClick={() => isActive && onSelect()}
      className={cn(
        'border-2 transition-all rounded-[1.5rem] overflow-hidden group relative',
        isActive ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed grayscale-[0.5]',
        isSelected
          ? 'border-secondary bg-secondary/5 shadow-lg shadow-secondary/10'
          : 'border-border hover:border-secondary/30 bg-white'
      )}
    >
      <CardContent className="p-6">
        <div className="flex justify-between items-start gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
               <h4 className="font-black text-lg uppercase italic tracking-tighter text-primary">
                 {type.name}
               </h4>
               {isUpcoming && <Badge variant="outline" className="text-[7px] font-black uppercase text-orange-500 border-orange-200">Em Breve</Badge>}
               {isExpired && <Badge variant="outline" className="text-[7px] font-black uppercase text-muted-foreground border-muted">Encerrado</Badge>}
            </div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              {batch?.name || "Lote Disponível"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black text-primary">{formatCurrency(type.price)}</p>
            <p className="text-[9px] font-bold text-muted-foreground uppercase">
              + {formatCurrency(breakdown.administrativeFeeAmount)} taxa
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function EventoPublicoClient({ id, username }: { id: string, username: string }) {
  const router = useRouter();
  const db = useFirestore();
  const auth = useAuth();
  const { user } = useUser(auth);
  const { addItem, totalCount } = useCart();

  const eventRef = React.useMemo(() => (db ? doc(db, 'events', id) : null), [db, id]);
  const { data: event, loading: eventLoading } = useDoc<any>(eventRef);

  const organizationRef = React.useMemo(() => (db && event?.organizationId) ? doc(db, 'organizations', event.organizationId) : null, [db, event?.organizationId]);
  const { data: organizationProfile } = useDoc<any>(organizationRef);

  const settingsRef = React.useMemo(() => db ? doc(db, "settings", "site") : null, [db]);
  const { data: settings } = useDoc<any>(settingsRef);
  const siteName = settings?.siteName || "Viby";

  const promosRef = React.useMemo(() => (db ? doc(db, 'settings', 'promotions') : null), [db]);
  const { data: promotions } = useDoc<any>(promosRef);

  const feesRef = React.useMemo(() => (db ? doc(db, 'settings', 'fees') : null), [db]);
  const { data: globalFees } = useDoc<any>(feesRef);

  const setoresQuery = useMemoFirebase(() => {
    if (!db || !id) return null;
    return query(collection(db, 'events', id, 'setores'), orderBy('zIndex', 'asc'));
  }, [db, id]);
  const { data: setores } = useCollection<any>(setoresQuery);

  const [selectedSector, setSelectedSector] = React.useState<any>(null);
  const [selectedSeats, setSelectedSeats] = React.useState<Record<string, { seat: any, ticketType: any }>>({});
  const [selectedTicketType, setSelectedTicketType] = React.useState<any>(null);
  const [quantity, setQuantity] = React.useState(1);
  const [now] = React.useState(new Date());

  const allAvailableTickets = React.useMemo(() => {
    if (!event) return [];
    const extractFromBatches = (batchList: any[]) => {
      const all: any[] = [];
      batchList?.forEach(b => {
        if (b.ticketTypes) {
          b.ticketTypes.forEach((t: any) => {
            all.push({ ...t, _batch: b });
          });
        }
      });
      return all;
    };
    if (selectedSector && event.ticketMode === 'sector_batches') {
      const sectorDef = event.sectors?.find((s: any) => s.id === selectedSector.ticketLinkId);
      return sectorDef ? extractFromBatches(sectorDef.batches || []) : [];
    }
    return extractFromBatches(event.batches || []);
  }, [event, selectedSector]);

  const handleToggleSeat = (seat: any) => {
    setSelectedSeats(prev => {
      const next = { ...prev };
      if (next[seat.id]) {
        delete next[seat.id];
      } else {
        const defaultType = allAvailableTickets[0];
        if (!defaultType) return prev;
        next[seat.id] = { seat, ticketType: defaultType };
      }
      return next;
    });
  };

  const handleAddToCart = () => {
    if (!event || !selectedSector) return;
    if (selectedSector.tipo !== 'livre') {
      Object.values(selectedSeats).forEach(({ seat, ticketType }) => {
        addItem({
          id: `${id}_${ticketType._batch.id}_${ticketType.id}_${selectedSector.id}_${seat.id}`,
          eventId: id,
          eventTitle: event.title,
          eventImage: event.image || '',
          eventDate: event.date,
          eventCity: event.city || '',
          organizationId: event.organizationId,
          organizerId: event.organizerId,
          organizerUsername: username,
          ticketTypeId: ticketType.id,
          ticketTypeName: ticketType.name,
          batchId: ticketType._batch.id,
          batchName: ticketType._batch.name,
          price: ticketType.price,
          quantity: 1,
          requiresProof: ticketType.requiresProof || false,
          sectorId: selectedSector.id,
          sectorName: selectedSector.nome,
        });
      });
      setSelectedSeats({});
    } else {
      if (!selectedTicketType) return;
      addItem({
        id: `${id}_${selectedTicketType._batch.id}_${selectedTicketType.id}_${selectedSector.id}`,
        eventId: id,
        eventTitle: event.title,
        eventImage: event.image || '',
        eventDate: event.date,
        eventCity: event.city || '',
        organizationId: event.organizationId,
        organizerId: event.organizerId,
        organizerUsername: username,
        ticketTypeId: selectedTicketType.id,
        ticketTypeName: selectedTicketType.name,
        batchId: selectedTicketType._batch.id,
        batchName: selectedTicketType._batch.name,
        price: selectedTicketType.price,
        quantity,
        requiresProof: selectedTicketType.requiresProof || false,
        sectorId: selectedSector.id,
        sectorName: selectedSector.nome,
      });
      setQuantity(1);
    }
    toast({ title: 'Adicionado ao carrinho!' });
  };

  const totals = React.useMemo(() => {
    let subtotal = 0;
    let fees = 0;
    if (selectedSector?.tipo !== 'livre') {
      Object.values(selectedSeats).forEach(({ ticketType }) => {
        const b = calculateFinancialBreakdown(ticketType.price, globalFees, promotions, organizationProfile);
        subtotal += ticketType.price;
        fees += b.administrativeFeeAmount;
      });
    } else if (selectedTicketType) {
      const b = calculateFinancialBreakdown(selectedTicketType.price, globalFees, promotions, organizationProfile);
      subtotal = selectedTicketType.price * quantity;
      fees = b.administrativeFeeAmount * quantity;
    }
    return { subtotal, fees, total: subtotal + fees };
  }, [selectedSector, selectedSeats, selectedTicketType, quantity, globalFees, promotions, organizationProfile]);

  if (eventLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>;
  if (!event) return null;

  return (
    <div className="min-h-screen bg-background pb-32">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.back()} className="rounded-full"><ArrowLeft className="w-4 h-4" /></Button>
            <Link href="/" className="font-black italic uppercase tracking-tighter text-primary">{siteName}</Link>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="rounded-full relative" asChild>
              <Link href="/dashboard/carrinho">
                <ShoppingCart className="w-4 h-4" />
                {totalCount > 0 && <span className="absolute -top-1 -right-1 bg-secondary text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center">{totalCount}</span>}
              </Link>
            </Button>
          </div>
        </div>
      </nav>

      <main className="pt-16">
        <EventHero event={event} />
        <div className="max-w-7xl mx-auto px-4 py-12 md:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
            <div className="lg:col-span-8 space-y-12">
              <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden p-8">
                  <div className="flex items-center gap-6">
                    <Avatar className="h-20 w-20 border-2 border-secondary/20 p-0.5">
                      <AvatarImage src={organizationProfile?.avatar || event.organizer?.avatar} className="rounded-full object-cover" />
                    </Avatar>
                    <div>
                      <h4 className="font-black text-xl uppercase italic tracking-tighter text-primary">{organizationProfile?.name || event.organizer?.name}</h4>
                    </div>
                  </div>
              </Card>

              <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden p-8">
                <div className="prose prose-slate max-w-none">{renderFormattedText(event.description)}</div>
              </Card>

              <section id="tickets" className="space-y-10">
                <h2 className="text-3xl font-black italic uppercase tracking-tighter">Garanta seu Ingresso</h2>
                {setores && setores.length > 0 && (
                   <VenueMap 
                    event={event}
                    setores={setores}
                    selectedSectorId={selectedSector?.id || null}
                    onSelectSector={setSelectedSector}
                    onToggleSeat={handleToggleSeat}
                    selectedSeatIds={Object.keys(selectedSeats)}
                   />
                )}
              </section>
            </div>

            <aside className="hidden lg:block lg:col-span-4">
              <div className="sticky top-24">
                <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden border-t-8 border-secondary p-8">
                  <h2 className="text-xl font-black italic uppercase tracking-tighter text-primary mb-6">Resumo do Pedido</h2>
                  {(selectedTicketType || Object.keys(selectedSeats).length > 0) ? (
                    <div className="space-y-6">
                      <div className="flex justify-between items-center"><span className="text-lg font-black uppercase italic text-primary">Total</span><span className="text-3xl font-black text-primary">{formatCurrency(totals.total)}</span></div>
                      <Button onClick={handleAddToCart} className="w-full h-16 bg-secondary text-white font-black rounded-2xl shadow-xl uppercase italic text-lg hover:scale-[1.02] transition-transform">Adicionar ao Carrinho</Button>
                    </div>
                  ) : (
                    <div className="py-10 text-center space-y-4 opacity-30"><Ticket className="w-10 h-10 mx-auto" /><p className="text-xs font-black uppercase tracking-widest">Selecione um lugar ou ingresso</p></div>
                  )}
                </Card>
              </div>
            </aside>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
