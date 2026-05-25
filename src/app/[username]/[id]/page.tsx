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
  onSnapshot,
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
  ShieldCheck,
  ChevronRight,
  Armchair,
  Layers,
  Zap,
  Navigation,
  Plus,
  Minus,
  X,
  ShoppingCart,
  Send,
  Accessibility,
  UserCircle,
  Maximize2,
  Megaphone,
  ZoomIn,
  ZoomOut,
  RefreshCcw,
  Hand,
  MousePointer2,
  Map as MapIcon,
  AlertCircle,
  Timer,
  BadgeCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
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

// --- COMPONENTES AUXILIARES ---

function VerifiedBadge() {
  return (
    <BadgeCheck className="w-4 h-4 fill-blue-500 text-white" />
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

/**
 * Componente que renderiza a Planta Visual completa do evento
 */
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
            {/* Toolbar do Mapa */}
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
                  {/* PALCO */}
                  <div 
                    style={{ position: 'absolute', left: 700, top: 50, width: 600, height: 120 }}
                    className="bg-primary text-white flex flex-col items-center justify-center rounded-2xl shadow-2xl border-4 border-white/20 select-none"
                  >
                    <span className="font-black italic uppercase tracking-[0.5em] text-xl">{event.palcoNome || "PALCO PRINCIPAL"}</span>
                  </div>

                  {/* SETORES */}
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

                      {/* Se for o setor selecionado e tiver assentos, renderizamos eles */}
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

      <div className="p-4 bg-white/80 backdrop-blur-md border-t flex flex-wrap justify-center gap-6 px-4 text-center">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-white border-2 border-secondary/20 rounded" />
            <span className="text-[9px] font-black uppercase opacity-60">Livre</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded" />
            <span className="text-[9px] font-black uppercase opacity-60">PCD</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-purple-500 rounded" />
            <span className="text-[9px] font-black uppercase opacity-60">Acompanhante</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-orange-500 rounded" />
            <span className="text-[9px] font-black uppercase opacity-60">Obeso</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded" />
            <span className="text-[9px] font-black uppercase opacity-60">Selecionado</span>
          </div>
        </div>
    </Card>
  );
}

/**
 * Componente interno para renderizar as cadeiras de um setor específico no mapa
 */
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

        {batch && (start || end) && (
          <div className="mt-4 flex items-center gap-4 text-[9px] font-bold text-muted-foreground uppercase tracking-tighter">
             {start && (
               <div className="flex items-center gap-1">
                  <Timer className="w-3 h-3 text-secondary" /> Início: {start.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
               </div>
             )}
             {end && (
               <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-red-400" /> Fim: {end.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
               </div>
             )}
          </div>
        )}

        <div className="mt-6 flex items-center justify-between border-t border-dashed border-border pt-4">
          <div className="flex items-center gap-2">
            {type.requiresProof ? (
              <Badge
                variant="outline"
                className="text-[8px] font-black uppercase border-orange-200 text-orange-600 bg-orange-50"
              >
                Documento Obrigatório
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="text-[8px] font-black uppercase border-green-200 text-green-600 bg-green-50"
              >
                Entrada Rápida
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-4">
             {showQuantity && isSelected && onQuantityChange && isActive && (
                <div className="flex items-center gap-3 bg-white p-1 rounded-lg border shadow-sm" onClick={e => e.stopPropagation()}>
                   <button className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center transition-colors" onClick={() => onQuantityChange(Math.max(1, (quantity || 1) - 1))}>
                      <Minus className="w-3.5 h-3.5" />
                   </button>
                   <span className="font-black text-sm w-4 text-center">{quantity}</span>
                   <button className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center transition-colors" onClick={() => onQuantityChange((quantity || 1) + 1)}>
                      <Plus className="w-3.5 h-3.5" />
                   </button>
                </div>
             )}

             {isActive ? (
               isSelected ? (
                 <div className="bg-secondary text-white rounded-full p-1.5 shadow-md animate-in zoom-in-50">
                   <CheckCircle2 className="w-4 h-4" />
                 </div>
               ) : (
                 <div className="w-6 h-6 rounded-full border-2 border-muted-foreground/20 group-hover:border-secondary/40 transition-colors" />
               )
             ) : (
               <div className="w-6 h-6 rounded-full bg-muted border-2 border-border flex items-center justify-center">
                  <X className="w-3 h-3 text-muted-foreground/40" />
               </div>
             )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function EventoPublicoPage() {
  const params = useParams();
  const router = useRouter();
  const db = useFirestore();
  const auth = useAuth();
  const { user } = useUser(auth);
  const { addItem, totalCount } = useCart();

  const eventId = params.id as string;
  const eventRef = React.useMemo(() => (db ? doc(db, 'events', eventId) : null), [db, eventId]);
  const { data: event, loading: eventLoading } = useDoc<any>(eventRef);

  const organizationRef = React.useMemo(() => (db && event?.organizationId) ? doc(db, 'organizations', event.organizationId) : null, [db, event?.organizationId]);
  const { data: organizationProfile } = useDoc<any>(organizationRef);

  const promosRef = React.useMemo(() => (db ? doc(db, 'settings', 'promotions') : null), [db]);
  const { data: promotions } = useDoc<any>(promosRef);

  const feesRef = React.useMemo(() => (db ? doc(db, 'settings', 'fees') : null), [db]);
  const { data: globalFees } = useDoc<any>(feesRef);

  const setoresQuery = useMemoFirebase(() => {
    if (!db || !eventId) return null;
    return query(collection(db, 'events', eventId, 'setores'), orderBy('zIndex', 'asc'));
  }, [db, eventId]);
  const { data: setores } = useCollection<any>(setoresQuery);

  const partnersQuery = useMemoFirebase(() => {
    if (!db || !eventId) return null;
    return query(collection(db, 'events', eventId, 'partners'), where('status', '==', 'accepted'));
  }, [db, eventId]);
  const { data: partners } = useCollection<any>(partnersQuery);

  const [selectedSector, setSelectedSector] = React.useState<any>(null);
  const [selectedSeats, setSelectedSeats] = React.useState<Record<string, { seat: any, ticketType: any }>>({});
  const [selectedTicketType, setSelectedTicketType] = React.useState<any>(null);
  const [quantity, setQuantity] = React.useState(1);
  const [now] = React.useState(new Date());

  // Denúncia
  const [isReportOpen, setIsReportOpen] = React.useState(false);
  const [reportReason, setReportReason] = React.useState("");
  const [reportDescription, setReportDescription] = React.useState("");
  const [isSubmittingReport, setIsSubmittingReport] = React.useState(false);

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

    if (selectedSector) {
      if (event.ticketMode === 'sector_batches') {
        const sectorDef = event.sectors?.find((s: any) => s.id === selectedSector.ticketLinkId);
        if (!sectorDef) return [];
        return extractFromBatches(sectorDef.batches || []);
      }
      
      if (event.ticketMode === 'batches' || event.ticketMode === 'paid_single') {
        return extractFromBatches(event.batches || []);
      }
    }

    if (event.ticketMode === 'batches' || event.ticketMode === 'paid_single' || event.ticketMode === 'free') {
      return extractFromBatches(event.batches || []);
    }

    return [];
  }, [event, selectedSector]);

  const handleToggleSeat = (seat: any) => {
    setSelectedSeats(prev => {
      const next = { ...prev };
      if (next[seat.id]) {
        delete next[seat.id];
      } else {
        const activeTickets = allAvailableTickets.filter(t => {
           if (!t._batch.startDate || !t._batch.endDate) return true;
           const start = new Date(t._batch.startDate);
           const end = new Date(t._batch.endDate);
           return now >= start && now <= end;
        });

        const defaultType = seat.categoria === 'pcd' 
            ? (activeTickets.find((t: any) => t.isLegalHalf) || activeTickets[0])
            : (activeTickets[0] || allAvailableTickets[0]);

        if (!defaultType) {
           toast({ variant: 'destructive', title: 'Vendas encerradas ou não iniciadas' });
           return prev;
        }

        next[seat.id] = { seat, ticketType: defaultType };
      }
      return next;
    });
  };

  const updateSeatTicketType = (seatId: string, ticketTypeId: string) => {
    const type = allAvailableTickets.find((t: any) => t.id === ticketTypeId);
    if (!type) return;
    setSelectedSeats(prev => ({
      ...prev,
      [seatId]: { ...prev[seatId], ticketType: type }
    }));
  };

  const handleAddToCart = () => {
    if (!event || !selectedSector) return;

    if (selectedSector.tipo !== 'livre') {
      const seatEntries = Object.values(selectedSeats);
      if (seatEntries.length === 0) {
        toast({ variant: 'destructive', title: 'Escolha ao menos um lugar no mapa' });
        return;
      }

      seatEntries.forEach(({ seat, ticketType }) => {
        const batch = ticketType._batch;
        addItem({
          id: `${event.id}_${batch.id}_${ticketType.id}_${selectedSector.id}_${seat.id}`,
          eventId: event.id,
          eventTitle: event.title,
          eventImage: event.image || '',
          eventDate: event.date,
          eventCity: event.city || '',
          organizationId: event.organizationId,
          organizerId: event.organizerId,
          organizerUsername: params.username as string,
          ticketTypeId: ticketType.id,
          ticketTypeName: ticketType.name,
          batchId: batch.id,
          batchName: batch.name,
          price: ticketType.price,
          quantity: 1,
          requiresProof: ticketType.requiresProof || false,
          sectorId: selectedSector.id,
          sectorName: selectedSector.nome,
          poolId: ticketType.poolId,
          poolName: ticketType.poolName,
          // @ts-ignore
          seatId: seat.id,
          // @ts-ignore
          seatCode: seat.codigo,
        });
      });
      setSelectedSeats({});
    } else {
      if (!selectedTicketType) {
        toast({ variant: 'destructive', title: 'Seletione um tipo de ingresso' });
        return;
      }
      const batch = selectedTicketType._batch;
      addItem({
        id: `${event.id}_${batch.id}_${selectedTicketType.id}_${selectedSector.id}_any`,
        eventId: event.id,
        eventTitle: event.title,
        eventImage: event.image || '',
        eventDate: event.date,
        eventCity: event.city || '',
        organizationId: event.organizationId,
        organizerId: event.organizerId,
        organizerUsername: params.username as string,
        ticketTypeId: selectedTicketType.id,
        ticketTypeName: selectedTicketType.name,
        batchId: batch.id,
        batchName: batch.name,
        price: selectedTicketType.price,
        quantity: quantity,
        requiresProof: selectedTicketType.requiresProof || false,
        sectorId: selectedSector.id,
        sectorName: selectedSector.nome,
        poolId: selectedTicketType.poolId,
        poolName: selectedTicketType.poolName,
      });
      setQuantity(1);
    }

    toast({ 
      title: 'Adicionado ao carrinho!',
      action: (
        <ToastAction altText="Ir para o carrinho" onClick={() => router.push('/dashboard/carrinho')}>
          Ir para o Carrinho
        </ToastAction>
      ),
    });
  };

  const handleSendReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !user || !event || !reportReason) return;
    setIsSubmittingReport(true);
    try {
      await addDoc(collection(db, "reports"), {
        type: 'event',
        targetId: event.id,
        targetName: event.title,
        reason: reportReason,
        description: reportDescription,
        reporterId: user.uid,
        reporterName: user.displayName || user.email || "Usuário",
        status: 'Pendente',
        timestamp: serverTimestamp()
      });
      toast({ title: "Denúncia enviada!", description: "Analisaremos o caso em breve." });
      setIsReportOpen(false);
      setReportReason("");
      setReportDescription("");
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao enviar denúncia" });
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const totals = React.useMemo(() => {
    let subtotal = 0;
    let fees = 0;

    if (selectedSector?.tipo !== 'livre') {
      const items = Object.values(selectedSeats);
      items.forEach(({ ticketType }) => {
        const breakdown = calculateFinancialBreakdown(ticketType.price, globalFees, promotions, organizationProfile);
        subtotal += ticketType.price;
        fees += breakdown.administrativeFeeAmount;
      });
    } else if (selectedTicketType) {
      const breakdown = calculateFinancialBreakdown(selectedTicketType.price, globalFees, promotions, organizationProfile);
      subtotal = selectedTicketType.price * quantity;
      fees = breakdown.administrativeFeeAmount * quantity;
    }

    return { subtotal, fees, total: subtotal + fees };
  }, [selectedSector, selectedSeats, selectedTicketType, quantity, globalFees, promotions, organizationProfile]);

  if (eventLoading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-secondary" />
      </div>
    );
  if (!event) return null;

  return (
    <div className="min-h-screen bg-background font-body selection:bg-secondary/20 selection:text-secondary pb-32">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="rounded-full hover:bg-muted font-black text-[10px] uppercase tracking-widest gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full relative"
              asChild
            >
              <Link href="/dashboard/carrinho">
                <ShoppingCart className="w-4 h-4" />
                {totalCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-secondary text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-background">
                    {totalCount}
                  </span>
                )}
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                toast({ title: 'Link copiado!' });
              }}
            >
              <Share2 className="w-4 h-4" />
            </Button>
            {user && (
              <Dialog open={isReportOpen} onOpenChange={setIsReportOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full text-destructive hover:bg-destructive/10">
                    <Flag className="w-4 h-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md rounded-[2rem]">
                  <form onSubmit={handleSendReport} className="space-y-6">
                    <DialogHeader>
                      <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">Denunciar Evento</DialogTitle>
                      <DialogDescription>Relate irregularidades ou suspeitas de fraude.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Motivo</Label>
                        <Select value={reportReason} onValueChange={setReportReason} required>
                          <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Selecione o motivo" /></SelectTrigger>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="Fraude ou Golpe">Fraude ou Golpe</SelectItem>
                            <SelectItem value="Evento Inexistente">Evento Inexistente</SelectItem>
                            <SelectItem value="Conteúdo Impróprio">Conteúdo Impróprio</SelectItem>
                            <SelectItem value="Outro">Outro motivo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Descrição</Label>
                        <Textarea placeholder="Detalhes do ocorrido..." value={reportDescription} onChange={(e) => setReportDescription(e.target.value)} required className="rounded-xl min-h-[120px]" />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={isSubmittingReport} className="w-full bg-destructive text-white font-black h-14 rounded-2xl shadow-xl uppercase italic">
                        {isSubmittingReport ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : "Enviar Denúncia"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </nav>

      <main className="pt-16">
        <EventHero event={event} />

        <div className="max-w-7xl mx-auto px-4 py-12 md:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
            <div className="lg:col-span-8 space-y-12">
              {/* CARD ORGANIZADOR */}
              <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
                <CardContent className="p-8 space-y-10">
                  <div className="flex items-center gap-6">
                    <Avatar className="h-20 w-20 border-2 border-secondary/20 p-0.5 shadow-sm">
                      <AvatarImage src={event.organizer?.avatar} className="rounded-full object-cover" />
                      <AvatarFallback className="font-bold text-2xl">
                        {event.organizer?.name?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-black text-xl uppercase italic tracking-tighter text-primary">
                          {event.organizer?.name}
                        </h4>
                        {event.organizer?.isVerified && <VerifiedBadge />}
                      </div>
                      <Button
                        variant="link"
                        asChild
                        className="p-0 h-auto text-[10px] font-black uppercase text-secondary tracking-widest"
                      >
                        <Link href={`/${event.organizer?.username}`}>
                          Acessar Perfil Completo <ArrowRight className="w-3 h-3 ml-1" />
                        </Link>
                      </Button>
                    </div>
                  </div>

                  {partners && partners.length > 0 && (
                    <div className="space-y-4 pt-6 border-t border-dashed">
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 px-1">
                        Co-realização
                      </p>
                      <div className="flex flex-wrap gap-4">
                        {partners.map((p: any) => (
                          <Link
                            key={p.id}
                            href={`/${p.username}`}
                            className="flex items-center gap-2 bg-muted/30 p-2 pr-4 rounded-full hover:bg-muted transition-colors border shadow-sm"
                          >
                            <Avatar className="h-8 w-8 border border-white">
                              <AvatarImage src={p.avatar} />
                              <AvatarFallback className="text-[10px] font-bold">
                                {p.orgName?.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-[10px] font-black uppercase tracking-tight">
                              {p.orgName}
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* CARD DESCRIÇÃO */}
              <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
                <CardHeader className="bg-muted/30 pb-6 p-8 border-b">
                   <CardTitle className="text-[11px] font-black uppercase tracking-[0.3em] text-secondary flex items-center gap-3">
                    <Info className="w-4 h-4" /> Sobre a Experiência
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-8">
                  <div className="text-muted-foreground font-medium text-lg leading-relaxed whitespace-pre-line prose prose-slate max-w-none">
                    {renderFormattedText(event.description)}
                  </div>
                </CardContent>
              </Card>

              {/* CARD LOCALIZAÇÃO */}
              <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
                <CardHeader className="bg-muted/30 pb-6 p-8 border-b">
                   <CardTitle className="text-[11px] font-black uppercase tracking-[0.3em] text-secondary flex items-center gap-3">
                    <MapPin className="w-4 h-4" /> Localização
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-8 space-y-8">
                  <div className="space-y-1">
                    <p className="text-2xl font-black italic tracking-tighter uppercase text-primary">
                      {event.address?.street}, {event.address?.number}
                    </p>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                      {event.address?.neighborhood}, {event.city} - {event.address?.state}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <Button variant="outline" className="h-12 rounded-xl font-bold gap-2 border-secondary/20 text-secondary hover:bg-secondary hover:text-white transition-all shadow-sm" asChild>
                        <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${event.address?.street}, ${event.address?.number} - ${event.city}`)}`} target="_blank">
                           <Navigation className="w-4 h-4" /> Abrir no Google Maps
                        </a>
                     </Button>
                     <Button variant="outline" className="h-12 rounded-xl font-bold gap-2 border-secondary/20 text-secondary hover:bg-secondary hover:text-white transition-all shadow-sm" asChild>
                        <a href={`https://waze.com/ul?q=${encodeURIComponent(`${event.address?.street}, ${event.address?.number} - ${event.city}`)}`} target="_blank">
                           <div className="w-4 h-4 bg-[#33CCFF] rounded-full flex items-center justify-center text-[10px] text-white font-black italic">W</div> Abrir no Waze
                        </a>
                     </Button>
                  </div>

                  <div className="overflow-hidden border-none shadow-inner rounded-[1.5rem] bg-muted aspect-video relative ring-1 ring-border/40">
                     <iframe
                      width="100%"
                      height="100%"
                      style={{ border: 0 }}
                      loading="lazy"
                      allowFullScreen
                      src={`https://www.google.com/maps/embed/v1/place?key=AIzaSyDWOoEhxGwwTzEuCx5ire2ZaddlH3X4Vcw&q=${encodeURIComponent(`${event.address?.street}, ${event.address?.number} - ${event.city}`)}`}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* BILHETERIA */}
              <section id="tickets" className="space-y-10">
                <div className="space-y-2">
                  <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-secondary">
                    Bilheteria
                  </h2>
                  <p className="text-3xl font-black italic uppercase tracking-tighter">
                    Garanta seu Ingresso
                  </p>
                </div>

                {!setores || setores.length === 0 ? (
                  <div className="py-20 text-center bg-muted/20 rounded-[3rem] border-2 border-dashed">
                    <Ticket className="w-12 h-12 mx-auto text-muted-foreground opacity-20 mb-4" />
                    <p className="text-muted-foreground font-black uppercase tracking-widest text-[10px]">
                      Ingressos indisponíveis no momento.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-12">
                    {/* PLANTA VISUAL DO EVENTO */}
                    <div className="space-y-6">
                      <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <MapIcon className="w-4 h-4 text-secondary" /> Planta Visual
                      </h3>
                      <VenueMap 
                        event={event}
                        setores={setores}
                        selectedSectorId={selectedSector?.id || null}
                        onSelectSector={(s) => {
                          setSelectedSector(s);
                          setSelectedSeats({});
                          setSelectedTicketType(null);
                          setQuantity(1);
                        }}
                        onToggleSeat={handleToggleSeat}
                        selectedSeatIds={Object.keys(selectedSeats)}
                      />
                    </div>

                    <div className="space-y-6">
                      <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <Layers className="w-4 h-4" /> 1. Escolha o Setor
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {setores.map((setor: any) => (
                          <Card
                            key={setor.id}
                            onClick={() => {
                              setSelectedSector(setor);
                              setSelectedSeats({});
                              setSelectedTicketType(null);
                              setQuantity(1);
                            }}
                            className={cn(
                              'cursor-pointer border-2 transition-all rounded-2xl p-6',
                              selectedSector?.id === setor.id
                                ? 'border-secondary bg-secondary/5'
                                : 'border-border hover:border-secondary/20 shadow-sm bg-white'
                            )}
                          >
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-4">
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: setor.cor }}
                                />
                                <span className="font-black text-sm uppercase italic tracking-tighter text-primary">
                                  {setor.nome}
                                </span>
                              </div>
                              <Badge variant="outline" className="text-[8px] font-bold uppercase text-muted-foreground">
                                {setor.tipo}
                              </Badge>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>

                    {selectedSector && (
                      <div className="space-y-8 animate-in slide-in-from-top-4 duration-500 pt-4">
                        {selectedSector.tipo !== 'livre' ? (
                          <div className="space-y-10">
                            {Object.keys(selectedSeats).length > 0 && (
                              <div className="space-y-6 animate-in zoom-in-95 duration-300">
                                 <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                    <Ticket className="w-4 h-4" /> 2. Atribua os Ingressos
                                 </h3>
                                 <div className="grid grid-cols-1 gap-4">
                                    {Object.values(selectedSeats).map(({ seat, ticketType }) => {
                                      const validOptions = seat.categoria === 'pcd'
                                        ? allAvailableTickets.filter((t: any) => t.isLegalHalf)
                                        : allAvailableTickets;

                                      return (
                                        <Card key={seat.id} className="border-none shadow-sm rounded-2xl p-6 bg-white flex flex-col sm:flex-row items-center justify-between gap-6 group hover:border-secondary/20 border transition-all">
                                           <div className="flex items-center gap-4">
                                              <div className={cn(
                                                  "w-12 h-12 rounded-xl flex items-center justify-center font-black shadow-inner",
                                                  seat.categoria === 'pcd' ? "bg-blue-100 text-blue-600" :
                                                  seat.categoria === 'pcd_acompanhante' ? "bg-purple-100 text-purple-600" :
                                                  seat.categoria === 'obeso' ? "bg-orange-100 text-orange-600" :
                                                  "bg-secondary/10 text-secondary"
                                              )}>
                                                 {seat.categoria === 'pcd' ? <Accessibility className="w-6 h-6" /> : 
                                                  seat.categoria === 'pcd_acompanhante' ? <Users2 className="w-6 h-6" /> :
                                                  seat.categoria === 'obeso' ? <Maximize2 className="w-6 h-6" /> :
                                                  seat.codigo}
                                              </div>
                                              <div>
                                                 <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">
                                                    {seat.categoria === 'pcd' ? "Assento PCD" : 
                                                     seat.categoria === 'pcd_acompanhante' ? "Acompanhante PCD" : 
                                                     seat.categoria === 'obeso' ? "Assento Obeso" :
                                                     "Assento Selecionado"}
                                                 </p>
                                                 <p className="font-bold text-sm uppercase italic tracking-tight text-primary">{selectedSector.nome}</p>
                                              </div>
                                           </div>

                                           <div className="w-full sm:w-64">
                                              <Select value={ticketType?.id || ""} onValueChange={(val) => updateSeatTicketType(seat.id, val)}>
                                                 <SelectTrigger className="rounded-xl h-11 border-secondary/20">
                                                    <SelectValue placeholder="Tipo de ingresso" />
                                                 </SelectTrigger>
                                                 <SelectContent className="rounded-xl">
                                                    {validOptions.map((t: any) => {
                                                      const isInactive = t._batch.startDate && new Date(t._batch.startDate) > now;
                                                      return (
                                                        <SelectItem key={t.id} value={t.id} disabled={isInactive} className="font-bold uppercase text-[10px]">
                                                           {t.name} - {formatCurrency(t.price)} {isInactive && "(EM BREVE)"}
                                                        </SelectItem>
                                                      );
                                                    })}
                                                 </SelectContent>
                                              </Select>
                                              {seat.categoria === 'pcd' && (
                                                <p className="text-[8px] font-black text-blue-600 uppercase mt-1.5 ml-1">Restrito a Meia-Entrada PCD</p>
                                              )}
                                           </div>

                                           <button onClick={() => handleToggleSeat(seat)} className="text-muted-foreground/30 hover:text-destructive transition-colors">
                                              <X className="w-5 h-5" />
                                           </button>
                                        </Card>
                                      );
                                    })}
                                 </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-6">
                            <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                              <Ticket className="w-4 h-4" /> 2. Escolha o Ingresso
                            </h3>
                            <div className="grid grid-cols-1 gap-4">
                              {allAvailableTickets.map((type: any) => (
                                <TicketCard
                                  key={type.id}
                                  type={type}
                                  isSelected={selectedTicketType?.id === type.id}
                                  onSelect={() => setSelectedTicketType(type)}
                                  showQuantity
                                  quantity={quantity}
                                  onQuantityChange={setQuantity}
                                  promotions={promotions}
                                  globalFees={globalFees}
                                  orgSettings={organizationProfile}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </section>
            </div>

            <aside className="hidden lg:block lg:col-span-4">
              <div className="sticky top-24">
                <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden border-t-8 border-secondary">
                  <div className="p-8 pb-4">
                    <h2 className="text-xl font-black italic uppercase tracking-tighter text-primary">Resumo do Pedido</h2>
                  </div>
                  <CardContent className="space-y-6">
                    {(selectedTicketType || Object.keys(selectedSeats).length > 0) ? (
                      <div className="space-y-6 animate-in fade-in">
                        <div className="space-y-3">
                           {selectedSector?.tipo === 'livre' ? (
                             <Card className="border-none bg-muted/30 rounded-2xl border-dashed">
                               <CardContent className="p-4 space-y-2">
                                  <div className="flex justify-between font-black text-sm uppercase italic">
                                     <span className="text-primary">{selectedTicketType.name} {quantity > 1 && `x ${quantity}`}</span>
                                     <span className="text-primary">{formatCurrency(selectedTicketType.price * quantity)}</span>
                                  </div>
                                  <div className="text-[10px] font-bold text-secondary uppercase tracking-widest">
                                     Setor: {selectedSector.nome}
                                  </div>
                               </CardContent>
                             </Card>
                           ) : (
                             Object.values(selectedSeats).map(({ seat, ticketType }) => (
                               <Card key={seat.id} className="border-none bg-muted/30 rounded-2xl border-dashed">
                                 <CardContent className="p-4 space-y-1">
                                    <div className="flex justify-between font-black text-[10px] uppercase italic text-primary">
                                       <span>{ticketType?.name || "Ingresso"} - Lug. {seat.codigo}</span>
                                       <span>{formatCurrency(ticketType?.price || 0)}</span>
                                    </div>
                                 </CardContent>
                               </Card>
                             ))
                           )}
                        </div>

                        <div className="space-y-2 text-[10px] font-bold uppercase opacity-60">
                          <div className="flex justify-between">
                            <span>Subtotal</span>
                            <span>{formatCurrency(totals.subtotal)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Taxa de Serviço</span>
                            <span>{formatCurrency(totals.fees)}</span>
                          </div>
                        </div>

                        <Separator className="border-dashed" />

                        <div className="flex justify-between items-center">
                          <span className="text-lg font-black uppercase italic text-primary">Total</span>
                          <span className="text-3xl font-black text-primary">
                            {formatCurrency(totals.total)}
                          </span>
                        </div>

                        <Button
                          onClick={handleAddToCart}
                          className="w-full h-16 bg-secondary text-white font-black rounded-2xl shadow-xl uppercase italic text-lg hover:scale-[1.02] transition-transform"
                        >
                          Adicionar ao Carrinho
                        </Button>
                      </div>
                    ) : (
                      <div className="py-10 text-center space-y-4 opacity-30">
                        <Ticket className="w-10 h-10 mx-auto" />
                        <p className="text-xs font-black uppercase tracking-widest">Selecione um lugar ou ingresso</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </aside>
          </div>
        </div>
      </main>

      {/* BILHETERIA MOBILE */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl border-t border-border/40 p-4 shadow-2xl">
        <div className="max-w-xl mx-auto flex items-center justify-between gap-4">
          <div className="flex flex-col">
            <p className="text-[10px] font-black uppercase opacity-40">Total do Pedido</p>
            <p className="text-xl font-black text-primary">
              {totals.total > 0 ? formatCurrency(totals.total) : '---'}
            </p>
          </div>
          <Button
            disabled={totals.total === 0}
            onClick={handleAddToCart}
            className="bg-secondary text-white font-black px-8 h-12 rounded-xl shadow-lg uppercase italic text-xs grow sm:grow-0"
          >
            Continuar
          </Button>
        </div>
      </div>
    </div>
  );
}
