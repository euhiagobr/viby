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
  Layers,
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
  Grid3X3,
  AlertTriangle,
  ChevronDown,
  Navigation,
  Lock,
  ShieldAlert
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AgeRatingBadge, AgeRatingWarning } from '@/lib/age-rating';
import { UserNav } from '@/components/layout/UserNav';

// --- COMPONENTES AUXILIARES ---

function VerifiedBadge() {
  return (
    <BadgeCheck className="w-5 h-5 fill-blue-500 text-white" />
  );
}

const renderInlineStyles = (text: string) => {
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
          onClick={e => e.stopPropagation()}
        >
          {part}
        </Link>
      );
    if (part.startsWith('+') && part.endsWith('+')) {
       return (
         <span key={i} className="text-4xl font-black uppercase italic tracking-tighter text-primary inline-block my-2 leading-none">
           {part.slice(1, -1)}
         </span>
       );
    }
    return part;
  });
};

const renderFormattedText = (text: string) => {
  if (!text) return '';
  
  return text.split(/\n\n+/).map((block, bIdx) => {
    const trimmed = block.trim();
    if (!trimmed) return null;

    if (trimmed.startsWith('# ')) {
      return (
        <h2 key={bIdx} className="text-5xl md:text-6xl font-black uppercase italic tracking-tighter mb-6 mt-4 text-primary leading-[0.9] drop-shadow-sm">
          {renderInlineStyles(trimmed.replace('# ', ''))}
        </h2>
      );
    }
    
    if (trimmed.startsWith('## ')) {
      return (
        <h3 key={bIdx} className="text-3xl md:text-4xl font-black uppercase italic tracking-tighter mb-4 mt-2 text-primary leading-[1]">
          {renderInlineStyles(trimmed.replace('## ', ''))}
        </h3>
      );
    }
    
    const lines = trimmed.split('\n');
    return (
      <p key={bIdx} className="mb-6 last:mb-0 leading-relaxed text-lg md:text-xl font-medium text-foreground/80">
        {lines.map((line, lIdx) => (
          <React.Fragment key={lIdx}>
            {renderInlineStyles(line)}
            {lIdx < lines.length - 1 && <br />}
          </React.Fragment>
        ))}
      </p>
    );
  }).filter(Boolean);
};

function ReportDialog({ eventId, eventTitle }: { eventId: string, eventTitle: string }) {
  const db = useFirestore();
  const auth = useAuth();
  const { user } = useUser(auth);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!db) return;
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    
    try {
      await addDoc(collection(db, "reports"), {
        targetId: eventId,
        targetName: eventTitle,
        type: 'event',
        reason: formData.get("reason"),
        description: formData.get("description"),
        reporterId: user?.uid || 'anonymous',
        reporterName: user?.displayName || 'Anônimo',
        status: 'Pendente',
        timestamp: serverTimestamp()
      });
      toast({ title: "Denúncia enviada", description: "Nossa equipe analisará o caso em até 24h." });
      setOpen(false);
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao enviar" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="rounded-xl hover:bg-red-50 hover:text-red-500 transition-colors gap-2 font-black uppercase text-[9px] tracking-widest text-muted-foreground/60">
          <Flag className="w-4 h-4" /> Denunciar Irregularidade
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-[2.5rem] max-w-md">
        <form onSubmit={handleSubmit} className="space-y-6">
          <DialogHeader>
            <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center mb-2 text-red-600">
               <AlertTriangle className="w-6 h-6" />
            </div>
            <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">Denunciar Evento</DialogTitle>
            <DialogDescription>Ajude-nos a manter a Viby segura relatando irregularidades.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase opacity-60">Motivo principal</Label>
              <Select name="reason" required>
                <SelectTrigger className="rounded-xl h-12">
                  <SelectValue placeholder="Selecione um motivo" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="fraude">Evento Falso ou Fraude</SelectItem>
                  <SelectItem value="copyright">Violação de Direitos Autorais</SelectItem>
                  <SelectItem value="inadequado">Conteúdo Inadequado / Ofensivo</SelectItem>
                  <SelectItem value="outro">Outro Motivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase opacity-60">Detalhes (Opcional)</Label>
              <Textarea name="description" placeholder="Descreva o que está acontecendo..." className="rounded-xl min-h-[100px] resize-none" />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading} className="w-full h-14 bg-red-600 text-white font-black rounded-2xl shadow-xl uppercase italic">
              {loading ? <Loader2 className="animate-spin mr-2" /> : null}
              Confirmar Denúncia
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

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
        <div className="flex flex-wrap gap-2 items-center">
          <AgeRatingBadge code={event.ageRating?.code || "free"} className="bg-white p-2 rounded-xl shadow-xl border" />
          <Badge className="bg-secondary text-white border-none text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full shadow-lg">
            {event.categoryName || 'Evento'}
          </Badge>
          {event.isSponsored && (
            <Badge className="bg-primary text-white border-none text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full shadow-lg flex items-center gap-1.5">
              <Megaphone className="w-3 h-3 text-secondary" /> Destaque
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

function MapLegend() {
  return (
    <div className="flex flex-wrap gap-6 p-6 bg-muted/20 rounded-2xl border border-dashed border-border/60">
       <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-lg bg-blue-50 border-2 border-blue-500 flex items-center justify-center text-blue-600 shadow-sm"><Accessibility className="w-3.5 h-3.5" /></div>
          <span className="text-[10px] font-black uppercase tracking-tight text-muted-foreground">Assento PCD</span>
       </div>
       <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-lg bg-purple-50 border-2 border-purple-500 flex items-center justify-center text-purple-600 shadow-sm"><Users2 className="w-3.5 h-3.5" /></div>
          <span className="text-[10px] font-black uppercase tracking-tight text-muted-foreground">Acompanhante</span>
       </div>
       <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-lg bg-orange-50 border-2 border-orange-500 flex items-center justify-center text-orange-600 shadow-sm"><Maximize2 className="w-3.5 h-3.5" /></div>
          <span className="text-[10px] font-black uppercase tracking-tight text-muted-foreground">Obeso</span>
       </div>
       <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-lg bg-muted border-2 border-muted-foreground/10 flex items-center justify-center text-muted-foreground/30"><X className="w-3.5 h-3.5" /></div>
          <span className="text-[10px] font-black uppercase tracking-tight text-muted-foreground">Vendido</span>
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
      <div className="bg-muted/50 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40">
         <div className="flex items-center gap-3">
            <div className="p-2 bg-secondary/10 rounded-lg text-secondary">
               <MapIcon className="w-5 h-5" />
            </div>
            <div>
               <h3 className="font-black uppercase italic tracking-tighter text-primary">Planta do Local</h3>
               <p className="text-[10px] font-bold text-muted-foreground uppercase">Clique em um setor para ver as opções.</p>
            </div>
         </div>
         <MapLegend />
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

function LocationSection({ event }: { event: any }) {
  const addressStr = `${event.address?.street || event.location}${event.address?.number ? `, ${event.address.number}` : ''} - ${event.address?.neighborhood || ''}, ${event.city} - ${event.address?.state || ''}`;
  
  const googleMapsUrl = event.latitude && event.longitude 
    ? `https://www.google.com/maps/search/?api=1&query=${event.latitude},${event.longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressStr)}`;
    
  const wazeUrl = event.latitude && event.longitude
    ? `https://www.waze.com/ul?ll=${event.latitude},${event.longitude}&navigate=yes`
    : `https://www.waze.com/ul?q=${encodeURIComponent(addressStr)}&navigate=yes`;

  const mapEmbedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(addressStr)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;

  return (
    <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden p-0 relative">
      <div className="p-8 pb-4">
        <h3 className="text-xl font-black uppercase italic tracking-tighter flex items-center gap-3">
          <MapPin className="w-5 h-5 text-secondary" /> Localização
        </h3>
      </div>
      
      <div className="relative h-80 bg-muted overflow-hidden">
         <iframe
            width="100%"
            height="100%"
            style={{ border: 0 }}
            loading="lazy"
            allowFullScreen
            src={mapEmbedUrl}
            title="Mapa do Local"
         />
      </div>

      <div className="p-8 space-y-6">
        <div className="space-y-1">
          <p className="text-sm font-bold text-primary">{event.location || "Local do Evento"}</p>
          <p className="text-xs text-muted-foreground font-medium">{addressStr}</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button variant="outline" className="flex-1 rounded-xl h-12 font-bold uppercase text-[10px] gap-2 border-secondary/20 text-secondary hover:bg-secondary/5" asChild>
            <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
               <img src="https://upload.wikimedia.org/wikipedia/commons/a/aa/Google_Maps_icon_%282020%29.svg" className="w-4 h-4" alt="Google Maps" />
               Abrir no Google Maps
            </a>
          </Button>
          <Button variant="outline" className="flex-1 rounded-xl h-12 font-bold uppercase text-[10px] gap-2 border-border text-primary hover:bg-muted" asChild>
            <a href={wazeUrl} target="_blank" rel="noopener noreferrer">
               <svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4"><path d="M466.8 190.2c-10.4-44.4-40.2-82-83.8-106.1-43.6-24.1-94.5-31.4-143.5-20.7-49 10.7-91.8 39-120.7 79.9-28.9 40.9-42.3 90.7-37.7 140.2 4.6 49.5 26.6 95 62 128.2 35.4 33.2 81.3 53.6 129.2 57.5 4.8.4 9.6.6 14.4.6 47.9 0 94-14.8 132.8-42.1 3.2-2.3 6.3-4.7 9.3-7.2 26.4-21.7 46.2-50.6 56.4-83.5 10.2-32.9 12.1-68.1 5.4-101.5l3.1-4.7c10.3-15.5 10.3-35.3 0-50.8l-3-4.7zm-215 225.1c-31.5 0-61.1-10.4-83.3-29.3-2.1-1.8-4.1-3.6-6-5.5-23.7-22.3-38.4-52.7-41.5-85.9-3.1-33.2 5.9-66.5 25.3-94 19.4-27.4 48.1-46.4 80.9-53.6 32.8-7.2 67-.2 96.2 16 29.2 16.2 49.2 41.3 56.2 71.1 4.5 22.4 3.2 46-3.6 68.1-6.8 22.1-20.1 41.5-37.8 56.1-2 1.6-4.1 3.2-6.2 4.7-26 18.3-56.6 28.2-88.6 28.2l8.4 24.2h-17zm134.4-78.2c-5.5 6.4-12.7 11.2-20.8 14.1-8.1 2.9-16.9 3.5-25.3 1.8-8.4-1.7-16.2-5.4-22.4-10.8s-10.8-12.7-13.3-21c-2.5-8.3-2.6-17.1-.3-25.5 2.3-8.4 6.9-15.9 13.1-21.5s13.9-9.2 22.3-10.4c8.4-1.2 17-.1 24.9 3.1 7.9 3.2 14.8 8.6 20 15.5s8.4 15.2 9.2 23.9c.8 8.7-1 17.5-5.2 25.3-4.2 7.8-10.5 14.3-18.1 19l4.5 13.5-13.4-7zm-143.5 0c-5.5 6.4-12.7 11.2-20.8 14.1-8.1 2.9-16.9 3.5-25.3 1.8-8.4-1.7-16.2-5.4-22.4-10.8s-10.8-12.7-13.3-21c-2.5-8.3-2.6-17.1-.3-25.5 2.3-8.4 6.9-15.9 13.1-21.5s13.9-9.2 22.3-10.4c8.4-1.2 17-.1 24.9 3.1 7.9 3.2 14.8 8.6 20 15.5s8.4 15.2 9.2 23.9c.8 8.7-1 17.5-5.2 25.3-4.2 7.8-10.5 14.3-18.1 19l4.5 13.5-13.4-7z" fill="#33CCFF"/></svg>
               Abrir no Waze
            </a>
          </Button>
        </div>
      </div>
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

  const partnersQuery = useMemoFirebase(() => (db && id) ? query(collection(db, 'events', id, 'partners'), where('status', '==', 'accepted')) : null, [db, id]);
  const { data: partners } = useCollection<any>(partnersQuery);

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

  const isActive = event?.status === 'Ativo';

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
    if (!isActive) return;
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

  const handleUpdateSeatType = (seatId: string, ticketTypeId: string) => {
    const type = allAvailableTickets.find(t => t.id === ticketTypeId);
    if (!type) return;
    setSelectedSeats(prev => ({
      ...prev,
      [seatId]: { ...prev[seatId], ticketType: type }
    }));
  };

  const handleAddToCart = () => {
    if (!event || !isActive) {
      toast({ variant: "destructive", title: "Vendas encerradas", description: "Este evento não está mais aceitando novas inscrições." });
      return;
    }
    
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
          seatCode: seat.codigo,
          ageRating: event.ageRating?.code
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
        ageRating: event.ageRating?.code
      });
      setQuantity(1);
      setSelectedTicketType(null);
    }
    toast({ title: 'Adicionado ao carrinho!' });
  };

  const handleShare = () => {
    if (typeof window !== 'undefined') {
      const url = window.location.href;
      navigator.clipboard.writeText(url);
      toast({ title: "Link copiado!", description: "Compartilhe o evento com seus amigos." });
    }
  }

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
               {settings?.logoUrl ? (
                 <img src={settings.logoUrl} alt={siteName} className="h-8 w-auto object-contain" />
               ) : (
                 <span className="font-black italic uppercase tracking-tighter text-2xl text-primary">{siteName}</span>
               )}
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" className="rounded-full relative border-2" asChild>
              <Link href="/dashboard/carrinho">
                <ShoppingCart className="w-5 h-5" />
                {totalCount > 0 && <span className="absolute -top-2 -right-2 bg-secondary text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-lg border-2 border-white">{totalCount}</span>}
              </Link>
            </Button>
            <Button variant="outline" size="icon" className="rounded-full border-2" onClick={handleShare}>
              <Share2 className="w-5 h-5" />
            </Button>
            {user ? (
               <UserNav />
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
              {/* CLASSIFICAÇÃO E ALERTAS */}
              <section className="space-y-6">
                 <div className="flex items-center gap-3 px-2">
                    <div className="p-2 bg-secondary/10 rounded-lg text-secondary"><ShieldCheck className="w-5 h-5" /></div>
                    <h2 className="text-xl font-black uppercase italic tracking-tighter text-primary">Classificação e Regras</h2>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="border-none shadow-sm rounded-[2rem] bg-white p-8 flex flex-col items-center justify-center text-center gap-4">
                       <AgeRatingBadge code={event.ageRating?.code || "free"} className="scale-125" />
                       <div className="space-y-1">
                          <p className="text-[10px] font-black uppercase opacity-40">Classificação Indicativa</p>
                          <p className="font-bold text-lg">{event.ageRating?.label || "Livre para todos os públicos"}</p>
                       </div>
                    </Card>
                    <div className="flex items-center">
                       <AgeRatingWarning code={event.ageRating?.code || "free"} />
                    </div>
                 </div>
              </section>

              {/* ORGANIZADOR CARD */}
              <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden p-8 hover:shadow-xl transition-shadow group">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                    <div className="flex items-center gap-8">
                      <div className="h-24 w-24 relative">
                        <img src={organizationProfile?.avatar || event.organizer?.avatar} className="h-full w-full rounded-full object-cover border-4 border-secondary/10 p-0.5 group-hover:scale-110 transition-transform" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em]">Realização</p>
                        <div className="flex items-center gap-2">
                           <h4 className="font-black text-2xl uppercase italic tracking-tighter text-primary">{organizationProfile?.name || event.organizer?.name}</h4>
                           {(organizationProfile?.verified || event.organizer?.isVerified) && <VerifiedBadge />}
                        </div>
                        <Link href={`/${organizationProfile?.username || event.organizer?.username}`} className="text-xs font-black text-secondary uppercase hover:underline">Ver Perfil da Marca</Link>
                      </div>
                    </div>
                    
                    {partners && partners.length > 0 && (
                      <div className="flex flex-col gap-3 md:border-l md:pl-8 border-border/40">
                         <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Em parceria com</p>
                         <div className="flex -space-x-4">
                            {partners.map((p: any) => (
                              <TooltipProvider key={p.id}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Link href={`/${p.username}`}>
                                       <div className="h-10 w-10 relative border-4 border-white shadow-md hover:-translate-y-1 transition-transform cursor-pointer rounded-full overflow-hidden">
                                          <img src={p.avatar} className="h-full w-full object-cover" />
                                       </div>
                                    </Link>
                                  </TooltipTrigger>
                                  <TooltipContent><p className="text-[10px] font-black uppercase">{p.orgName}</p></TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ))}
                         </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                       <ReportDialog eventId={id} eventTitle={event.title} />
                    </div>
                  </div>
              </Card>

              {/* DESCRIÇÃO CARD */}
              <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden p-10 relative">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                   <Info className="w-32 h-32 text-primary" />
                </div>
                <h3 className="text-xl font-black uppercase italic tracking-tighter mb-10 flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-secondary" /> Informações do Evento
                </h3>
                <div className="space-y-2">
                  {renderFormattedText(event.description)}
                </div>
              </Card>

              {/* LOCALIZAÇÃO CARD */}
              <LocationSection event={event} />

              {/* TICKETS SECTION */}
              <section id="tickets" className="space-y-10">
                <div className="flex flex-col gap-2">
                   <h2 className="text-4xl font-black italic uppercase tracking-tighter text-primary">Ingressos & Mapa</h2>
                   <p className="text-muted-foreground font-medium">Selecione a área desejada e escolha seus ingressos.</p>
                </div>

                {!isActive && (
                  <div className="p-10 text-center bg-orange-50 rounded-[2.5rem] border-2 border-dashed border-orange-200 flex flex-col items-center gap-4">
                     <Lock className="w-12 h-12 text-orange-600 opacity-40" />
                     <div className="space-y-1">
                        <h4 className="text-xl font-black uppercase italic tracking-tighter text-orange-800">Vendas Encerradas</h4>
                        <p className="text-sm font-medium text-orange-700">Este evento não está aceitando novas compras no momento.</p>
                     </div>
                  </div>
                )}

                {isActive && (
                  <>
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
                                      <div key={seat.id} className="p-6 bg-secondary/5 rounded-3xl border-2 border-secondary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-secondary rounded-2xl text-white">
                                              <Armchair className="w-6 h-6" />
                                            </div>
                                            <div>
                                              <p className="text-[9px] font-black uppercase text-secondary">Lugar Selecionado</p>
                                              <p className="font-black text-xl italic uppercase text-primary">{seat.codigo} • {selectedSector.nome}</p>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-6">
                                            <div className="space-y-1 min-w-[150px]">
                                              <Label className="text-[8px] font-black uppercase opacity-40">Tipo de Ingresso</Label>
                                              <Select value={ticketType.id} onValueChange={(val) => handleUpdateSeatType(seat.id, val)}>
                                                  <SelectTrigger className="h-9 rounded-xl text-[10px] font-bold uppercase bg-white">
                                                    <SelectValue />
                                                  </SelectTrigger>
                                                  <SelectContent className="rounded-xl">
                                                    {allAvailableTickets.map(t => (
                                                      <SelectItem key={t.id} value={t.id} className="text-[10px] font-bold uppercase">{t.name}</SelectItem>
                                                    ))}
                                                  </SelectContent>
                                              </Select>
                                            </div>
                                            <div className="text-right">
                                              <p className="text-[9px] font-bold text-muted-foreground uppercase">{ticketType.name}</p>
                                              <p className="font-black text-xl">{formatCurrency(ticketType.price)}</p>
                                            </div>
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
                  </>
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

                  {isActive ? (
                    (selectedTicketType || Object.keys(selectedSeats).length > 0) ? (
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
                    )
                  ) : (
                    <div className="py-20 text-center space-y-4">
                       <Lock className="w-12 h-12 mx-auto text-muted-foreground opacity-20" />
                       <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Vendas indisponíveis para este evento no momento.</p>
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
