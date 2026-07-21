
'use client';

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  ShoppingBag, 
  Loader2, 
  Calendar as CalendarIcon, 
  Clock, 
  CheckCircle2,
  ShieldCheck,
  Zap,
  ArrowRight
} from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase, useAuth, useUser } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useCart } from '@/contexts/CartContext';
import { useRouter, usePathname } from 'next/navigation';
import { format, isSameDay, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

interface ExperienceBookingCardProps {
  experience: any;
}

export function ExperienceBookingCard({ experience }: ExperienceBookingCardProps) {
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
      where("status", "==", "active"),
      orderBy("datetime", "asc")
    );
  }, [db, experience.id]);

  const { data: slots, loading: loadingSlots } = useCollection<any>(slotsQuery);

  const availableDates = React.useMemo(() => {
    if (!slots) return [];
    const now = new Date();
    const dates = new Set<string>();
    slots.forEach(s => {
      const d = new Date(s.datetime);
      if (d > now && (s.capacity - (s.sold || 0)) > 0) {
        dates.add(format(d, 'yyyy-MM-dd'));
      }
    });
    return Array.from(dates).map(d => new Date(d + 'T12:00:00'));
  }, [slots]);

  const filteredSlots = React.useMemo(() => {
    if (!selectedDate || !slots) return [];
    return slots.filter(s => isSameDay(new Date(s.datetime), selectedDate));
  }, [selectedDate, slots]);

  const minPrice = React.useMemo(() => {
    if (!slots || slots.length === 0) return 0;
    const now = new Date();
    const valid = slots.filter(s => new Date(s.datetime) > now);
    if (valid.length === 0) return 0;
    return Math.min(...valid.map(s => s.hasPromo ? s.promoPrice : s.price));
  }, [slots]);

  const handleBooking = () => {
    if (!selectedSlot) {
      toast({ title: "Selecione um horário", description: "Escolha o melhor momento para sua vivência." });
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
      ticketTypeName: "Reserva na Experiência",
      batchId: "slot",
      batchName: "Horário Agendado",
      currency: (experience.currency || 'BRL'),
      price: selectedSlot.hasPromo ? selectedSlot.promoPrice : selectedSlot.price,
      originalPrice: selectedSlot.price,
      allowCoupon: true,
      quantity: 1,
      requiresProof: false,
      occurrenceId: selectedSlot.id,
      productType: 'experience'
    });

    router.push('/dashboard/carrinho');
  };

  return (
    <Card className="border-none shadow-2xl rounded-[3rem] bg-white p-8 space-y-8 overflow-hidden relative border-t-8 border-secondary">
       <div className="space-y-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">A partir de</p>
          <div className="text-4xl font-black text-primary italic tracking-tighter">{formatPrice(minPrice, experience.currency)}</div>
       </div>

       <Separator className="border-dashed" />

       <div className="space-y-6">
          <div className="space-y-3">
             <Label className="text-[10px] font-black uppercase tracking-widest ml-1">1. Escolha a Data</Label>
             <div className="bg-muted/30 p-4 rounded-[2rem] border-2 border-dashed flex justify-center">
                <Calendar 
                   mode="single" 
                   selected={selectedDate} 
                   onSelect={(d) => { setSelectedDate(d); setSelectedSlot(null); }}
                   locale={ptBR}
                   disabled={(date) => date < startOfDay(new Date()) || !availableDates.some(ad => isSameDay(ad, date))}
                   className="rounded-xl border-none"
                />
             </div>
          </div>

          {selectedDate && (
            <div className="space-y-4 animate-in slide-in-from-top-2">
               <Label className="text-[10px] font-black uppercase tracking-widest ml-1">2. Escolha o Horário</Label>
               <div className="grid grid-cols-1 gap-2">
                  {filteredSlots.map(slot => (
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
            onClick={handleBooking}
            disabled={loadingSlots || !selectedSlot}
            className="w-full h-16 bg-primary text-white font-black rounded-2xl shadow-xl uppercase italic text-lg hover:scale-[1.02] transition-transform"
          >
             {loadingSlots ? <Loader2 className="animate-spin" /> : <><ShoppingBag className="w-5 h-5 mr-2" /> Reservar agora</>}
          </Button>
       </div>

       <div className="space-y-3 pt-4">
          <p className="flex items-center gap-2 text-[9px] font-black uppercase text-green-600"><CheckCircle2 className="w-3 h-3" /> Confirmação Imediata</p>
          <p className="flex items-center gap-2 text-[9px] font-black uppercase text-muted-foreground opacity-60"><ShieldCheck className="w-3 h-3" /> Pagamento Protegido Viby</p>
       </div>
    </Card>
  );
}
