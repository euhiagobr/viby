
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
  BadgeCheck,
  Armchair,
  Sparkles,
  ShieldCheck,
  Grid3X3
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
        <strong key={i} className="font-black text-primary">
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
      <div className="relative h-[50vh] md:h-[70vh] w-full overflow-hidden">
        <Image
          src={event.image || 'https://picsum.photos/seed/event/1200/800'}
          alt={event.title}
          fill
          className='object-cover'
          priority
          unoptimized
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
      </div>

      <div className="max-w-7xl mx-auto px-4 -mt-40 relative z-10 space-y-6">
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

        <h1 className="text-5xl md:text-8xl font-black text-foreground tracking-tighter uppercase italic leading-[0.8] drop-shadow-2xl">
          {event.title}
        </h1>

        <div className="flex flex-wrap items-center gap-8 text-muted-foreground font-black text-xs uppercase tracking-widest bg-white/10 backdrop-blur-md p-6 rounded-[2rem] w-fit shadow-2xl">
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
  const [isPanningEnabled, setIsPanningEnabled] = React.useState(false);

  return (
    <Card className="border-none shadow-2xl rounded-[3rem] bg-white overflow-hidden relative group p-1">
      <div className="bg-muted/50 p-6 flex items-center justify-between border-b border-border/40">
         <div className="flex items-center gap-3">
            <div className="p-2 bg-secondary/10 rounded-lg text-secondary">
               <MapIcon className="w-5 h-5" />
            </div>
            <div>
               <h3 className="font-black uppercase italic tracking-tighter">Planta do Local</h3>
               <p className="text-[10px] font-bold text-muted-foreground uppercase">Clique em um setor para ver as opções.</p>
            </div>
         </div>
      </div>

      <TransformWrapper 
        initialScale={0.8} 
        minScale={0.1} 
        maxScale={3} 
        centerOnInit
        limitToBounds={false}
        panning={{ disabled: !isPanningEnabled }}
      >
        {({ zoomIn, zoomOut, resetTransform }) => (
          <>
            <div className="absolute bottom-6 left-6 z-30 flex gap-2 bg-white/90 backdrop-blur-md p-2 rounded-2xl shadow-2xl border border-border opacity-0 group-hover:opacity-100 transition-opacity">
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={() => zoomIn()}><ZoomIn className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={() => zoomOut()}><ZoomOut className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={() => resetTransform()}><RefreshCcw className="w-4 h-4" /></Button>
              <Separator orientation="vertical" className="h-9" />
              <Button 
                variant={isPanningEnabled ? 'secondary' : 'ghost'} 
                size="icon" 
                className={cn("h-9 w-9 rounded-xl", isPanningEnabled ? "bg-secondary text-white shadow-lg" : "text-muted-foreground")}
                onClick={() => setIsPanningEnabled(!isPanningEnabled)}
              >
                 {isPanningEnabled ? <Hand className="w-4 h-4" /> : <MousePointer2 className="w-4 h-4" />}
              </Button>
            </div>

            <TransformComponent wrapperStyle={{ width: '100%', height: '600px' }}>
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
                        "border-4 transition-all rounded-[2.5rem] flex flex-col items-center justify-center cursor-pointer",
                        selectedSectorId === s.id ? "bg-white shadow-2xl ring-8 ring-secondary/20 z-20 scale-[1.02]" : "bg-white/40 hover:bg-white/60 shadow-xl z-10"
                      )}
                      onClick={(e) => { e.stopPropagation(); if(!isPanningEnabled) onSelectSector(s); }}
                    >
                      <div className="absolute -top-12 left-0 flex items-center gap-2">
                        <Badge style={{ backgroundColor: s.cor }} className="text-[10px] font-black uppercase text-white shadow-xl px-4 py-1 rounded-full">{s.nome}</Badge>
                        {selectedSectorId === s.id && <Badge variant="secondary" className="animate-pulse text-[8px] uppercase font-black">Selecionado</Badge>}
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
                        <div className="flex flex-col items-center gap-2 opacity-60 select-none group-hover:opacity-100 transition-opacity">
                           {s.tipo === 'assentos' ? <Armchair className="w-8 h-8 text-primary" /> : s.tipo === 'mesas' ? <Grid3X3 className="w-8 h-8 text-primary" /> : <Layers className="w-8 h-8 text-primary" />}
                           <h4 className="font-black uppercase italic text-sm">{s.nome}</h4>
                           <p className="text-[10px] font-black bg-muted px-3 py-1 rounded-full">{s.capacidade} LUGARES {s.tipo.toUpperCase()}</p>
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

  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-secondary" /></div>;

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
                width: '36px',
                height: '36px'
            }}
            className={cn(
              'rounded-xl flex items-center justify-center text-[10px] font-black transition-all border-2 shadow-sm',
              isSold
                ? 'bg-muted text-muted-foreground/30 cursor-not-allowed border-muted-foreground/10'
                : isSelected
                  ? 'bg-green-500 text-white scale-110 shadow-2xl ring-4 ring-green-500/30 border-green-600 z-30'
                  : seat.categoria === 'pcd'
                    ? 'bg-blue-50 border-blue-500 text-blue-600'
                    : seat.categoria === 'pcd_acompanhante'
                       ? 'bg-purple-50 border-purple-500 text-purple-600'
                       : seat.categoria === 'obeso'
                          ? 'bg-orange-50 border-orange-500 text-orange-600'
                          : 'bg-white border-secondary/30 text-secondary hover:border-secondary hover:bg-secondary/5'
            )}
          >
            {seat.categoria === 'pcd' ? <Accessibility className="w-4 h-4" /> : 
             seat.categoria === 'pcd_acompanhante' ? <Users2 className="w-4 h-4" /> :
             seat.categoria === 'obeso' ? <Maximize2 className="w-4 h-4" /> :
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
        'border-2 transition-all rounded-[2rem] overflow-hidden group relative',
        isActive ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed grayscale-[0.5]',
        isSelected
          ? 'border-secondary bg-secondary/5 shadow-2xl ring-4 ring-secondary/10'
          : 'border-border hover:border-secondary/40 bg-white hover:shadow-md'
      )}
    >
      <CardContent className="p-8">
        <div className="flex justify-between items-center gap-6">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-3">
               <h4 className="font-black text-xl uppercase italic tracking-tighter text-primary">
                 {type.name}
               </h4>
               {isUpcoming && <Badge variant="outline" className="text-[8px] font-black uppercase text-orange-500 border-orange-200 bg-orange-50">Em Breve</Badge>}
               {isExpired && <Badge variant="outline" className="text-[8px] font-black uppercase text-muted-foreground border-muted">Encerrado</Badge>}
               {isActive && <Badge className="bg-green-500 text-white text-[8px] font-black uppercase">Disponível</Badge>}
            </div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <Ticket className="w-3.5 h-3.5 text-secondary" /> {batch?.name || "Lote Disponível"}
            </p>
            {type.description && <p className="text-[11px] text-muted-foreground italic line-clamp-1">{type.description}</p>}
          </div>

          <div className="flex items-center gap-8">
             {showQuantity && isSelected && (
                <div className="flex items-center gap-4 bg-muted/40 p-2 rounded-2xl" onClick={e => e.stopPropagation()}>
                   <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={() => onQuantityChange?.(Math.max(1, (quantity || 1) - 1))}><Minus className="w-4 h-4" /></Button>
                   <span className="font-black text-lg w-6 text-center">{quantity}</span>
                   <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={() => onQuantityChange?.((quantity || 1) + 1)}><Plus className="w-4 h-4" /></Button>
                </div>
             )}

             <div className="text-right shrink-0">
               <p className="text-3xl font-black text-primary">{formatCurrency(type.price)}</p>
               <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-1">
                 + {formatCurrency(breakdown.administrativeFeeAmount)} taxa viby
               </p>
             </div>
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
    if (!event) return;
    
    if (selectedSector && selectedSector.tipo !== 'livre') {
      if (Object.keys(selectedSeats).length === 0) {
        toast({ variant: "destructive", title: "Selecione um lugar primeiro." });
        return;
      }
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
          seatId: seat.id,
          seatCode: seat.codigo
        });
      });
      setSelectedSeats({});
      setSelectedSector(null);
    } else {
      if (!selectedTicketType) {
        toast({ variant: "destructive", title: "Selecione um tipo de ingresso." });
        return;
      }
      addItem({
        id: `${id}_${selectedTicketType._batch.id}_${selectedTicketType.id}${selectedSector ? `_${selectedSector.id}` : ''}`,
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
        sectorId: selectedSector?.id || null,
        sectorName: selectedSector?.nome || null,
      });
      setQuantity(1);
      setSelectedTicketType(null);
    }
    toast({ title: 'Adicionado ao carrinho!' });
  };

  const totals = React.useMemo(() => {
    let subtotal = 0;
    let fees = 0;
    if (selectedSector?.tipo !== 'livre' && selectedSector) {
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
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-2xl border-b border-border/40">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full hover:bg-muted"><ArrowLeft className="w-5 h-5" /></Button>
            <Link href="/" className="flex items-center gap-2">
              <span className="font-black italic uppercase tracking-tighter text-2xl text-primary">{siteName}</span>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" className="rounded-full relative border-2" asChild>
              <Link href="/dashboard/carrinho">
                <ShoppingCart className="w-5 h-5" />
                {totalCount > 0 && <span className="absolute -top-2 -right-2 bg-secondary text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-lg border-2 border-white">{totalCount}</span>}
              </Link>
            </Button>
            {user ? (
               <Avatar className="h-10 w-10 border-2 border-secondary shadow-sm">
                 <AvatarImage src={user.photoURL || ""} />
                 <AvatarFallback>{user.displayName?.charAt(0)}</AvatarFallback>
               </Avatar>
            ) : (
              <Button asChild className="bg-primary text-white font-black uppercase text-[10px] italic rounded-full px-6 shadow-lg shadow-primary/10">
                <Link href="/login">Entrar</Link>
              </Button>
            )}
          </div>
        </div>
      </nav>

      <main className="pt-20">
        <EventHero event={event} />
        <div className="max-w-7xl mx-auto px-4 py-16 md:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
            <div className="lg:col-span-8 space-y-16">
              {/* ORGANIZADOR CARD */}
              <Card className="border-none shadow-sm rounded-[3rem] bg-white overflow-hidden p-8 hover:shadow-xl transition-shadow group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-8">
                      <Avatar className="h-24 w-24 border-4 border-secondary/10 p-0.5 group-hover:scale-110 transition-transform">
                        <AvatarImage src={organizationProfile?.avatar || event.organizer?.avatar} className="rounded-full object-cover" />
                        <AvatarFallback className="text-2xl font-black bg-muted">{organizationProfile?.name?.charAt(0) || 'O'}</AvatarFallback>
                      </Avatar>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em]">Realização</p>
                        <div className="flex items-center gap-2">
                           <h4 className="font-black text-2xl uppercase italic tracking-tighter text-primary">{organizationProfile?.name || event.organizer?.name}</h4>
                           {(organizationProfile?.verified || event.organizer?.isVerified) && <VerifiedBadge />}
                        </div>
                        <Link href={`/${organizationProfile?.username || event.organizer?.username}`} className="text-xs font-black text-secondary uppercase hover:underline">Ver Perfil da Marca</Link>
                      </div>
                    </div>
                    <Button variant="outline" className="rounded-xl h-12 px-6 font-bold gap-2 hidden md:flex"><Users2 className="w-4 h-4" /> Seguir Marca</Button>
                  </div>
              </Card>

              {/* DESCRIÇÃO CARD */}
              <Card className="border-none shadow-sm rounded-[3rem] bg-white overflow-hidden p-10 relative">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                   <Info className="w-32 h-32 text-primary" />
                </div>
                <h3 className="text-xl font-black uppercase italic tracking-tighter mb-8 flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-secondary" /> Informações do Evento
                </h3>
                <div className="prose prose-slate max-w-none prose-lg text-foreground/80 leading-relaxed font-medium">
                  {renderFormattedText(event.description)}
                </div>
              </Card>

              {/* TICKETS SECTION */}
              <section id="tickets" className="space-y-10">
                <div className="flex flex-col gap-2">
                   <h2 className="text-4xl font-black italic uppercase tracking-tighter text-primary">Ingressos & Mapa</h2>
                   <p className="text-muted-foreground font-medium">Selecione a área desejada e escolha seus ingressos.</p>
                </div>

                {setores && setores.length > 0 ? (
                  <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
                    <VenueMap 
                      event={event}
                      setores={setores}
                      selectedSectorId={selectedSector?.id || null}
                      onSelectSector={(s) => { setSelectedSector(s); setSelectedTicketType(null); }}
                      onToggleSeat={handleToggleSeat}
                      selectedSeatIds={Object.keys(selectedSeats)}
                    />

                    {selectedSector && (
                      <div className="space-y-6 pt-6 animate-in zoom-in-95 duration-300">
                         <div className="flex items-center justify-between px-2">
                            <div className="flex items-center gap-3">
                               <Badge style={{ backgroundColor: selectedSector.cor }} className="text-white px-4 py-1.5 rounded-full font-black uppercase text-[10px]">{selectedSector.nome}</Badge>
                               <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{selectedSector.tipo === 'livre' ? 'Entrada Livre' : 'Lugares Marcados'}</span>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => { setSelectedSector(null); setSelectedTicketType(null); }} className="rounded-full text-[10px] font-black uppercase gap-2"><X className="w-4 h-4" /> Cancelar Seleção</Button>
                         </div>

                         {selectedSector.tipo === 'livre' ? (
                            <div className="grid gap-4">
                               {allAvailableTickets.map((type: any) => (
                                 <TicketCard 
                                   key={type.id}
                                   type={type}
                                   isSelected={selectedTicketType?.id === type.id}
                                   onSelect={() => setSelectedTicketType(type)}
                                   quantity={quantity}
                                   onQuantityChange={setQuantity}
                                   showQuantity={true}
                                   promotions={promotions}
                                   globalFees={globalFees}
                                   orgSettings={organizationProfile}
                                 />
                               ))}
                            </div>
                         ) : (
                            <div className="grid gap-4">
                               {Object.values(selectedSeats).map(({ seat, ticketType }) => (
                                  <div key={seat.id} className="p-6 bg-secondary/5 rounded-3xl border-2 border-secondary/20 flex items-center justify-between gap-4">
                                     <div className="flex items-center gap-4">
                                        <div className="p-3 bg-secondary rounded-2xl text-white">
                                           <Armchair className="w-6 h-6" />
                                        </div>
                                        <div>
                                           <p className="text-[9px] font-black uppercase text-secondary">Lugar Selecionado</p>
                                           <p className="font-black text-xl italic uppercase text-primary">{seat.codigo} • {selectedSector.nome}</p>
                                        </div>
                                     </div>
                                     <div className="text-right">
                                        <p className="text-[9px] font-bold text-muted-foreground uppercase">{ticketType.name}</p>
                                        <p className="font-black text-xl">{formatCurrency(ticketType.price)}</p>
                                     </div>
                                  </div>
                               ))}
                               {Object.keys(selectedSeats).length === 0 && (
                                 <div className="py-12 text-center bg-muted/20 rounded-[2rem] border-2 border-dashed border-border/40">
                                    <p className="text-sm font-bold text-muted-foreground uppercase italic">Toque em uma cadeira no mapa para selecionar.</p>
                                 </div>
                               )}
                            </div>
                         )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
                     {allAvailableTickets.map((type: any) => (
                       <TicketCard 
                        key={type.id}
                        type={type}
                        isSelected={selectedTicketType?.id === type.id}
                        onSelect={() => setSelectedTicketType(type)}
                        quantity={quantity}
                        onQuantityChange={setQuantity}
                        showQuantity={true}
                        promotions={promotions}
                        globalFees={globalFees}
                        orgSettings={organizationProfile}
                       />
                     ))}
                  </div>
                )}
              </section>
            </div>

            {/* SIDEBAR RESUMO */}
            <aside className="hidden lg:block lg:col-span-4">
              <div className="sticky top-28 space-y-8">
                <Card className="border-none shadow-2xl rounded-[3rem] bg-white overflow-hidden border-t-8 border-secondary p-8 flex flex-col gap-8">
                  <h2 className="text-2xl font-black italic uppercase tracking-tighter text-primary flex items-center gap-3">
                    <ShoppingCart className="w-6 h-6 text-secondary" /> Pedido
                  </h2>

                  {(selectedTicketType || Object.keys(selectedSeats).length > 0) ? (
                    <div className="space-y-8 animate-in zoom-in-95 duration-300">
                      <div className="space-y-4">
                         <div className="flex justify-between text-xs font-bold uppercase opacity-60">
                           <span>Subtotal</span>
                           <span>{formatCurrency(totals.subtotal)}</span>
                         </div>
                         <div className="flex justify-between text-xs font-bold uppercase opacity-60">
                           <span>Taxas Service</span>
                           <span>{formatCurrency(totals.fees)}</span>
                         </div>
                         <Separator className="border-dashed" />
                         <div className="flex justify-between items-center">
                           <span className="text-xl font-black uppercase italic text-primary">Total</span>
                           <span className="text-3xl font-black text-primary">{formatCurrency(totals.total)}</span>
                         </div>
                      </div>

                      <Button 
                        onClick={handleAddToCart} 
                        className="w-full h-20 bg-secondary text-white font-black rounded-3xl shadow-xl shadow-secondary/20 uppercase italic text-xl hover:scale-[1.02] transition-all group"
                      >
                         Adicionar ao Carrinho
                         <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                      </Button>

                      <div className="p-4 bg-muted/30 rounded-2xl flex gap-3">
                         <Timer className="w-4 h-4 text-secondary shrink-0 mt-1" />
                         <p className="text-[10px] font-bold text-muted-foreground leading-tight uppercase">Após adicionar, o item ficará reservado por 15 minutos até a conclusão do pagamento.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="py-20 text-center space-y-6 opacity-30">
                       <Ticket className="w-16 h-16 mx-auto text-secondary" />
                       <p className="text-xs font-black uppercase tracking-[0.2em] max-w-[150px] mx-auto">Selecione um lugar ou ingresso no catálogo ao lado.</p>
                    </div>
                  )}
                </Card>

                {/* INFO EXTRA */}
                <div className="p-8 bg-primary text-white rounded-[3rem] shadow-xl space-y-6 relative overflow-hidden">
                   <h4 className="text-[10px] font-black uppercase tracking-widest text-secondary flex items-center gap-2">
                     <ShieldCheck className="w-4 h-4" /> Compra Segura Viby
                   </h4>
                   <p className="text-xs font-medium opacity-80 leading-relaxed">
                     Seus dados e pagamentos são protegidos por criptografia de ponta a ponta via Stripe. Receba seu voucher oficial instantaneamente após a confirmação.
                   </p>
                   <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-secondary/10 rounded-full blur-3xl" />
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
