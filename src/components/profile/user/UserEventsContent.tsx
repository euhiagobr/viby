"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, CheckCircle2, Lock, Sparkles } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface UserEventsContentProps {
  registrations: any[];
  isOwner?: boolean;
}

export function UserEventsContent({ registrations, isOwner = false }: UserEventsContentProps) {
  const now = new Date();
  
  const upcoming = React.useMemo(() => {
    if (!registrations) return [];
    const uniqueEvents = new Map();
    
    registrations.forEach((r: any) => {
      const d = r.eventDate?.toDate ? r.eventDate.toDate() : new Date(r.eventDate);
      if (d >= now && r.status !== 'Cancelado' && r.paymentStatus !== 'Cancelado') {
        if (!uniqueEvents.has(r.eventId)) {
          uniqueEvents.set(r.eventId, r);
        }
      }
    });
    
    return Array.from(uniqueEvents.values());
  }, [registrations, now]);

  const past = React.useMemo(() => {
    if (!registrations) return [];
    const uniqueEvents = new Map();
    
    registrations.forEach((r: any) => {
      const d = r.eventDate?.toDate ? r.eventDate.toDate() : new Date(r.eventDate);
      // Eventos passados ou onde já foi feito check-in
      if (d < now || r.checkedIn) {
        if (!uniqueEvents.has(r.eventId)) {
          uniqueEvents.set(r.eventId, r);
        }
      }
    });
    
    return Array.from(uniqueEvents.values());
  }, [registrations, now]);

  if (!isOwner) {
    return (
      <div className="space-y-10 sticky top-24">
        <section className="space-y-6">
          <div className="flex items-center justify-between px-2">
             <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Privacidade</h2>
          </div>
          <Card className="border-none shadow-sm rounded-[2.5rem] bg-white p-8 text-center space-y-4">
             <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center mx-auto text-orange-500">
                <Lock className="w-6 h-6" />
             </div>
             <div className="space-y-1">
                <p className="text-xs font-black uppercase italic tracking-tighter text-primary">Agenda Privada</p>
                <p className="text-[10px] text-muted-foreground font-medium leading-relaxed uppercase">O histórico de rolês e próximos planos deste usuário são protegidos.</p>
             </div>
          </Card>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-10 sticky top-24">
      <section className="space-y-6">
        <div className="flex items-center justify-between px-2">
           <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Sua Agenda</h2>
           <Badge variant="outline" className="rounded-full text-[9px] font-black uppercase">{upcoming.length}</Badge>
        </div>
        
        <div className="space-y-4">
           {upcoming.length > 0 ? upcoming.map((reg: any) => (
             <EventCompactCard key={reg.id} registration={reg} />
           )) : (
             <div className="p-8 text-center bg-white rounded-3xl border-2 border-dashed opacity-40">
                <p className="text-[10px] font-black uppercase tracking-widest">Sem planos por enquanto</p>
             </div>
           )}
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex items-center justify-between px-2">
           <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Histórico Pessoal</h2>
        </div>
        
        <div className="space-y-4">
           {past.slice(0, 3).map((reg: any) => (
             <EventCompactCard key={reg.id} registration={reg} isPast />
           ))}
           {past.length > 3 && (
             <Button asChild variant="ghost" className="w-full h-10 rounded-xl text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:bg-muted">
                <Link href="/dashboard/ingressos">Ver todos os {past.length} rolês</Link>
             </Button>
           )}
        </div>
      </section>

      <section className="space-y-6 pt-6 border-t border-dashed">
         <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-2">Conquistas</h2>
         <div className="grid grid-cols-4 gap-4 px-2">
            {[1,2,3,4].map(i => (
              <div key={i} className="aspect-square rounded-2xl bg-muted/40 border border-dashed border-border/50 flex items-center justify-center group cursor-pointer hover:bg-white hover:border-secondary transition-all">
                 <Sparkles className="w-5 h-5 text-muted-foreground/20 group-hover:text-secondary group-hover:scale-110 transition-all" />
              </div>
            ))}
         </div>
      </section>
    </div>
  );
}

function EventCompactCard({ registration, isPast = false }: { registration: any, isPast?: boolean }) {
  const d = registration.eventDate?.toDate ? registration.eventDate.toDate() : new Date(registration.eventDate);
  const path = `/${registration.organizerUsername || 'evento'}/${registration.eventId}`;

  return (
    <Link href={path}>
      <Card className={cn(
        "overflow-hidden border-none shadow-sm hover:shadow-md transition-all rounded-2xl bg-white group flex",
        isPast && "opacity-60 grayscale-[0.5]"
      )}>
        <div className="relative w-20 h-24 bg-muted shrink-0">
           <Image src={registration.eventImage || "https://picsum.photos/seed/event/200/200"} alt="Event" fill className="object-cover" unoptimized />
           {registration.checkedIn && (
             <div className="absolute top-1 right-1 bg-green-500 text-white p-0.5 rounded-full shadow-lg">
                <CheckCircle2 className="w-3 h-3" />
             </div>
           )}
        </div>
        <CardContent className="p-4 flex-1 flex flex-col justify-center min-w-0">
           <h4 className="font-bold text-xs leading-tight line-clamp-1 uppercase italic text-primary group-hover:text-secondary transition-colors">{registration.eventTitle}</h4>
           <div className="mt-2 space-y-1">
              <div className="flex items-center gap-1.5 text-[9px] font-black uppercase text-muted-foreground">
                 <Calendar className="w-3 h-3 text-secondary" />
                 {d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
              </div>
              <div className="flex items-center gap-1.5 text-[9px] font-bold text-muted-foreground uppercase">
                 <MapPin className="w-3 h-3 text-secondary" />
                 <span className="truncate">{registration.eventCity}</span>
              </div>
           </div>
        </CardContent>
      </Card>
    </Link>
  );
}