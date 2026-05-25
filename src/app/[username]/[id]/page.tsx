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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { useCart } from '@/contexts/CartContext';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/financial-utils';
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

// --- COMPONENTES AUXILIARES ---

function VerifiedBadge() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4 fill-blue-500 text-white"
    >
      <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.74z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function Separator({ className }: { className?: string }) {
  return <div className={cn('h-px w-full bg-border', className)} />;
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
  const parts = text.split(/(\*\*.*?\*\*|\+.*?\+|@[\w.]+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return (
        <strong key={i} className="font-black">
          {part.slice(2, -2)}
        </strong>
      );
    if (part.startsWith('+') && part.endsWith('+'))
      return (
        <span
          key={i}
          className="text-2xl md:text-3xl font-black uppercase italic leading-tight block my-4 text-primary"
        >
          {part.slice(1, -1)}
        </span>
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
          className="object-cover"
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
              <Zap className="w-3 h-3 text-secondary fill-current" /> Destaque
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

function SeatMap({
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

  if (loading)
    return (
      <div className="h-64 flex items-center justify-center bg-muted/20 rounded-[2rem] border-2 border-dashed">
        <Loader2 className="w-8 h-8 animate-spin text-secondary" />
      </div>
    );

  return (
    <Card className="border-none shadow-inner rounded-[2rem] bg-muted/10 overflow-hidden">
      <CardContent className="p-4 md:p-8">
        <TransformWrapper initialScale={1} minScale={0.5} maxScale={3}>
          <TransformComponent wrapperStyle={{ width: '100%', height: '400px' }}>
            <div
              className="p-10 grid gap-3 place-content-center"
              style={{ 
                gridTemplateColumns: 'repeat(10, 40px)',
                width: 'fit-content',
                margin: '0 auto'
              }}
            >
              {seats?.map((seat) => {
                const isSold = seat.status === 'vendido';
                const isSelected = selectedSeatIds.includes(seat.id);
                return (
                  <button
                    key={seat.id}
                    disabled={isSold}
                    onClick={() => onToggleSeat(seat)}
                    className={cn(
                      'w-10 h-10 rounded-lg flex items-center justify-center text-[10px] font-black transition-all',
                      isSold
                        ? 'bg-muted text-muted-foreground/30 cursor-not-allowed'
                        : isSelected
                          ? 'bg-green-500 text-white scale-110 shadow-lg ring-4 ring-green-500/20'
                          : 'bg-white border-2 border-secondary/20 text-secondary hover:border-secondary hover:bg-secondary/5'
                    )}
                  >
                    {seat.codigo}
                  </button>
                );
              })}
            </div>
          </TransformComponent>
        </TransformWrapper>

        <div className="mt-8 flex flex-wrap justify-center gap-6 px-4 text-center">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-white border-2 border-secondary/20 rounded" />
            <span className="text-[10px] font-black uppercase opacity-60">Livre</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded" />
            <span className="text-[10px] font-black uppercase opacity-60">Sua Seleção</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-muted rounded" />
            <span className="text-[10px] font-black uppercase opacity-60">Ocupado</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TicketCard({
  type,
  isSelected,
  onSelect,
  quantity,
  onQuantityChange,
  showQuantity,
}: {
  type: any;
  isSelected: boolean;
  onSelect: () => void;
  quantity?: number;
  onQuantityChange?: (val: number) => void;
  showQuantity?: boolean;
}) {
  return (
    <Card
      onClick={onSelect}
      className={cn(
        'cursor-pointer border-2 transition-all rounded-[1.5rem] overflow-hidden group relative',
        isSelected
          ? 'border-secondary bg-secondary/5 shadow-lg shadow-secondary/10'
          : 'border-border hover:border-secondary/30 bg-white'
      )}
    >
      <CardContent className="p-6">
        <div className="flex justify-between items-start gap-4">
          <div className="space-y-1">
            <h4 className="font-black text-lg uppercase italic tracking-tighter text-primary">
              {type.name}
            </h4>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              {type._batch.name}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black text-primary">{formatCurrency(type.price)}</p>
            <p className="text-[9px] font-bold text-muted-foreground uppercase">
              + {formatCurrency(type.price * 0.15)} taxa
            </p>
          </div>
        </div>

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
             {showQuantity && isSelected && onQuantityChange && (
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

             {isSelected ? (
                <div className="bg-secondary text-white rounded-full p-1.5 shadow-md animate-in zoom-in-50">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              ) : (
                <div className="w-6 h-6 rounded-full border-2 border-muted-foreground/20 group-hover:border-secondary/40 transition-colors" />
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

  const availableTickets = React.useMemo(() => {
    if (!event || !selectedSector) return [];

    if (event.ticketMode === 'sector_batches') {
      const sectorDef = event.sectors?.find((s: any) => s.id === selectedSector.ticketLinkId);
      if (!sectorDef) return [];

      const activeBatch =
        sectorDef.batches?.find((b: any) => {
          const start = b.startDate ? new Date(b.startDate) : new Date(0);
          const end = b.endDate ? new Date(b.endDate) : new Date(8640000000000000);
          return now >= start && now <= end;
        }) || sectorDef.batches?.[0];

      return activeBatch?.ticketTypes?.map((t: any) => ({ ...t, _batch: activeBatch })) || [];
    }

    if (event.ticketMode === 'batches' || event.ticketMode === 'paid_single') {
      const activeBatch =
        event.batches?.find((b: any) => {
          const start = b.startDate ? new Date(b.startDate) : new Date(0);
          const end = b.endDate ? new Date(b.endDate) : new Date(8640000000000000);
          return now >= start && now <= end;
        }) || event.batches?.[0];

      return activeBatch?.ticketTypes?.map((t: any) => ({ ...t, _batch: activeBatch })) || [];
    }

    return [];
  }, [event, selectedSector, now]);

  const handleToggleSeat = (seat: any) => {
    setSelectedSeats(prev => {
      const next = { ...prev };
      if (next[seat.id]) {
        delete next[seat.id];
      } else {
        next[seat.id] = { seat, ticketType: availableTickets[0] };
      }
      return next;
    });
  };

  const updateSeatTicketType = (seatId: string, ticketTypeId: string) => {
    const type = availableTickets.find((t: any) => t.id === ticketTypeId);
    if (!type) return;
    setSelectedSeats(prev => ({
      ...prev,
      [seatId]: { ...prev[seatId], ticketType: type }
    }));
  };

  const handleAddToCart = () => {
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
        toast({ variant: 'destructive', title: 'Selecione um tipo de ingresso' });
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

  const totalSelectedPrice = React.useMemo(() => {
    if (selectedSector?.tipo !== 'livre') {
      return Object.values(selectedSeats).reduce((acc, curr) => acc + (curr.ticketType?.price || 0), 0);
    }
    return (selectedTicketType?.price || 0) * quantity;
  }, [selectedSector, selectedSeats, selectedTicketType, quantity]);

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
            <div className="lg:col-span-8 space-y-16">
              {/* ORGANIZADORES */}
              <div className="space-y-10">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16 border-2 border-secondary/20 p-0.5">
                    <AvatarImage src={event.organizer?.avatar} className="rounded-full object-cover" />
                    <AvatarFallback className="font-bold text-xl">
                      {event.organizer?.name?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <h4 className="font-black text-lg uppercase italic tracking-tighter">
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
                  <div className="space-y-4">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 px-1">
                      Co-realização
                    </p>
                    <div className="flex flex-wrap gap-4">
                      {partners.map((p: any) => (
                        <Link
                          key={p.id}
                          href={`/${p.username}`}
                          className="flex items-center gap-2 bg-muted/30 p-2 pr-4 rounded-full hover:bg-muted transition-colors border"
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
              </div>

              <Separator className="opacity-40" />

              {/* DESCRIÇÃO */}
              <section className="space-y-6">
                <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-secondary flex items-center gap-3">
                  <Info className="w-4 h-4" /> Sobre a Experiência
                </h2>
                <div className="text-muted-foreground font-medium text-lg leading-relaxed whitespace-pre-line prose prose-slate max-w-none">
                  {renderFormattedText(event.description)}
                </div>
              </section>

              <Separator className="opacity-40" />

              {/* LOCALIZAÇÃO */}
              <section className="space-y-8">
                <div className="space-y-1">
                  <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-secondary">
                    Localização
                  </h2>
                  <p className="text-2xl font-black italic tracking-tighter uppercase">
                    {event.address?.street}, {event.address?.number}
                  </p>
                  <p className="text-sm font-bold text-muted-foreground uppercase">
                    {event.address?.neighborhood}, {event.city} - {event.address?.state}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <Button variant="outline" className="h-12 rounded-xl font-bold gap-2" asChild>
                      <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${event.address?.street}, ${event.address?.number} - ${event.city}`)}`} target="_blank">
                         <Navigation className="w-4 h-4 text-blue-500" /> Abrir no Google Maps
                      </a>
                   </Button>
                   <Button variant="outline" className="h-12 rounded-xl font-bold gap-2" asChild>
                      <a href={`https://waze.com/ul?q=${encodeURIComponent(`${event.address?.street}, ${event.address?.number} - ${event.city}`)}`} target="_blank">
                         <div className="w-4 h-4 bg-[#33CCFF] rounded-full flex items-center justify-center text-[10px] text-white font-black italic">W</div> Abrir no Waze
                      </a>
                   </Button>
                </div>

                <Card className="overflow-hidden border-none shadow-xl rounded-[2.5rem] bg-muted aspect-video relative group">
                   <iframe
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    loading="lazy"
                    allowFullScreen
                    src={`https://www.google.com/maps/embed/v1/place?key=AIzaSyDWOoEhxGwwTzEuCx5ire2ZaddlH3X4Vcw&q=${encodeURIComponent(`${event.address?.street}, ${event.address?.number} - ${event.city}`)}`}
                  />
                </Card>
              </section>

              <Separator className="opacity-40" />

              {/* BILHETERIA */}
              <section id="tickets" className="space-y-10">
                <div className="space-y-2">
                  <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-secondary">
                    Bilheteria
                  </h2>
                  <p className="text-3xl font-black italic tracking-tighter uppercase">
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
                                : 'border-border hover:border-secondary/20'
                            )}
                          >
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-4">
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: setor.cor }}
                                />
                                <span className="font-black text-sm uppercase italic tracking-tighter">
                                  {setor.nome}
                                </span>
                              </div>
                              <Badge variant="outline" className="text-[8px] font-bold uppercase">
                                {setor.tipo}
                              </Badge>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>

                    {selectedSector && (
                      <div className="space-y-8 animate-in slide-in-from-top-4 duration-500 pt-4 border-t border-dashed">
                        {selectedSector.tipo !== 'livre' ? (
                          <div className="space-y-10">
                            <div className="space-y-6">
                               <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                  <Armchair className="w-4 h-4" /> 2. Escolha seus Lugares
                               </h3>
                               <SeatMap
                                 eventId={event.id}
                                 sectorId={selectedSector.id}
                                 onToggleSeat={handleToggleSeat}
                                 selectedSeatIds={Object.keys(selectedSeats)}
                               />
                            </div>

                            {Object.keys(selectedSeats).length > 0 && (
                              <div className="space-y-6 animate-in zoom-in-95 duration-300">
                                 <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                    <Ticket className="w-4 h-4" /> 3. Atribua os Ingressos
                                 </h3>
                                 <div className="grid grid-cols-1 gap-4">
                                    {Object.values(selectedSeats).map(({ seat, ticketType }) => (
                                      <Card key={seat.id} className="border-none shadow-sm rounded-2xl p-6 bg-white flex flex-col sm:flex-row items-center justify-between gap-6 group hover:border-secondary/20 border transition-all">
                                         <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary font-black">
                                               {seat.codigo}
                                            </div>
                                            <div>
                                               <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Assento Selecionado</p>
                                               <p className="font-bold text-sm uppercase italic tracking-tight">{selectedSector.nome}</p>
                                            </div>
                                         </div>

                                         <div className="w-full sm:w-64">
                                            <Select value={ticketType.id} onValueChange={(val) => updateSeatTicketType(seat.id, val)}>
                                               <SelectTrigger className="rounded-xl h-11 border-secondary/20">
                                                  <SelectValue placeholder="Tipo de ingresso" />
                                               </SelectTrigger>
                                               <SelectContent className="rounded-xl">
                                                  {availableTickets.map((t: any) => (
                                                    <SelectItem key={t.id} value={t.id} className="font-bold uppercase text-[10px]">
                                                       {t.name} - {formatCurrency(t.price)}
                                                    </SelectItem>
                                                  ))}
                                               </SelectContent>
                                            </Select>
                                         </div>

                                         <button onClick={() => handleToggleSeat(seat)} className="text-muted-foreground/30 hover:text-destructive transition-colors">
                                            <X className="w-5 h-5" />
                                         </button>
                                      </Card>
                                    ))}
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
                              {availableTickets.map((type: any) => (
                                <TicketCard
                                  key={type.id}
                                  type={type}
                                  isSelected={selectedTicketType?.id === type.id}
                                  onSelect={() => setSelectedTicketType(type)}
                                  showQuantity
                                  quantity={quantity}
                                  onQuantityChange={setQuantity}
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
                             <div className="p-4 bg-muted/30 rounded-2xl border border-dashed space-y-2">
                                <div className="flex justify-between font-black text-sm uppercase italic">
                                   <span>{selectedTicketType.name} {quantity > 1 && `x ${quantity}`}</span>
                                   <span>{formatCurrency(selectedTicketType.price * quantity)}</span>
                                </div>
                                <div className="text-[10px] font-bold text-secondary uppercase tracking-widest">
                                   Setor: {selectedSector.nome}
                                </div>
                             </div>
                           ) : (
                             Object.values(selectedSeats).map(({ seat, ticketType }) => (
                               <div key={seat.id} className="p-4 bg-muted/30 rounded-2xl border border-dashed space-y-1">
                                  <div className="flex justify-between font-black text-[10px] uppercase italic">
                                     <span>{ticketType.name} - Lug. {seat.codigo}</span>
                                     <span>{formatCurrency(ticketType.price)}</span>
                                  </div>
                               </div>
                             ))
                           )}
                        </div>

                        <div className="space-y-2 text-[10px] font-bold uppercase opacity-60">
                          <div className="flex justify-between">
                            <span>Subtotal</span>
                            <span>{formatCurrency(totalSelectedPrice)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Taxa de Serviço (15%)</span>
                            <span>{formatCurrency(totalSelectedPrice * 0.15)}</span>
                          </div>
                        </div>

                        <Separator />

                        <div className="flex justify-between items-center">
                          <span className="text-lg font-black uppercase italic">Total</span>
                          <span className="text-3xl font-black text-primary">
                            {formatCurrency(totalSelectedPrice * 1.15)}
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
              {totalSelectedPrice > 0 ? formatCurrency(totalSelectedPrice * 1.15) : '---'}
            </p>
          </div>
          <Button
            disabled={totalSelectedPrice === 0}
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
